import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Inbox, Clock, CheckCircle2, Users, CalendarDays, Plus, RefreshCw, SlidersHorizontal, ClipboardCheck, ClipboardList, X, Download, RotateCcw, Trophy, Send, DollarSign, Percent, Zap, BedDouble, Circle, Rocket, Image as ImageIcon } from 'lucide-react';
import { exportBookingsXlsx, exportBookingsPdf, ReportRow } from '@/lib/bookingReports';
import WeatherTiles from '@/components/explore/WeatherTiles';
import { useTileOrder } from '@/hooks/useTileOrder';

interface FsOffer {
  id: string;
  listing_id: string;
  listing_room_id: string;
  nightly_offer: number;
  total_offer: number;
  nights: number;
  adults: number;
  children: number;
  check_in: string;
  check_out: string;
  message: string | null;
  status: string;
  counter_nightly: number | null;
  confirm_deadline_at: string | null;
  booking_number: string | null;
  entered_at: string | null;
  created_at: string;
  room?: { room_name: string | null } | null;
  listing?: { name: string | null; city: string | null; country: string | null } | null;
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
const countdown = (deadline: string | null): string => {
  if (!deadline) return '';
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m left` : `${m}m left`;
};

/** An offer that needs a response: Accept / Counter / Decline. */
function PendingOfferCard({ offer, currency, busy, onRespond }: {
  offer: FsOffer; currency: string; busy: boolean;
  onRespond: (id: string, action: 'accept' | 'counter' | 'decline', counter?: number) => void;
}) {
  const [showCounter, setShowCounter] = useState(false);
  const [counter, setCounter] = useState(String(Math.round(offer.nightly_offer + 15)));
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{offer.room?.room_name || 'Room'}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(offer.check_in)}–{fmtDate(offer.check_out)} · {offer.nights}n</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {offer.adults + offer.children}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">{currency} ${Math.round(offer.nightly_offer)}</p>
          <p className="text-[11px] text-muted-foreground">/night · {currency} ${Math.round(offer.total_offer)} total</p>
        </div>
      </div>
      {offer.message && <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">“{offer.message}”</p>}
      {!showCounter ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" disabled={busy} onClick={() => onRespond(offer.id, 'accept')}>Accept</Button>
          <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => setShowCounter(true)}>Counter</Button>
          <Button size="sm" variant="ghost" className="flex-1 text-muted-foreground" disabled={busy} onClick={() => onRespond(offer.id, 'decline')}>Decline</Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="text-xs font-medium text-foreground">Your counter ({currency}/night)</label>
          <div className="flex gap-2">
            <Input type="number" value={counter} onChange={(e) => setCounter(e.target.value)} className="h-9" min={20} />
            <Button size="sm" className="h-9" disabled={busy} onClick={() => onRespond(offer.id, 'counter', parseFloat(counter))}>Send counter</Button>
            <Button size="sm" variant="ghost" className="h-9" disabled={busy} onClick={() => setShowCounter(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

interface Readiness {
  listing: any; approved: boolean; totalRooms: number; pricedRooms: number;
  roomsWithAuto: number; allPriced: boolean; published: boolean; ready: boolean;
}

/** Per-property setup + go-live control with a content-review confirmation. */
function ReadinessCard({ r, busy, onGoLive, onTakeOffline }: {
  r: Readiness; busy: boolean;
  onGoLive: (id: string) => void; onTakeOffline: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const l = r.listing;
  const checks = [
    { ok: r.approved, label: r.approved ? 'Property approved' : 'Awaiting approval', sub: l.name },
    { ok: r.totalRooms > 0, label: r.totalRooms > 0 ? `${r.totalRooms} room${r.totalRooms === 1 ? '' : 's'} detected` : 'No rooms imported', sub: r.totalRooms > 0 ? 'From your property content' : 'Import rooms on the pricing page' },
    { ok: r.allPriced, label: r.allPriced ? 'All rooms priced' : `${r.pricedRooms} of ${r.totalRooms || '—'} rooms priced`, sub: r.allPriced ? 'Guide price on every room' : 'Set a guide price on each room' },
  ];
  return (
    <div className={cn('rounded-2xl border p-4 sm:p-5', r.published ? 'border-success/30 bg-success/[0.06]' : 'border-amber-300/50 bg-amber-50')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', r.published ? 'bg-success' : 'bg-amber-500')} />
            <h3 className="font-display text-lg font-bold text-foreground">{l.name}</h3>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', r.published ? 'bg-success/15 text-success' : 'bg-amber-200/70 text-amber-800')}>{r.published ? 'Live' : 'Not live'}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {r.published ? 'Travellers can find you in search and make offers.' : 'Travellers only see you once you review your content and go live.'}
          </p>
        </div>
        <div className="flex flex-none gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link to="/business/content"><ImageIcon className="h-4 w-4" /> Rooms & photos</Link>
          </Button>
          {!r.published && !r.ready && (
            <Button size="sm" className="gap-1.5 bg-[#0C1A22] text-white hover:bg-[#0C1A22]/90" asChild>
              <Link to="/business/pricing"><SlidersHorizontal className="h-4 w-4" /> Set prices</Link>
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/70 p-3">
            {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" /> : <Circle className="mt-0.5 h-4 w-4 flex-none text-amber-500" />}
            <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{c.label}</p><p className="truncate text-xs text-muted-foreground">{c.sub}</p></div>
          </div>
        ))}
      </div>
      {r.totalRooms > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{r.roomsWithAuto} of {r.totalRooms} rooms also have an auto-accept / floor price (optional — lets offers confirm instantly).</p>
      )}
      <div className="mt-3 border-t border-border/50 pt-3">
        {r.published ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-success"><CheckCircle2 className="mr-1 inline h-4 w-4" /> Published and visible to travellers.</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onTakeOffline(l.id)}>Take offline</Button>
          </div>
        ) : !confirming ? (
          <>
            <Button size="sm" disabled={!r.ready || busy} className="gap-1.5 bg-success text-white hover:bg-success/90 disabled:opacity-50" onClick={() => setConfirming(true)}>
              <Rocket className="h-4 w-4" /> Go live
            </Button>
            {!r.ready && <p className="mt-2 text-xs text-muted-foreground">Go live unlocks once your property is approved and every room has a price.</p>}
          </>
        ) : (
          <div className="space-y-2.5">
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none" />
              <span>I've reviewed my rooms, photos, details and prices for <strong>{l.name}</strong> and confirm they're correct.</span>
            </label>
            <div className="flex gap-2">
              <Button size="sm" disabled={!reviewed || busy} className="gap-1.5 bg-success text-white hover:bg-success/90 disabled:opacity-50" onClick={() => onGoLive(l.id)}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Rocket className="h-4 w-4" /> Publish — go live</>}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setConfirming(false); setReviewed(false); }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  declined: 'Declined', expired: 'Expired', withdrawn: 'Withdrawn by guest',
};

type Filter = null | 'pending' | 'awaiting' | 'confirmed' | 'to_enter' | 'entered';

export default function BusinessDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [listings, setListings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [offers, setOffers] = useState<FsOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filter, setFilter] = useState<Filter>(null);
  const [period, setPeriod] = useState<'month' | '6mo' | 'ytd'>('month');
  const [bandColor, setBandColor] = useState<'yellow' | 'orange' | 'navy'>(() => {
    try { return (localStorage.getItem('fs_band_biz') as any) || 'navy'; } catch { return 'navy'; }
  });
  const pickBand = (c: 'yellow' | 'orange' | 'navy') => {
    setBandColor(c);
    try { localStorage.setItem('fs_band_biz', c); } catch { /* ignore */ }
  };
  const BAND_BG: Record<string, string> = { yellow: '#FBEFC9', orange: '#F7D6B6', navy: '#1E2A4A' };
  const navy = bandColor === 'navy';
  const { order: tileOrder, reset: resetTiles, dragProps } = useTileOrder('fs_biz_tiles', ['pending', 'awaiting', 'confirmed', 'to_enter', 'entered']);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: myListings } = await supabase
      .from('fs_listings').select('id,name,city,country,status,auto_accept_enabled,published_at,content_reviewed_at').eq('owner_id', user.id);
    const ls = (myListings as any[]) || [];
    setListings(ls);
    if (ls.length === 0) { setOffers([]); setRooms([]); setLoading(false); return; }
    const ids = ls.map((l) => l.id);
    const [{ data: off }, { data: rms }, { data: thr }] = await Promise.all([
      supabase
        .from('fs_offers')
        .select('id,listing_id,listing_room_id,nightly_offer,total_offer,nights,adults,children,check_in,check_out,message,status,counter_nightly,confirm_deadline_at,booking_number,entered_at,created_at,room:fs_listing_rooms(room_name),listing:fs_listings(name,city,country)')
        .in('listing_id', ids)
        .order('created_at', { ascending: false }),
      supabase.from('fs_listing_rooms').select('id,listing_id,room_name,base_guide,sort_order').in('listing_id', ids),
      supabase.from('fs_room_thresholds').select('listing_room_id,base_auto,base_floor'),
    ]);
    setOffers(((off as any[]) || []) as FsOffer[]);
    const thrById = new Map((((thr as any[]) || [])).map((t) => [t.listing_room_id, t]));
    const roomRows = (((rms as any[]) || [])).map((r) => ({
      ...r,
      base_auto: thrById.get(r.id)?.base_auto ?? null,
      base_floor: thrById.get(r.id)?.base_floor ?? null,
    }));
    roomRows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    setRooms(roomRows);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggleAutoAccept = async (listingId: string, next: boolean) => {
    setTogglingId(listingId);
    setListings((ls) => ls.map((l) => (l.id === listingId ? { ...l, auto_accept_enabled: next } : l)));
    const { error } = await supabase.from('fs_listings').update({ auto_accept_enabled: next } as any).eq('id', listingId);
    setTogglingId(null);
    if (error) {
      setListings((ls) => ls.map((l) => (l.id === listingId ? { ...l, auto_accept_enabled: !next } : l)));
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: next ? 'Auto-accept on' : 'Auto-accept off', description: next ? 'Offers at or above your auto price confirm instantly.' : 'Every offer now waits for your response.' });
  };

  const goLive = async (listingId: string) => {
    setTogglingId(listingId);
    const { data, error } = await supabase.rpc('fs_set_live', { p_listing: listingId } as any);
    setTogglingId(null);
    if (error) { toast({ title: 'Not live yet', description: error.message || 'Check your rooms and prices first.', variant: 'destructive' }); return; }
    setListings((ls) => ls.map((l) => (l.id === listingId ? { ...l, published_at: data || new Date().toISOString(), content_reviewed_at: new Date().toISOString() } : l)));
    toast({ title: 'Your business is now live 🎉', description: 'Travellers can find you in search and make offers.' });
  };

  const takeOffline = async (listingId: string) => {
    setTogglingId(listingId);
    const { error } = await supabase.rpc('fs_set_offline', { p_listing: listingId } as any);
    setTogglingId(null);
    if (error) { toast({ title: 'Could not update', description: error.message, variant: 'destructive' }); return; }
    setListings((ls) => ls.map((l) => (l.id === listingId ? { ...l, published_at: null } : l)));
    toast({ title: 'Taken offline', description: 'Your property is hidden from search until you go live again.' });
  };

  const respond = async (id: string, action: 'accept' | 'counter' | 'decline', counter?: number) => {
    setBusyId(id);
    const { error } = await supabase.rpc('fs_business_respond', { p_offer: id, p_action: action, p_counter: counter ?? null } as any);
    setBusyId(null);
    if (error) { toast({ title: 'Could not respond', description: error.message || 'Please try again', variant: 'destructive' }); return; }
    toast({ title: action === 'accept' ? 'Offer accepted' : action === 'counter' ? 'Counter sent' : 'Offer declined', description: action === 'decline' ? undefined : 'The guest has 1 hour to confirm.' });
    load();
  };

  const markEntered = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc('fs_mark_entered', { p_offer: id } as any);
    setBusyId(null);
    if (error) { toast({ title: 'Could not update', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Marked as entered' });
    load();
  };

  const currencyFor = (o: FsOffer) => (o.listing?.country === 'AU' ? 'AUD' : 'NZD');

  // Analytics period (by when the offer came in)
  const now = new Date();
  const periodSince =
    period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === '6mo' ? new Date(Date.now() - 182 * 864e5)
    : new Date(now.getFullYear(), 0, 1); // ytd
  const sinceISO = periodSince.toISOString().slice(0, 10);
  const inRange = (o: FsOffer) => (o.created_at || '').slice(0, 10) >= sinceISO;
  const scope = offers.filter(inRange);

  const pending = scope.filter((o) => o.status === 'pending');
  const awaiting = scope.filter((o) => o.status === 'accepted_pending_confirm' || o.status === 'countered');
  const confirmed = scope.filter((o) => o.status === 'confirmed');
  const toEnter = confirmed.filter((o) => !o.entered_at);
  const entered = confirmed.filter((o) => !!o.entered_at);
  const history = scope.filter((o) => ['declined', 'expired', 'withdrawn'].includes(o.status));

  // Analytics for the selected period
  const revenue = confirmed.reduce((s, o) => s + (o.total_offer || 0), 0);
  const acceptanceRate = scope.length ? Math.round((confirmed.length / scope.length) * 100) : 0;
  const nightsSold = confirmed.reduce((s, o) => s + (o.nights || 0), 0);
  const avgNightly = confirmed.length ? Math.round(confirmed.reduce((s, o) => s + (o.nightly_offer || 0), 0) / confirmed.length) : 0;
  const avgStay = confirmed.length ? (confirmed.reduce((s, o) => s + (o.nights || 0), 0) / confirmed.length) : 0;
  const declinedCount = scope.filter((o) => o.status === 'declined').length;
  const todayISO = new Date().toISOString().slice(0, 10);
  const receivedToday = offers.filter((o) => (o.created_at || '').slice(0, 10) === todayISO).length;
  const curSym = listings[0]?.country === 'AU' ? 'A$' : 'NZ$';
  const periodLabel = period === 'month' ? 'This month' : period === '6mo' ? 'Last 6 months' : 'Year to date';

  // Room performance — rank every room by bookings sold (confirmed), with nights + revenue.
  const roomPerf = rooms.map((r) => {
    const sold = confirmed.filter((o) => o.listing_room_id === r.id);
    return {
      id: r.id,
      name: r.room_name || 'Room',
      listingId: r.listing_id,
      priced: r.base_guide != null,
      bookings: sold.length,
      nights: sold.reduce((s, o) => s + (o.nights || 0), 0),
      revenue: sold.reduce((s, o) => s + (o.total_offer || 0), 0),
    };
  }).sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue);
  const topBookings = roomPerf[0]?.bookings || 0;

  // Go-live readiness — per property. "Live" = approved + every room priced + owner published.
  const listingReadiness = listings.map((l) => {
    const lr = rooms.filter((r) => r.listing_id === l.id);
    const priced = lr.filter((r) => r.base_guide != null).length;
    const withAuto = lr.filter((r) => r.base_auto != null || r.base_floor != null).length;
    return {
      listing: l,
      approved: l.status === 'active',
      totalRooms: lr.length,
      pricedRooms: priced,
      roomsWithAuto: withAuto,
      allPriced: lr.length > 0 && priced === lr.length,
      published: !!l.published_at,
      ready: l.status === 'active' && lr.length > 0 && priced === lr.length,
    };
  });

  // The approved-bookings list the view (and any export) is showing.
  const bookingList = filter === 'to_enter' ? toEnter : filter === 'entered' ? entered : confirmed;

  const doExport = (kind: 'xlsx' | 'pdf') => {
    const rows: ReportRow[] = bookingList.map((o) => {
      const cur = currencyFor(o);
      const fee = cur === 'AUD' ? 12 : 8.99;
      return {
        ref: o.booking_number || '—',
        property: o.listing?.name || '',
        room: o.room?.room_name || '',
        checkIn: o.check_in,
        checkOut: o.check_out,
        nights: o.nights,
        guests: o.adults + o.children,
        currency: cur,
        nightly: Math.round(o.nightly_offer),
        total: Math.round(o.total_offer),
        fee,
        entered: o.entered_at ? `Yes (${fmtDate(o.entered_at)})` : 'No',
        confirmed: fmtDate(o.created_at),
      };
    });
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'No bookings in this view.' });
      return;
    }
    const nameSlug = (listings[0]?.name || 'findastay').replace(/[^\w]+/g, '-');
    const range = from || to ? `${from || 'start'}_${to || 'now'}` : 'all';
    const base = `${nameSlug}-bookings-${range}`;
    const title = `${listings.map((l) => l.name).join(', ')} — bookings`;
    const subtitle = `Check-in ${from || 'earliest'} to ${to || 'latest'}`;
    if (kind === 'xlsx') exportBookingsXlsx(rows, base);
    else exportBookingsPdf(rows, title, subtitle, base);
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (listings.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">No property claimed yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Claim your property to start setting prices and receiving offers.</p>
        <Button className="mt-5" onClick={() => navigate('/business/claim')}><Plus className="mr-2 h-4 w-4" /> Claim your property</Button>
      </div>
    );
  }

  const Tile = ({ id, label, count, tone }: { id: Filter; label: string; count: number; tone?: 'alert' | 'success' | 'default' }) => (
    <button
      onClick={() => setFilter(filter === id ? null : id)}
      className={cn(
        'rounded-xl border p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_-14px_rgba(8,22,30,.45)]',
        filter === id ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary/50',
        'bg-card',
      )}
    >
      <p className={cn('text-2xl font-bold', tone === 'alert' ? 'text-red-500' : tone === 'success' ? 'text-success' : 'text-foreground')}>{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  );

  const BookingRow = ({ o }: { o: FsOffer }) => {
    const cur = currencyFor(o);
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{o.room?.room_name || 'Room'}</p>
            {o.booking_number && <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{o.booking_number}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{fmtDate(o.check_in)}–{fmtDate(o.check_out)} · {o.nights}n · {o.adults + o.children} guests · {cur} ${Math.round(o.nightly_offer)}/night</p>
        </div>
        {o.entered_at ? (
          <Badge variant="secondary" className="bg-success/10 text-success border-success/20 gap-1"><ClipboardCheck className="h-3.5 w-3.5" /> Entered</Badge>
        ) : (
          <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => markEntered(o.id)}>
            {busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ClipboardList className="mr-1.5 h-4 w-4" /> Mark as entered</>}
          </Button>
        )}
      </Card>
    );
  };

  const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">{icon} {title}</h2>
      {children}
    </section>
  );

  const Empty = ({ text }: { text: string }) => (
    <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{text}</p>
  );

  // Which sections to show given the tile filter
  const show = (id: Exclude<Filter, null>) => filter === null || filter === id;

  return (
    <>
      {/* Template band — business name, analytics period, weather, change-the-look */}
      <div style={{ backgroundColor: BAND_BG[bandColor] }}>
        <div className="mx-auto w-full max-w-3xl px-4 pb-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn('font-mono text-[0.65rem] uppercase tracking-[0.18em]', navy ? 'text-white/70' : 'text-foreground/70')}>Your business</p>
              <h1 className={cn('font-display text-3xl font-extrabold tracking-tight md:text-4xl', navy ? 'text-white' : 'text-foreground')}>{listings.map((l) => l.name).join(' · ')}</h1>
              <div className="mt-1.5 flex items-center gap-2 text-sm">
                <span className={navy ? 'text-white/80' : 'text-muted-foreground'}>Analytics</span>
                <select value={period} onChange={(e) => setPeriod(e.target.value as any)} className="rounded-lg border border-black/10 bg-white px-2.5 py-1 text-sm font-semibold text-foreground">
                  <option value="month">This month</option>
                  <option value="6mo">Last 6 months</option>
                  <option value="ytd">Year to date</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2.5">
              <div className={cn('flex items-center gap-2 text-xs font-semibold', navy ? 'text-white/85' : 'text-muted-foreground')}>
                Change the look
                {(['yellow', 'orange', 'navy'] as const).map((c) => (
                  <button key={c} type="button" onClick={() => pickBand(c)} aria-label={c}
                    className={cn('h-5 w-5 rounded-full border-2 border-black/10', bandColor === c && (navy ? 'outline outline-2 outline-white' : 'outline outline-2 outline-foreground'))}
                    style={{ backgroundColor: BAND_BG[c] }} />
                ))}
                <button type="button" onClick={() => { pickBand('navy'); resetTiles(); }} title="Reset look & tile layout to default"
                  className={cn('ml-1 inline-flex items-center gap-1 rounded-md border px-2 py-1', navy ? 'border-white/30 text-white/80' : 'border-black/15 text-muted-foreground')}>
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1.5 h-4 w-4" /> Refresh</Button>
                <Button variant="outline" size="sm" asChild><Link to="/business/pricing"><SlidersHorizontal className="mr-1.5 h-4 w-4" /> Pricing</Link></Button>
              </div>
            </div>
          </div>
          <div className="mt-4"><WeatherTiles /></div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">

      {/* Go-live readiness — per property, real data + publish control */}
      <section className="mb-6 space-y-3">
        {listingReadiness.map((r) => (
          <ReadinessCard key={r.listing.id} r={r} busy={togglingId === r.listing.id} onGoLive={goLive} onTakeOffline={takeOffline} />
        ))}
      </section>

      {/* Controls — flash on/off toggles per property */}
      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><Zap className="h-4 w-4" /> Controls</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {listings.map((l) => {
            const on = !!l.auto_accept_enabled;
            return (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{l.name}</p>
                  <p className="text-xs text-muted-foreground">Auto-accept offers at/above your auto price</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  disabled={togglingId === l.id}
                  onClick={() => toggleAutoAccept(l.id, !on)}
                  className={cn('relative inline-flex h-7 w-12 flex-none items-center rounded-full transition-colors', on ? 'bg-success' : 'bg-muted-foreground/30', togglingId === l.id && 'opacity-60')}
                >
                  <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', on ? 'translate-x-6' : 'translate-x-1')} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Analytics */}
      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-display text-lg font-bold text-foreground">Analytics</h2>
          <span className="text-sm text-muted-foreground">· {periodLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <Send className="h-4 w-4 text-primary" />, value: scope.length, label: 'Offers received' },
            { icon: <CheckCircle2 className="h-4 w-4 text-success" />, value: confirmed.length, label: 'Bookings confirmed' },
            { icon: <Percent className="h-4 w-4 text-primary" />, value: `${acceptanceRate}%`, label: 'Acceptance rate' },
            { icon: <DollarSign className="h-4 w-4 text-primary" />, value: `${curSym}${Math.round(revenue).toLocaleString()}`, label: 'Confirmed revenue' },
            { icon: <CalendarDays className="h-4 w-4 text-primary" />, value: nightsSold, label: 'Nights sold' },
            { icon: <DollarSign className="h-4 w-4 text-primary" />, value: `${curSym}${avgNightly}`, label: 'Avg nightly rate' },
            { icon: <Clock className="h-4 w-4 text-primary" />, value: avgStay ? `${avgStay.toFixed(1)}n` : '—', label: 'Avg length of stay' },
            { icon: <X className="h-4 w-4 text-muted-foreground" />, value: declinedCount, label: 'Declined' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_-14px_rgba(8,22,30,.45)]">
              {s.icon}
              <p className="mt-2 font-display text-2xl font-extrabold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Today: <span className="font-semibold text-foreground">{receivedToday}</span> new offer{receivedToday === 1 ? '' : 's'} received.</p>

        {/* Ranking — UI now, live data wired later */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">Your ranking in {listings[0]?.city || 'your area'}</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-foreground">#— <span className="text-base font-medium text-muted-foreground">of all local properties</span></p>
            <p className="mt-0.5 text-xs text-muted-foreground">Where travellers rank you across every search in your town — live ranking coming soon.</p>
          </div>
          <div className="hidden h-12 w-12 flex-none place-items-center rounded-full bg-primary/10 text-primary sm:grid"><Trophy className="h-6 w-6" /></div>
        </div>

        {/* Room performance — ranked by bookings sold (real data) */}
        <div className="mt-3 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Most popular rooms</p>
            <span className="text-xs text-muted-foreground">· {periodLabel}</span>
          </div>
          {roomPerf.length === 0 ? (
            <p className="text-sm text-muted-foreground">Rooms appear here once imported. Confirmed bookings rank them.</p>
          ) : (
            <div className="space-y-2">
              {roomPerf.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3">
                  <span className={cn('flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold', i === 0 && r.bookings > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.name}
                        {!r.priced && <span className="ml-2 align-middle text-[11px] font-semibold text-amber-600">no price set</span>}
                      </p>
                      <p className="flex-none text-sm font-semibold text-foreground">{r.bookings} <span className="text-xs font-normal text-muted-foreground">sold</span></p>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${topBookings ? (r.bookings / topBookings) * 100 : 0}%` }} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{r.nights} nights · {curSym}{Math.round(r.revenue).toLocaleString()} revenue</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Tally tiles — click to filter, drag to rearrange */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tileOrder.map((id) => {
          const cfg: Record<string, { label: string; count: number; tone?: 'alert' | 'success' | 'default' }> = {
            pending: { label: 'Need response', count: pending.length, tone: pending.length ? 'alert' : 'default' },
            awaiting: { label: 'Awaiting guest', count: awaiting.length },
            confirmed: { label: 'Confirmed', count: confirmed.length, tone: 'success' },
            to_enter: { label: 'To enter', count: toEnter.length, tone: toEnter.length ? 'alert' : 'default' },
            entered: { label: 'Entered', count: entered.length },
          };
          const c = cfg[id];
          if (!c) return null;
          return (
            <div key={id} {...dragProps(id)} className="cursor-grab active:cursor-grabbing">
              <Tile id={id as Filter} label={c.label} count={c.count} tone={c.tone} />
            </div>
          );
        })}
      </div>

      {/* Clear filter + exports */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {filter && (
          <Button variant="ghost" size="sm" onClick={() => setFilter(null)}>
            <X className="mr-1 h-4 w-4" /> Clear filter
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => doExport('xlsx')} disabled={bookingList.length === 0} title="Export bookings to Excel">
          <Download className="mr-1.5 h-4 w-4" /> XLSX
        </Button>
        <Button variant="outline" size="sm" onClick={() => doExport('pdf')} disabled={bookingList.length === 0} title="Export bookings to PDF">
          <Download className="mr-1.5 h-4 w-4" /> PDF
        </Button>
      </div>

      {show('pending') && (
        <Section title="Needs your response" icon={<Inbox className="h-4 w-4" />}>
          {pending.length === 0 ? <Empty text="No offers waiting. New offers between your floor and auto-accept price appear here." /> : (
            <div className="space-y-3">{pending.map((o) => <PendingOfferCard key={o.id} offer={o} currency={currencyFor(o)} busy={busyId === o.id} onRespond={respond} />)}</div>
          )}
        </Section>
      )}

      {show('awaiting') && awaiting.length > 0 && (
        <Section title="Awaiting guest confirmation" icon={<Clock className="h-4 w-4" />}>
          <div className="space-y-2">
            {awaiting.map((o) => (
              <Card key={o.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{o.room?.room_name || 'Room'}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.check_in)}–{fmtDate(o.check_out)} · {o.status === 'countered' ? `Countered ${currencyFor(o)} $${Math.round(o.counter_nightly || 0)}` : `Accepted ${currencyFor(o)} $${Math.round(o.nightly_offer)}`}</p>
                </div>
                <Badge variant="outline" className="flex-shrink-0 text-xs">{countdown(o.confirm_deadline_at)}</Badge>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* Approved bookings — confirmed, with mark-as-entered */}
      {(show('confirmed') || show('to_enter') || show('entered')) && (
        <Section title="Approved bookings" icon={<CheckCircle2 className="h-4 w-4" />}>
          {bookingList.length === 0
            ? <Empty text="Confirmed bookings appear here with their reference. Tick each once you've entered it in your own system." />
            : <div className="space-y-2">{bookingList.map((o) => <BookingRow key={o.id} o={o} />)}</div>}
        </Section>
      )}

      {filter === null && history.length > 0 && (
        <Section title="History" icon={<Clock className="h-4 w-4" />}>
          <div className="space-y-2">
            {history.map((o) => (
              <Card key={o.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{o.room?.room_name || 'Room'}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.check_in)}–{fmtDate(o.check_out)} · {currencyFor(o)} ${Math.round(o.nightly_offer)}/night</p>
                </div>
                <Badge variant="outline" className="flex-shrink-0 text-muted-foreground">{STATUS_LABEL[o.status] || o.status}</Badge>
              </Card>
            ))}
          </div>
        </Section>
      )}
    </div>
    </>
  );
}
