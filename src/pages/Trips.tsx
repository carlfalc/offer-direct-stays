import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, MessageCircle, Plane, CheckCircle2, MapPin, Search } from 'lucide-react';
import { format } from 'date-fns';
import { commitmentFee, balancePayable } from '@/lib/fees';

// A confirmed booking is a confirmed fs_offer (the live offer system). The old
// `offers` table is legacy and no longer used.
interface FsBooking {
  id: string;
  nightly_offer: number;
  counter_nightly: number | null;
  total_offer: number | null;
  nights: number | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  booking_number: string | null;
  created_at: string;
  room: { room_name: string | null } | null;
  listing: { name: string | null; city: string | null; country: string | null } | null;
}

const NAVY = '#1E2A4A';

export default function Trips() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState<FsBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('fs_offers')
          .select('id,nightly_offer,counter_nightly,total_offer,nights,check_in,check_out,status,booking_number,created_at,room:fs_listing_rooms(room_name),listing:fs_listings(name,city,country)')
          .eq('traveller_id', user.id)
          .eq('status', 'confirmed')
          .order('check_in', { ascending: true });
        setTrips((data as any[] as FsBooking[]) || []);
      } catch (err) {
        console.error('Error loading trips:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const dateRange = (ci?: string | null, co?: string | null) => {
    if (!ci || !co) return '';
    return `${format(new Date(ci), 'MMM d')} – ${format(new Date(co), 'MMM d, yyyy')}`;
  };

  if (authLoading) {
    return (
      <div className="fas-brand-day flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="fas-brand-day min-h-screen bg-background text-foreground">
      {/* Navy brand band */}
      <div style={{ backgroundColor: NAVY }}>
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-6">
          <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white/70">Your confirmed bookings</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">My trips</h1>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : trips.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-16 text-center">
            <Plane className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <h2 className="font-display text-lg font-bold text-[#0C1A22]">No confirmed trips yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Once a property accepts your offer and you confirm, your trip appears here.
            </p>
            <Button className="mt-4 gap-2 bg-[#0C1A22] text-white hover:bg-[#0C1A22]/90" onClick={() => navigate('/explore')}>
              <Search className="h-4 w-4" /> Find a stay
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[#0C1A22]">
              {trips.length} confirmed {trips.length === 1 ? 'trip' : 'trips'}
            </p>

            {trips.map((t) => {
              const sym = t.listing?.country === 'AU' ? 'A$' : 'NZ$';
              const nights = t.nights ?? 1;
              const nightly = Math.round(t.counter_nightly ?? t.nightly_offer ?? 0);
              const total = Math.round(t.total_offer ?? nightly * nights);
              const fee = commitmentFee(total);
              const balance = balancePayable(total);

              return (
                <div key={t.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-lg font-bold" style={{ color: NAVY }}>
                          {t.listing?.name || 'Your stay'}
                        </h3>
                        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">
                            {t.listing?.city || ''}{t.listing?.country ? `, ${t.listing.country}` : ''}
                            {t.room?.room_name ? ` · ${t.room.room_name}` : ''}
                          </span>
                        </div>
                      </div>
                      <span className="inline-flex flex-none items-center gap-1.5 rounded-lg bg-[#19C9B4] px-2.5 py-1 text-xs font-bold text-[#0C1A22]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-sm font-medium text-[#0C1A22]">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{dateRange(t.check_in, t.check_out)}</span>
                      <span className="text-muted-foreground">· {nights} {nights === 1 ? 'night' : 'nights'}</span>
                    </div>

                    {/* Deal summary */}
                    <div className="mt-3 grid gap-1.5 rounded-xl border border-border bg-muted/30 p-3 text-sm">
                      <Row label={`Agreed rate · ${nights} ${nights === 1 ? 'night' : 'nights'}`} value={`${sym}${nightly}/night`} />
                      <Row label="Booking total" value={`${sym}${total}`} bold />
                      <Row label="findastay commitment fee" value={`${sym}${fee.toFixed(2)}`} />
                      <div className="my-1 h-px bg-border" />
                      <Row label="Pay the property direct" value={`${sym}${balance.toFixed(2)}`} bold />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/messages/${t.id}`)}>
                        <MessageCircle className="h-4 w-4" /> Message property
                      </Button>
                      {t.booking_number && (
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-[#0C1A22]">#{t.booking_number}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-bold text-[#0C1A22]' : 'font-medium text-[#0C1A22]'}>{value}</span>
    </div>
  );
}
