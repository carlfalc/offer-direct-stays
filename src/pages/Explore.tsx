import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTrip } from '@/contexts/TripContext';
import { supabase } from '@/integrations/supabase/client';
import { searchListings } from '@/lib/listings';
import { Property, ChatMessage, ShortlistItem, Room } from '@/types';
import ChatPanel from '@/components/explore/ChatPanel';
import MapPanel from '@/components/explore/MapPanel';
import ShortlistPanel from '@/components/explore/ShortlistPanel';
import TripSummaryBar from '@/components/explore/TripSummaryBar';
import PropertyDetailSheet from '@/components/explore/PropertyDetailSheet';
import OfferModal from '@/components/explore/OfferModal';
import { PostStayReviewModal, ReviewPayload } from '@/components/review';
import { Button } from '@/components/ui/button';
import { MapPin, LogOut, Menu, Heart, Plane, Star, Map as MapIcon, List } from 'lucide-react';
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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Demo: Post-stay review trigger button (floating) */}
      <button
        onClick={() => setReviewModalOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-gold to-gold/80 text-charcoal font-medium shadow-lg hover:shadow-xl hover:shadow-gold/20 transition-all duration-300"
      >
        <Star className="w-4 h-4" />
        <span className="hidden sm:inline">Demo Review</span>
      </button>

      {/* Trip Summary Bar */}
      <TripSummaryBar />

      {/* Main content - list-first; map is on-demand and lazy-mounted */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left: chat/results — hidden on mobile while the map is open */}
        {(!isMobile || !mobileMapOpen) && (
          <div
            className={cn(
              'flex flex-col overflow-hidden border-r border-border/50',
              isMobile ? 'flex-1 w-full' : 'flex-none w-[520px] xl:w-[600px] 2xl:w-[640px]',
            )}
          >
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                onPropertySelect={handlePropertySelect}
                onMakeOffer={handleMakeOffer}
                onAddToWatchlist={handleAddToWatchlist}
                shortlistedIds={shortlistedIds}
                watchlistedIds={watchlistedIds}
                tone={tone}
                onToneChange={setTone}
              />
            </div>
            <div className="flex-shrink-0">
              <ShortlistPanel
                items={shortlist}
                onRemove={handleRemoveFromShortlist}
                onMakeOffer={(p) => handleMakeOffer(p)}
                sentOfferIds={sentOfferIds}
              />
            </div>
          </div>
        )}

        {/* Map — desktop always; mobile only when toggled. Mounted only when visible, so
            Mapbox never initialises (and never costs a map load) for list-only users. */}
        {(!isMobile || mobileMapOpen) && (
          <div className="flex-1 relative min-w-0">
            <MapPanel
              properties={visibleProperties}
              selectedPropertyId={selectedPropertyId}
              shortlistedIds={shortlistedIds}
              watchlistedIds={watchlistedIds}
              onPropertySelect={handlePropertySelect}
              onPropertyClick={handlePropertyPinClick}
              mapboxToken={mapboxToken}
              onTokenChange={setMapboxToken}
            />
            {isMobile && (
              <Button onClick={() => setMobileMapOpen(false)} size="sm" className="absolute top-4 left-4 z-20 shadow-lg gap-2">
                <List className="h-4 w-4" /> List
              </Button>
            )}
          </div>
        )}

        {/* Mobile "Map" toggle while viewing the list */}
        {isMobile && !mobileMapOpen && (
          <Button
            onClick={() => setMobileMapOpen(true)}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 rounded-full px-5 shadow-xl gap-2"
          >
            <MapIcon className="h-4 w-4" /> Map
          </Button>
        )}
      </div>

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
        initialAdults={trip.adults}
        initialChildren={trip.children}
        initialCheckIn={trip.checkIn}
        initialCheckOut={trip.checkOut}
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
