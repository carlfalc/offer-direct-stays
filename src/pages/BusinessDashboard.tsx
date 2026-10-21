import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Inbox, Clock, CheckCircle2, Users, CalendarDays, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';

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
  created_at: string;
  room?: { room_name: string | null } | null;
  listing?: { name: string | null; city: string | null; country: string | null } | null;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });

function countdown(deadline: string | null): string {
  if (!deadline) return '';
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m left` : `${m}m left`;
}

/** One offer that needs a response: Accept / Counter / Decline. */
function PendingOfferCard({
  offer,
  currency,
  busy,
  onRespond,
}: {
  offer: FsOffer;
  currency: string;
  busy: boolean;
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
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {fmtDate(offer.check_in)}–{fmtDate(offer.check_out)} · {offer.nights}n
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {offer.adults + offer.children}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">{currency} ${Math.round(offer.nightly_offer)}</p>
          <p className="text-[11px] text-muted-foreground">/night · {currency} ${Math.round(offer.total_offer)} total</p>
        </div>
      </div>

      {offer.message && (
        <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">“{offer.message}”</p>
      )}

      {!showCounter ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" disabled={busy} onClick={() => onRespond(offer.id, 'accept')}>
            Accept
          </Button>
          <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => setShowCounter(true)}>
            Counter
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 text-muted-foreground" disabled={busy} onClick={() => onRespond(offer.id, 'decline')}>
            Decline
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="text-xs font-medium text-foreground">Your counter ({currency}/night)</label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={counter}
              onChange={(e) => setCounter(e.target.value)}
              className="h-9"
              min={20}
            />
            <Button size="sm" className="h-9" disabled={busy} onClick={() => onRespond(offer.id, 'counter', parseFloat(counter))}>
              Send counter
            </Button>
            <Button size="sm" variant="ghost" className="h-9" disabled={busy} onClick={() => setShowCounter(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const STATUS_LABEL: Record<string, string> = {
  accepted_pending_confirm: 'Accepted — awaiting guest',
  countered: 'Countered — awaiting guest',
  confirmed: 'Confirmed booking',
  declined: 'Declined',
  expired: 'Expired',
  withdrawn: 'Withdrawn by guest',
};

export default function BusinessDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [listings, setListings] = useState<any[]>([]);
  const [offers, setOffers] = useState<FsOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: myListings } = await supabase
      .from('fs_listings')
      .select('id,name,city,country,status,auto_accept_enabled')
      .eq('owner_id', user.id);
    const ls = (myListings as any[]) || [];
    setListings(ls);
    if (ls.length === 0) {
      setOffers([]);
      setLoading(false);
      return;
    }
    const ids = ls.map((l) => l.id);
    const { data: off } = await supabase
      .from('fs_offers')
      .select(
        'id,listing_id,nightly_offer,total_offer,nights,adults,children,check_in,check_out,message,status,counter_nightly,confirm_deadline_at,created_at,room:fs_listing_rooms(room_name),listing:fs_listings(name,city,country)',
      )
      .in('listing_id', ids)
      .order('created_at', { ascending: false });
    setOffers(((off as any[]) || []) as FsOffer[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (id: string, action: 'accept' | 'counter' | 'decline', counter?: number) => {
    setBusyId(id);
    const { error } = await supabase.rpc('fs_business_respond', {
      p_offer: id,
      p_action: action,
      p_counter: counter ?? null,
    } as any);
    setBusyId(null);
    if (error) {
      toast({ title: 'Could not respond', description: error.message || 'Please try again', variant: 'destructive' });
      return;
    }
    toast({
      title: action === 'accept' ? 'Offer accepted' : action === 'counter' ? 'Counter sent' : 'Offer declined',
      description: action === 'decline' ? undefined : 'The guest has 1 hour to confirm.',
    });
    load();
  };

  const currencyFor = (o: FsOffer) => (o.listing?.country === 'AU' ? 'AUD' : 'NZD');

  const pending = offers.filter((o) => o.status === 'pending');
  const awaiting = offers.filter((o) => o.status === 'accepted_pending_confirm' || o.status === 'countered');
  const history = offers.filter((o) => ['confirmed', 'declined', 'expired', 'withdrawn'].includes(o.status));
  const confirmedCount = offers.filter((o) => o.status === 'confirmed').length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">No property claimed yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Claim your property to start setting prices and receiving offers.</p>
        <Button className="mt-5" onClick={() => navigate('/business/claim')}>
          <Plus className="mr-2 h-4 w-4" /> Claim your property
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Business dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {listings.map((l) => l.name).join(' · ')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/business/pricing">
              <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Pricing
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{pending.length}</p>
          <p className="text-xs text-muted-foreground">Need response</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{awaiting.length}</p>
          <p className="text-xs text-muted-foreground">Awaiting guest</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-success">{confirmedCount}</p>
          <p className="text-xs text-muted-foreground">Confirmed</p>
        </Card>
      </div>

      {/* Needs response */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Inbox className="h-4 w-4" /> Needs your response
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No offers waiting. New offers between your floor and auto-accept price will appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((o) => (
              <PendingOfferCard key={o.id} offer={o} currency={currencyFor(o)} busy={busyId === o.id} onRespond={respond} />
            ))}
          </div>
        )}
      </section>

      {/* Awaiting guest */}
      {awaiting.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="h-4 w-4" /> Awaiting guest confirmation
          </h2>
          <div className="space-y-2">
            {awaiting.map((o) => (
              <Card key={o.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{o.room?.room_name || 'Room'}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(o.check_in)}–{fmtDate(o.check_out)} ·{' '}
                    {o.status === 'countered'
                      ? `Countered ${currencyFor(o)} $${Math.round(o.counter_nightly || 0)}`
                      : `Accepted ${currencyFor(o)} $${Math.round(o.nightly_offer)}`}
                  </p>
                </div>
                <Badge variant="outline" className="flex-shrink-0 text-xs">
                  {countdown(o.confirm_deadline_at)}
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="h-4 w-4" /> History
          </h2>
          <div className="space-y-2">
            {history.map((o) => (
              <Card key={o.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{o.room?.room_name || 'Room'}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(o.check_in)}–{fmtDate(o.check_out)} · {currencyFor(o)} ${Math.round(o.nightly_offer)}/night
                  </p>
                </div>
                <Badge
                  variant={o.status === 'confirmed' ? 'secondary' : 'outline'}
                  className={o.status === 'confirmed' ? 'bg-success/10 text-success border-success/20 flex-shrink-0' : 'flex-shrink-0 text-muted-foreground'}
                >
                  {STATUS_LABEL[o.status] || o.status}
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
