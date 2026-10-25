import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTrip } from '@/contexts/TripContext';
import { supabase } from '@/integrations/supabase/client';
import { searchListings } from '@/lib/listings';
import { getSavedPropertyIds } from '@/lib/trips';
import { Property, ChatMessage, ShortlistItem, Room } from '@/types';
import SearchForm, { SearchCriteria } from '@/components/explore/SearchForm';
import PropertyResultCard from '@/components/explore/PropertyResultCard';
import WeatherTiles from '@/components/explore/WeatherTiles';
import ResultsFooter from '@/components/explore/ResultsFooter';
import MapPanel from '@/components/explore/MapPanel';
import ShortlistPanel from '@/components/explore/ShortlistPanel';
import TripSummaryBar from '@/components/explore/TripSummaryBar';
import PropertyDetailSheet from '@/components/explore/PropertyDetailSheet';
import OfferModal from '@/components/explore/OfferModal';
import { PostStayReviewModal, ReviewPayload } from '@/components/review';
import { Button } from '@/components/ui/button';
import { MapPin, LogOut, Menu, Heart, Plane, Star, Map as MapIcon, List, Loader2, Search as SearchIcon, Home, Building2, Tent, LayoutGrid } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const EARTH_KM = 6371;
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Resolve any NZ/AU place name to coordinates via Mapbox geocoding.
async function geocodePlace(q: string, token: string) {
  if (!token || !q) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      q,
    )}.json?access_token=${token}&country=nz,au&types=place,locality,region&limit=5`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const feats: any[] = j.features || [];
    if (!feats.length) return null;
    // Prefer the city/town itself over a suburb (e.g. "Whanganui", not "Whanganui East").
    const ql = q.trim().toLowerCase();
    const f =
      feats.find((x) => String(x.text || '').toLowerCase() === ql) ||
      feats.find((x) => (x.place_type || []).includes('place')) ||
      feats[0];
    const cc =
      (f.context || []).find((c: any) => String(c.id).startsWith('country'))?.short_code ||
      f.properties?.short_code ||
      '';
    return {
      name: f.text as string,
      lat: f.center[1] as number,
      lng: f.center[0] as number,
      country: (String(cc).toUpperCase() === 'AU' ? 'AU' : 'NZ') as 'NZ' | 'AU',
    };
  } catch {
    return null;
  }
}

const POOL_RE = /pool|swim/i;
function hasAmenity(p: Property, re: RegExp) {
  return (p.amenities || []).some((a) => re.test(a));
}

export default function Explore() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { trip, setDestination, setCheckIn, setCheckOut, getPropertyPriceEstimate } = useTrip();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);
  const [watchlistedIds, setWatchlistedIds] = useState<string[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string>(import.meta.env.VITE_MAPBOX_TOKEN || '');
  const [tone, setTone] = useState<'fun' | 'pro'>('fun');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [visibleProperties, setVisibleProperties] = useState<Property[]>([]);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const refreshSaved = () => {
    if (user) getSavedPropertyIds(user.id).then(setSavedIds).catch(() => {});
  };

  // Results-page controls
  const [bandColor, setBandColor] = useState<'yellow' | 'orange' | 'navy'>(() => {
    try { return (localStorage.getItem('fs_band') as any) || 'yellow'; } catch { return 'yellow'; }
  });
  const pickBand = (c: 'yellow' | 'orange' | 'navy') => {
    setBandColor(c);
    try { localStorage.setItem('fs_band', c); } catch { /* ignore */ }
  };
  const [resultView, setResultView] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'price_desc' | 'price_asc' | 'recommended'>('price_desc');
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [maxBudget, setMaxBudget] = useState<number | null>(null); // null = no cap
  const [mobileCount, setMobileCount] = useState(20);

  const BUDGET_MAX: Record<string, number> = { all: 20000, homes: 20000, hotels: 1000, parks: 500 };
  const BUDGET_MIN: Record<string, number> = { all: 20, homes: 50, hotels: 50, parks: 20 };

  const chooseCat = (c: 'all' | 'homes' | 'hotels' | 'parks') => {
    setCatFilter(c);
    setMaxBudget(null);
    setPage(1);
    setMobileCount(20);
  };

  const priceOf = (p: Property): number | null => {
    const e = getPropertyPriceEstimate(p.id);
    return p.guide_min ?? p.guide_max ?? p.guide_price ?? e?.high ?? e?.low ?? null;
  };
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<Property[]>([]);
  const [searched, setSearched] = useState(false);
  const [catFilter, setCatFilter] = useState<'all' | 'homes' | 'hotels' | 'parks'>('all');
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
    country: 'NZ', city: '', checkIn: '', checkOut: '', adults: 2, children: 0, childAges: [],
  });
  const [criteria, setCriteria] = useState<{
    destination?: string;
    adults?: number;
    children?: number;
    mustHaves?: string[];
    checkIn?: string;
    checkOut?: string;
    placeLabel?: string;
  }>({});

  // Property detail sheet
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Offer modal
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerProperty, setOfferProperty] = useState<Property | null>(null);
  const [offerRoom, setOfferRoom] = useState<Room | null>(null);
  const [sentOfferIds, setSentOfferIds] = useState<string[]>([]);

  // Post-stay review modal (demo trigger)
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Infinite scroll (mobile): load another batch when the sentinel scrolls into view
  useEffect(() => {
    if (!isMobile || !searched) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setMobileCount((c) => c + 20);
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [isMobile, searched, resultView, catFilter, results.length, mobileCount]);

  // Land straight on results: auto-run a default search once on arrival.
  const didAutoSearch = useRef(false);
  useEffect(() => {
    if (authLoading || !user || didAutoSearch.current) return;
    didAutoSearch.current = true;
    if (searched) return;
    const isoD = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    handleSearch({
      country: 'NZ', city: 'Whanganui',
      checkIn: isoD(Date.now() + 14 * 864e5), checkOut: isoD(Date.now() + 16 * 864e5),
      adults: 2, children: 0, childAges: [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Load properties and watchlist on mount
  useEffect(() => {
    if (user) {
      loadProperties();
      loadWatchlist();
      getSavedPropertyIds(user.id).then(setSavedIds).catch(() => {});
    }
  }, [user]);

  const loadProperties = async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading properties:', error);
      toast({
        title: 'Error',
        description: 'Failed to load properties',
        variant: 'destructive',
      });
    } else if (data) {
      setProperties(data as Property[]);
      setVisibleProperties(data as Property[]);
    }
  };

  const loadWatchlist = async () => {
    const { data, error } = await supabase
      .from('watchlists')
      .select('property_id')
      .eq('user_id', user?.id);

    if (!error && data) {
      setWatchlistedIds(data.map((w: any) => w.property_id));
    }
  };

  const logPropertyEvent = async (propertyId: string, eventType: string, metadata?: Record<string, any>) => {
    if (!user) return;
    const { error } = await supabase.from('property_events').insert({
      property_id: propertyId,
      user_id: user.id,
      event_type: eventType,
      metadata: metadata || null,
    });
    if (error) console.warn('Event log failed', error.message);
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Full conversation so far — used for robust JSON extraction (no chat loop)
    const convoText = [...messages, userMessage]
      .map((m) => `${m.role === 'user' ? 'Traveller' : 'Concierge'}: ${m.content}`)
      .join('\n');

    // 1) Extract structured criteria as JSON
    let extracted: any = {};
    try {
      const { data } = await supabase.functions.invoke('ai-router', {
        body: { type: 'extract', message: convoText },
      });
      if (data?.reply) extracted = JSON.parse(data.reply);
    } catch {
      /* fall back to what we already have */
    }

    const merged = {
      destination: extracted.destination || criteria.destination,
      adults: extracted.adults ?? criteria.adults,
      children: extracted.children ?? criteria.children,
      mustHaves:
        (extracted.must_haves && extracted.must_haves.length
          ? extracted.must_haves
          : criteria.mustHaves) || [],
      checkIn: extracted.check_in || criteria.checkIn,
      checkOut: extracted.check_out || criteria.checkOut,
      placeLabel: criteria.placeLabel,
    };

    // 2) Resolve a location (works for any NZ/AU place, e.g. Whanganui)
    let geo: { name: string; lat: number; lng: number; country: 'NZ' | 'AU' } | null = null;
    if (merged.destination) geo = await geocodePlace(merged.destination, mapboxToken);
    if (!geo && !merged.destination) geo = await geocodePlace(content, mapboxToken);

    let response = '';
    let recs: Property[] = [];

    if (geo) {
      merged.placeLabel = geo.name;
      setDestination({
        city: geo.name,
        country: geo.country,
        latitude: geo.lat,
        longitude: geo.lng,
        radius: 50,
      });

      // Real LiteAPI properties for the area (merged with claim status); demo table as fallback.
      let near: Property[] = [];
      try {
        near = await searchListings({ name: geo.name, lat: geo.lat, lng: geo.lng, country: geo.country });
      } catch {
        near = [];
      }
      if (near.length === 0) {
        const withDist = properties
          .filter((p) => p.latitude != null && p.longitude != null)
          .map((p) => ({
            p,
            d: haversineKm(geo!.lat, geo!.lng, p.latitude as number, p.longitude as number),
          }))
          .sort((a, b) => a.d - b.d);
        near = withDist.filter((x) => x.d <= 60).map((x) => x.p);
        if (near.length === 0) near = withDist.filter((x) => x.d <= 200).map((x) => x.p).slice(0, 6);
        if (near.length === 0) near = properties.filter((p) => p.country === geo!.country).slice(0, 6);
      }

      // Must-have handling (e.g. a swimming pool floats to the top)
      const wantsPool =
        (merged.mustHaves || []).some((m: string) => POOL_RE.test(m)) || POOL_RE.test(content);
      let poolCount = 0;
      if (wantsPool) {
        const pools = near.filter((p) => hasAmenity(p, POOL_RE));
        poolCount = pools.length;
        near = [...pools, ...near.filter((p) => !hasAmenity(p, POOL_RE))];
      }
      // Claimed/registered businesses get first priority in results (premium placement).
      near = [...near].sort((a, b) => Number(b.is_claimed) - Number(a.is_claimed));
      recs = near; // show every result in the scrollable sidebar
      setVisibleProperties(near.length ? near : properties);

      const kids = (merged.children || 0) > 0;
      const couple = merged.adults === 2 && !kids;
      const opener =
        tone === 'fun'
          ? kids
            ? "Ooh, a trip with the little ones — let's find somewhere they'll love too!"
            : couple
            ? 'A sneaky escape for two — lovely.'
            : "Nice one — let's get you sorted."
          : "Great — here's what I've found.";
      const poolBit = wantsPool
        ? poolCount > 0
          ? ` ${poolCount === 1 ? 'One spot has' : `${poolCount} spots have`} a pool, right up top — plus a few more worth a look.`
          : ' None nearby list a pool, but here are the closest options — tap a pin to check their facilities.'
        : '';
      const nAdults = merged.adults || 2;
      const guestsStr = `${nAdults} adult${nAdults > 1 ? 's' : ''}${kids ? ` + ${merged.children} child${(merged.children || 0) > 1 ? 'ren' : ''}` : ''}`;
      const fmtDate = (d?: string) => {
        if (!d) return '';
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
      };
      const ci = fmtDate(merged.checkIn);
      const co = fmtDate(merged.checkOut);
      const datesStr = ci ? (co ? ` · ${ci}–${co}` : ` · from ${ci}`) : '';
      response = `Got that — **${geo.name}** · ${guestsStr}${datesStr} · ${near.length} place${near.length === 1 ? '' : 's'} nearby.${poolBit}\n\nNot the right spot? Just type or say the correct details. Tap any pin or card to look closer, then **Make an Offer**.`;
    } else {
      response =
        tone === 'fun'
          ? "Hey! Just tell me **where** you fancy going, **when**, **how many** of you (adults & kids), and anything you really need — a pool, parking, pet-friendly. I'll pull up the map and show you what's around. 🌏"
          : "Happy to help. Tell me **where** you'd like to stay, **when**, **how many guests** (adults and children), and any must-haves — then I'll show you the options.";
    }

    setCriteria(merged);

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      properties: recs.length ? recs : undefined,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const handleSearch = async (c: SearchCriteria) => {
    setSearchCriteria(c);
    setIsLoading(true);
    setSearched(true);
    const countryName = c.country === 'AU' ? 'Australia' : 'New Zealand';
    let geo = await geocodePlace(`${c.city}, ${countryName}`, mapboxToken);
    if (!geo) geo = await geocodePlace(c.city, mapboxToken);
    let near: Property[] = [];
    if (geo) {
      setDestination({ city: geo.name, country: geo.country, latitude: geo.lat, longitude: geo.lng, radius: 50 });
      try {
        near = await searchListings({ name: geo.name, lat: geo.lat, lng: geo.lng, country: geo.country });
      } catch {
        near = [];
      }
      // registered/claimed businesses first
      near = [...near].sort((a, b) => Number(b.is_claimed) - Number(a.is_claimed));
    }
    setResults(near);
    setVisibleProperties(near);
    setIsLoading(false);
  };

  const handlePropertySelect = (property: Property) => {
    const isAlreadyShortlisted = shortlist.some(item => item.property.id === property.id);
    
    if (isAlreadyShortlisted) {
      setShortlist(prev => prev.filter(item => item.property.id !== property.id));
      toast({ description: `${property.name} removed from shortlist` });
      logPropertyEvent(property.id, 'shortlist_remove');
    } else {
      setShortlist(prev => [...prev, { property }]);
      toast({ description: `${property.name} added to shortlist` });
      logPropertyEvent(property.id, 'shortlist_add');
    }
    
    setSelectedPropertyId(property.id);
    logPropertyEvent(property.id, 'property_select');
  };

  const handlePropertyPinClick = (property: Property) => {
    setDetailProperty(property);
    setDetailSheetOpen(true);
    setSelectedPropertyId(property.id);
    logPropertyEvent(property.id, 'property_view', { source: 'map_pin' });
  };

  const handleAddToWatchlist = async (property: Property) => {
    if (!user) return;

    const isWatchlisted = watchlistedIds.includes(property.id);

    if (isWatchlisted) {
      // Remove from watchlist
      const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('user_id', user.id)
        .eq('property_id', property.id);

      if (error) {
        toast({ title: 'Error', description: 'Failed to remove from watchlist', variant: 'destructive' });
      } else {
        setWatchlistedIds(prev => prev.filter(id => id !== property.id));
        toast({ description: `${property.name} removed from watchlist` });
        logPropertyEvent(property.id, 'watchlist_remove');
      }
    } else {
      // Add to watchlist
      const { error } = await supabase
        .from('watchlists')
        .insert({ user_id: user.id, property_id: property.id });

      if (error) {
        toast({ title: 'Error', description: 'Failed to add to watchlist', variant: 'destructive' });
      } else {
        setWatchlistedIds(prev => [...prev, property.id]);
        toast({ description: `${property.name} added to watchlist` });
        logPropertyEvent(property.id, 'watchlist_add');
      }
    }
  };

  const handleRemoveFromShortlist = (propertyId: string) => {
    setShortlist(prev => prev.filter(item => item.property.id !== propertyId));
  };

  const handleMakeOffer = (property: Property, room?: Room) => {
    setOfferProperty(property);
    setOfferRoom(room || null);
    setOfferModalOpen(true);
    setDetailSheetOpen(false);
  };

  const handleOfferSent = (propertyId: string) => {
    setSentOfferIds((prev) => [...prev, propertyId]);
  };

  const handleReviewSubmit = (review: ReviewPayload) => {
    console.log('Review submitted (business brain payload):', review);
    toast({
      title: 'Thank you!',
      description: 'Your feedback helps us improve recommendations.',
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const shortlistedIds = shortlist.map(item => item.property.id);

  // Derived results list (category + budget filter, then sort, then paginate)
  const BAND_BG: Record<string, string> = { yellow: '#FBEFC9', orange: '#F7D6B6', navy: '#1E2A4A' };
  const bandBg = BAND_BG[bandColor];
  const navy = bandColor === 'navy';
  const sym = trip.currency === 'AUD' ? 'A$' : 'NZ$';

  const filteredList = (() => {
    let list = results.filter((p) => catFilter === 'all' || (p.category || 'hotels') === catFilter);
    if (maxBudget != null) list = list.filter((p) => { const pr = priceOf(p); return pr == null || pr <= maxBudget; });
    list = [...list].sort((a, b) => {
      if (sortBy === 'recommended') return Number(b.is_claimed) - Number(a.is_claimed);
      const pa = priceOf(a); const pb = priceOf(b);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return sortBy === 'price_asc' ? pa - pb : pb - pa;
    });
    return list;
  })();
  const totalResults = filteredList.length;
  const pageCount = Math.max(1, Math.ceil(totalResults / perPage));
  const curPage = Math.min(page, pageCount);
  const shownResults = isMobile
    ? filteredList.slice(0, mobileCount)
    : filteredList.slice((curPage - 1) * perPage, curPage * perPage);

  const catButtons: { id: 'all' | 'homes' | 'hotels' | 'parks'; label: string; Icon?: any }[] = [
    { id: 'all', label: 'All' },
    { id: 'homes', label: 'Homes & apartments', Icon: Home },
    { id: 'hotels', label: 'Hotels & motels', Icon: Building2 },
    { id: 'parks', label: 'Holiday parks', Icon: Tent },
  ];

  return (
    <div className="fas-brand-day min-h-screen bg-background text-foreground">
      {/* Demo: Post-stay review trigger button (floating) */}
      <button
        onClick={() => setReviewModalOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-gold to-gold/80 text-charcoal font-medium shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <Star className="w-4 h-4" />
        <span className="hidden sm:inline">Demo Review</span>
      </button>

      <>
          {/* COLOURED BAND — search + breadcrumb + change-the-look + weather + map + property type */}
          <div style={{ backgroundColor: bandBg }}>
            <div className="mx-auto w-full max-w-6xl px-4 pb-5">
              <div className="pt-4">
                <SearchForm variant="bar" initial={searchCriteria} loading={isLoading} onSearch={handleSearch} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div className={cn('text-sm', navy ? 'text-white/85' : 'text-foreground')}>
                  <span className="opacity-70">Home › {searchCriteria.country === 'AU' ? 'Australia' : 'New Zealand'} › </span>
                  <span className="font-bold">{searchCriteria.city || 'Search'}</span>
                </div>
                <div className={cn('flex items-center gap-2 text-xs font-semibold', navy ? 'text-white/85' : 'text-muted-foreground')}>
                  Change the look
                  {(['yellow', 'orange', 'navy'] as const).map((c) => (
                    <button key={c} type="button" onClick={() => pickBand(c)} aria-label={c}
                      className={cn('h-5 w-5 rounded-full border-2 border-black/10', bandColor === c && (navy ? 'outline outline-2 outline-white' : 'outline outline-2 outline-foreground'))}
                      style={{ backgroundColor: BAND_BG[c] }} />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3 py-3">
                <h1 className={cn('font-display text-2xl font-extrabold tracking-tight', navy ? 'text-white' : 'text-foreground')}>
                  {searchCriteria.city || 'Stays'} <span className={cn('text-base font-medium', navy ? 'text-white/70' : 'text-muted-foreground')}>· {totalResults} stays you can make an offer on</span>
                </h1>
                <div className="flex items-center gap-2">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground">
                    <option value="price_desc">Sort: Price (high → low)</option>
                    <option value="price_asc">Sort: Price (low → high)</option>
                    <option value="recommended">Sort: Recommended</option>
                  </select>
                  <div className="inline-flex overflow-hidden rounded-lg border border-border">
                    <button type="button" onClick={() => setResultView('list')} className={cn('flex items-center gap-1 px-3 py-2 text-sm font-semibold', resultView === 'list' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground')}><List className="h-4 w-4" /> List</button>
                    <button type="button" onClick={() => setResultView('grid')} className={cn('flex items-center gap-1 px-3 py-2 text-sm font-semibold', resultView === 'grid' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground')}><LayoutGrid className="h-4 w-4" /> Grid</button>
                  </div>
                </div>
              </div>

              <WeatherTiles />

              <div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
                <button type="button" onClick={() => setMapOpen(true)}
                  className="relative flex min-h-[150px] items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-[#d7e6e4] to-[#c2d6e4]">
                  <span className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-foreground shadow"><MapIcon className="h-4 w-4" /> Show on map</span>
                </button>
                <div className="rounded-2xl border border-black/10 bg-white p-4">
                  <h4 className="font-display text-base font-bold text-foreground">Property type</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {catButtons.filter((c) => c.id !== 'all').map((c) => (
                      <button key={c.id} type="button" onClick={() => chooseCat(catFilter === c.id ? 'all' : c.id)}
                        className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold',
                          catFilter === c.id ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground')}>
                        {c.Icon && <c.Icon className="h-3.5 w-3.5" />} {c.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">Your budget (per night)</div>
                  <input type="range" min={BUDGET_MIN[catFilter]} max={BUDGET_MAX[catFilter]} step={10}
                    value={maxBudget ?? BUDGET_MAX[catFilter]}
                    onChange={(e) => { const v = Number(e.target.value); setMaxBudget(v >= BUDGET_MAX[catFilter] ? null : v); setPage(1); setMobileCount(20); }}
                    className="mt-2 w-full accent-[#0C1A22]" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{sym}{BUDGET_MIN[catFilter]}</span>
                    <span>Up to {sym}{(maxBudget ?? BUDGET_MAX[catFilter]).toLocaleString()}{maxBudget == null ? '+' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RESULTS (white) */}
          <div className="mx-auto w-full max-w-6xl px-4 py-6">
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
              <SearchIcon className="h-4 w-4 flex-none" /> You set the price — make an offer and the property accepts, counters, or passes.
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex flex-1 gap-0.5 rounded-lg border border-border bg-muted/50 p-1 text-xs font-semibold">
                {catButtons.map((c) => (
                  <button key={c.id} type="button" onClick={() => chooseCat(c.id)}
                    className={cn('flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 transition', catFilter === c.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
                    {c.Icon && <c.Icon className="h-3.5 w-3.5" />} {c.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setMapOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/40">
                <MapIcon className="h-4 w-4 text-primary" /> Map view
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : totalResults === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <SearchIcon className="mx-auto mb-3 h-8 w-8 opacity-40" />
                No stays found for {searchCriteria.city}. Try another town, category, or widen your budget.
              </div>
            ) : (
              <>
                <div className={resultView === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-4'}>
                  {shownResults.map((property) => (
                    <PropertyResultCard
                      key={property.id}
                      property={property}
                      view={resultView}
                      onViewDetails={() => handlePropertyPinClick(property)}
                      onMakeOffer={() => handleMakeOffer(property)}
                      saved={savedIds.has(property.id)}
                      onSavedChange={refreshSaved}
                      priceEstimate={getPropertyPriceEstimate(property.id)}
                    />
                  ))}
                </div>

                {!isMobile && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <button className="h-9 min-w-9 rounded-lg border border-border bg-card px-2 font-semibold disabled:opacity-40" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>‹</button>
                      {Array.from({ length: Math.min(pageCount, 6) }, (_, i) => i + 1).map((n) => (
                        <button key={n} onClick={() => setPage(n)} className={cn('h-9 min-w-9 rounded-lg border px-2 font-semibold', n === curPage ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground')}>{n}</button>
                      ))}
                      <button className="h-9 min-w-9 rounded-lg border border-border bg-card px-2 font-semibold disabled:opacity-40" disabled={curPage >= pageCount} onClick={() => setPage(curPage + 1)}>›</button>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      Results per page
                      <div className="inline-flex overflow-hidden rounded-lg border border-border">
                        {[20, 50, 100].map((n) => (
                          <button key={n} onClick={() => { setPerPage(n); setPage(1); }} className={cn('px-2.5 py-1.5 text-sm font-bold', perPage === n ? 'bg-foreground text-background' : 'bg-card text-muted-foreground')}>{n}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {isMobile && mobileCount < totalResults && (
                  <div ref={sentinelRef} className="mt-5 flex flex-col items-center gap-2 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">
                    <span className="h-[3px] w-9 rounded bg-white/50" /> Keep scrolling — more stays load automatically
                  </div>
                )}
              </>
            )}

            {shortlist.length > 0 && (
              <div className="mt-6">
                <ShortlistPanel items={shortlist} onRemove={handleRemoveFromShortlist} onMakeOffer={(p) => handleMakeOffer(p)} sentOfferIds={sentOfferIds} />
              </div>
            )}
          </div>

          <ResultsFooter />
        </>

      {/* MAP OVERLAY — on-demand, opened from the "Map view" tile */}
      {mapOpen && (
        <div className="fixed inset-0 bg-background" style={{ zIndex: 50 }}>
          <Button onClick={() => setMapOpen(false)} size="sm" className="absolute left-4 top-20 z-10 gap-2 shadow-lg">
            <List className="h-4 w-4" /> Back to list
          </Button>
          <MapPanel
            properties={filteredList.length ? filteredList : visibleProperties}
            selectedPropertyId={selectedPropertyId}
            shortlistedIds={shortlistedIds}
            watchlistedIds={watchlistedIds}
            onPropertySelect={handlePropertySelect}
            onPropertyClick={handlePropertyPinClick}
            mapboxToken={mapboxToken}
            onTokenChange={setMapboxToken}
          />
        </div>
      )}

      {/* Property Detail Sheet (for pin clicks) */}
      <PropertyDetailSheet
        property={detailProperty}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onMakeOffer={handleMakeOffer}
        onAddToWatchlist={handleAddToWatchlist}
        isWatchlisted={detailProperty ? watchlistedIds.includes(detailProperty.id) : false}
      />

      {/* Offer Modal */}
      <OfferModal
        open={offerModalOpen}
        onOpenChange={setOfferModalOpen}
        property={offerProperty}
        initialAdults={searchCriteria.adults}
        initialChildren={searchCriteria.children}
        initialCheckIn={searchCriteria.checkIn}
        initialCheckOut={searchCriteria.checkOut}
        onOfferSent={handleOfferSent}
      />

      {/* Post-Stay Review Modal */}
      <PostStayReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        propertyName="The Grand Auckland"
        onSubmit={handleReviewSubmit}
      />
    </div>
  );
}
