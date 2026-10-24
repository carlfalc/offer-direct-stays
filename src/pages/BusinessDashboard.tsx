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
import { Loader2, Inbox, Clock, CheckCircle2, Users, CalendarDays, Plus, RefreshCw, SlidersHorizontal, ClipboardCheck, ClipboardList, X } from 'lucide-react';

interface FsOffer {
  id: string;
  listing_id: string;
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

const STATUS_LABEL: Record<string, string> = {
  declined: 'Declined', expired: 'Expired', withdrawn: 'Withdrawn by guest',
};

type Filter = null | 'pending' | 'awaiting' | 'confirmed' | 'to_enter' | 'entered';

export default function BusinessDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [listings, setListings] = useState<any[]>([]);
  const [offers, setOffers] = useState<FsOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filter, setFilter] = useState<Filter>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: myListings } = await supabase
      .from('fs_listings').select('id,name,city,country,status,auto_accept_enabled').eq('owner_id', user.id);
    const ls = (myListings as any[]) || [];
    setListings(ls);
    if (ls.length === 0) { setOffers([]); setLoading(false); return; }
    const ids = ls.map((l) => l.id);
    const { data: off } = await supabase
      .from('fs_offers')
      .select('id,listing_id,nightly_offer,total_offer,nights,adults,children,check_in,check_out,message,status,counter_nightly,confirm_deadline_at,booking_number,entered_at,created_at,room:fs_listing_rooms(room_name),listing:fs_listings(name,city,country)')
      .in('listing_id', ids)
      .order('created_at', { ascending: false });
    setOffers(((off as any[]) || []) as FsOffer[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

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

  // Date filter (by check-in)
  const inRange = (o: FsOffer) => (!from || o.check_in >= from) && (!to || o.check_in <= to);
  const scope = offers.filter(inRange);

  const pending = scope.filter((o) => o.status === 'pending');
  const awaiting = scope.filter((o) => o.status === 'accepted_pending_confirm' || o.status === 'countered');
  const confirmed = scope.filter((o) => o.status === 'confirmed');
  const toEnter = confirmed.filter((o) => !o.entered_at);
  const entered = confirmed.filter((o) => !!o.entered_at);
  const history = scope.filter((o) => ['declined', 'expired', 'withdrawn'].includes(o.status));

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
        'rounded-xl border p-3 text-center transition',
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Business dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{listings.map((l) => l.name).join(' · ')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1.5 h-4 w-4" /> Refresh</Button>
          <Button variant="outline" size="sm" asChild><Link to="/business/pricing"><SlidersHorizontal className="mr-1.5 h-4 w-4" /> Pricing</Link></Button>
        </div>
      </div>

      {/* Tally tiles — click to filter */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile id="pending" label="Need response" count={pending.length} tone={pending.length ? 'alert' : 'default'} />
        <Tile id="awaiting" label="Awaiting guest" count={awaiting.length} />
        <Tile id="confirmed" label="Confirmed" count={confirmed.length} tone="success" />
        <Tile id="to_enter" label="To enter" count={toEnter.length} tone={toEnter.length ? 'alert' : 'default'} />
        <Tile id="entered" label="Entered" count={entered.length} />
      </div>

      {/* Date filter */}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <div>
          <label className="text-xs text-muted-foreground">Check-in from</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">to</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 w-40" />
        </div>
        {(from || to || filter) && (
          <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); setFilter(null); }}>
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
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
          {(() => {
            const list = filter === 'to_enter' ? toEnter : filter === 'entered' ? entered : confirmed;
            return list.length === 0
              ? <Empty text="Confirmed bookings appear here with their reference. Tick each once you've entered it in your own system." />
              : <div className="space-y-2">{list.map((o) => <BookingRow key={o.id} o={o} />)}</div>;
          })()}
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
  );
}
