import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarDays, MapPin, CheckCircle2, Clock, Send } from 'lucide-react';

interface FsOffer {
  id: string;
  nightly_offer: number;
  counter_nightly: number | null;
  total_offer: number;
  nights: number;
  check_in: string;
  check_out: string;
  status: string;
  released_at: string | null;
  confirm_deadline_at: string | null;
  booking_number: string | null;
  created_at: string;
  room?: { room_name: string | null } | null;
  listing?: { name: string | null; city: string | null; country: string | null } | null;
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });

function countdown(deadline: string | null): string {
  if (!deadline) return '';
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

export default function GuestOffers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<FsOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('fs_offers')
      .select(
        'id,nightly_offer,counter_nightly,total_offer,nights,check_in,check_out,status,released_at,confirm_deadline_at,booking_number,created_at,room:fs_listing_rooms(room_name),listing:fs_listings(name,city,country)',
      )
      .eq('traveller_id', user.id)
      .order('created_at', { ascending: false });
    setOffers(((data as any[]) || []) as FsOffer[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // keep countdowns live
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const currencyFor = (o: FsOffer) => (o.listing?.country === 'AU' ? 'AUD' : 'NZD');

  const confirm = async (o: FsOffer) => {
    setBusyId(o.id);
    const { data, error } = await supabase.rpc('fs_confirm_offer', { p_offer: o.id } as any);
    setBusyId(null);
    if (error) {
      toast({ title: 'Could not confirm', description: error.message || 'Please try again', variant: 'destructive' });
      load();
      return;
    }
    const bn = (data as any)?.booking_number;
    toast({ title: 'Booking confirmed', description: bn ? `Your reference is ${bn}.` : 'Your stay is confirmed.' });
    load();
  };

  const withdraw = async (o: FsOffer) => {
    setBusyId(o.id);
    const { error } = await supabase.rpc('fs_withdraw_offer', { p_offer: o.id } as any);
    setBusyId(null);
    if (error) {
      toast({ title: 'Could not withdraw', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Offer withdrawn' });
    load();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Send className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">No offers yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find a place and name your price — your offers show up here.</p>
        <Button className="mt-5" onClick={() => navigate('/explore')}>Explore stays</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-foreground">My offers</h1>
      <p className="mt-1 text-sm text-muted-foreground">Track your offers and confirm the moment a property says yes.</p>

      <div className="mt-6 space-y-3">
        {offers.map((o) => {
          const cur = currencyFor(o);
          const isCountered = o.status === 'countered';
          const price = isCountered ? o.counter_nightly ?? o.nightly_offer : o.nightly_offer;
          const canConfirm =
            (o.status === 'accepted_pending_confirm' || o.status === 'countered') &&
            !!o.released_at &&
            !!o.confirm_deadline_at &&
            new Date(o.confirm_deadline_at).getTime() > Date.now();
          const awaitingRelease = o.status === 'accepted_pending_confirm' && !o.released_at;

          return (
            <Card key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{o.listing?.name || 'Property'}</p>
                  <p className="text-xs text-muted-foreground">{o.room?.room_name || 'Room'}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(o.check_in)}–{fmtDate(o.check_out)} · {o.nights}n</span>
                    {o.listing?.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {o.listing.city}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{cur} ${Math.round(o.nightly_offer)}</p>
                  <p className="text-[11px] text-muted-foreground">your offer /night</p>
                </div>
              </div>

              {/* Status + actions */}
              <div className="mt-3 border-t border-border pt-3">
                {o.status === 'confirmed' ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-success"><CheckCircle2 className="h-4 w-4" /> Booking confirmed</span>
                    {o.booking_number && <Badge variant="secondary" className="bg-success/10 text-success border-success/20">{o.booking_number}</Badge>}
                  </div>
                ) : canConfirm ? (
                  <div className="space-y-2">
                    {isCountered ? (
                      <div className="text-sm">
                        <span className="text-muted-foreground">You offered </span>
                        <span className="font-medium text-foreground">{cur} ${Math.round(o.nightly_offer)}</span>
                        <span className="text-muted-foreground"> · they countered at </span>
                        <span className="font-semibold text-foreground">{cur} ${Math.round(price)}/night</span>
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-foreground">Accepted at {cur} ${Math.round(o.nightly_offer)}/night — confirm to lock it in</div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="flex-1" disabled={busyId === o.id} onClick={() => confirm(o)}>
                        {busyId === o.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming…</> : 'Confirm booking'}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busyId === o.id} onClick={() => withdraw(o)}>Decline</Button>
                    </div>
                    <p className="flex items-center gap-1 text-xs text-amber-600"><Clock className="h-3.5 w-3.5" /> Confirm within {countdown(o.confirm_deadline_at)}</p>
                  </div>
                ) : awaitingRelease ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Offer sent — we'll let you know the moment they respond.</span>
                    <Button size="sm" variant="ghost" disabled={busyId === o.id} onClick={() => withdraw(o)}>Withdraw</Button>
                  </div>
                ) : o.status === 'pending' ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Awaiting the property…</span>
                    <Button size="sm" variant="ghost" disabled={busyId === o.id} onClick={() => withdraw(o)}>Withdraw</Button>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    {o.status === 'declined' ? 'Not accepted' : o.status === 'expired' ? 'Expired' : o.status === 'withdrawn' ? 'Withdrawn' : o.status}
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
