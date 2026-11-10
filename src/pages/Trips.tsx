import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, MessageCircle, Plane, CheckCircle2, MapPin, Search, BedDouble, Clock, ChevronDown, FileText, Sparkles, Navigation, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { paymentMethodLabel } from '@/lib/paymentMethods';
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
  listing_id: string;
  listing_room_id: string;
  room: { room_name: string | null } | null;
  listing: { name: string | null; city: string | null; country: string | null } | null;
}

const NAVY = '#1E2A4A';

interface ListingInfo {
  address?: string | null; latitude?: number | null; longitude?: number | null;
  payment_methods?: string[] | null; payment_note?: string | null;
  payment_terms?: string | null; payment_lead_days?: number | null;
  check_in_time?: string | null; check_out_time?: string | null; arrival_notes?: string | null;
}
interface RoomInfo { id: string; room_name?: string | null; description?: string | null; bed_configuration?: string | null; amenities?: string | null; photos?: any[] | null }

/** Select with progressively fewer columns so a not-yet-run migration never breaks the page. */
async function selectBestEffort(table: string, idCol: string, ids: string[], colSets: string[]) {
  for (const cols of colSets) {
    const { data, error } = await supabase.from(table as any).select(cols).in(idCol, ids);
    if (!error) return (data as any[]) || [];
  }
  return [];
}

export default function Trips() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState<FsBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingInfo, setListingInfo] = useState<Record<string, ListingInfo>>({});
  const [roomInfo, setRoomInfo] = useState<Record<string, RoomInfo>>({});

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
          .select('id,listing_id,listing_room_id,nightly_offer,counter_nightly,total_offer,nights,check_in,check_out,status,booking_number,created_at,room:fs_listing_rooms(room_name),listing:fs_listings(name,city,country)')
          .eq('traveller_id', user.id)
          .eq('status', 'confirmed')
          .order('check_in', { ascending: true });
        const list = (data as any[] as FsBooking[]) || [];
        setTrips(list);
        if (list.length) {
          const lids = [...new Set(list.map((t) => t.listing_id))];
          const rids = [...new Set(list.map((t) => t.listing_room_id))];
          const [ls, rs] = await Promise.all([
            selectBestEffort('fs_listings', 'id', lids, [
              'id,address,latitude,longitude,payment_methods,payment_note,payment_terms,payment_lead_days,check_in_time,check_out_time,arrival_notes',
              'id,address,latitude,longitude,payment_methods,payment_note,payment_terms,payment_lead_days',
              'id,address,latitude,longitude',
            ]),
            selectBestEffort('fs_listing_rooms', 'id', rids, [
              'id,room_name,description,bed_configuration,amenities,photos',
              'id,room_name',
            ]),
          ]);
          setListingInfo(Object.fromEntries(ls.map((l: any) => [l.id, l])));
          setRoomInfo(Object.fromEntries(rs.map((r: any) => [r.id, r])));
        }
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
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">Upcoming trips</h1>
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

            {trips.map((t, i) => (
              <TripCard key={t.id} t={t} defaultOpen={i === 0} listing={listingInfo[t.listing_id]} room={roomInfo[t.listing_room_id]}
                dateRange={dateRange} onMessage={() => navigate(`/messages/${t.id}`)} />
            ))}
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

function TripCard({ t, listing, room, defaultOpen, dateRange, onMessage }: {
  t: FsBooking; listing?: ListingInfo; room?: RoomInfo; defaultOpen: boolean;
  dateRange: (ci?: string | null, co?: string | null) => string; onMessage: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [termsOpen, setTermsOpen] = useState(false);

  const sym = t.listing?.country === 'AU' ? 'A$' : 'NZ$';
  const nights = t.nights ?? 1;
  const nightly = Math.round(t.counter_nightly ?? t.nightly_offer ?? 0);
  const total = Math.round(t.total_offer ?? nightly * nights);
  const fee = commitmentFee(total);
  const balance = balancePayable(total);
  const biz = t.listing?.name || 'The property';

  const photoRaw = Array.isArray(room?.photos) ? room!.photos![0] : null;
  const photo: string | null = (typeof photoRaw === 'string' ? photoRaw : photoRaw?.url) || null;

  const place = [listing?.address, t.listing?.city, t.listing?.country].filter(Boolean).join(', ');
  const mapQuery = listing?.latitude && listing?.longitude && !listing?.address ? `${listing.latitude},${listing.longitude}` : `${t.listing?.name || ''} ${place}`.trim();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const nearbyUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`restaurants and things to do near ${mapQuery}`)}`;

  const methods = (listing?.payment_methods || []).map(paymentMethodLabel);
  const onArrival = listing?.payment_terms === 'on_arrival' || (!listing?.payment_terms && (listing?.payment_methods || []).includes('pay_on_arrival'));
  const lead = listing?.payment_lead_days || null;
  const howToPay = onArrival
    ? 'Payment is due on arrival.'
    : listing?.payment_terms === 'days_before'
      ? `${biz} will contact you with payment requirements. The balance is due ${lead ? `${lead} days` : 'a few days'} before arrival.`
      : listing?.payment_terms === 'upfront'
        ? `${biz} will contact you with payment requirements — payment is due now that your booking is confirmed.`
        : `${biz} will contact you with payment requirements.`;

  const askAi = () => {
    toast({ title: 'AI concierge coming soon', description: 'For now, opening what’s nearby on Google Maps.' });
    window.open(nearbyUrl, '_blank', 'noopener');
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-bold" style={{ color: NAVY }}>{t.listing?.name || 'Your stay'}</h3>
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

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-[#0C1A22]">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{dateRange(t.check_in, t.check_out)}</span>
          <span className="text-muted-foreground">· {nights} {nights === 1 ? 'night' : 'nights'}</span>
          {t.booking_number && <span className="ml-auto rounded-md bg-muted px-2 py-1 text-xs font-semibold text-[#0C1A22]">#{t.booking_number}</span>}
        </div>

        <button onClick={() => setOpen((o) => !o)} className="mt-3 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-semibold" style={{ color: NAVY }}>
          {open ? 'Hide trip details' : 'View trip details'}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="mt-3 space-y-3">
            {/* Your room */}
            <section className="overflow-hidden rounded-xl border border-border">
              <div className="flex gap-3 p-3">
                <div className="h-20 w-28 flex-none overflow-hidden rounded-lg bg-muted">
                  {photo ? <img src={photo} alt={room?.room_name || 'Room'} loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><BedDouble className="h-6 w-6 opacity-50" /></div>}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your room</p>
                  <p className="font-semibold text-[#0C1A22]">{room?.room_name || t.room?.room_name || 'Room'}</p>
                  {room?.bed_configuration && <p className="text-xs text-muted-foreground">{room.bed_configuration}</p>}
                  {room?.description && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{room.description}</p>}
                </div>
              </div>
              {room?.amenities && <p className="border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"><span className="font-semibold text-[#0C1A22]">Includes:</span> {room.amenities}</p>}
            </section>

            {/* Arrival & check-out */}
            <section className="rounded-xl border border-border p-3 text-sm">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Arrival &amp; check-out</p>
              <p className="text-[#0C1A22]">
                {listing?.check_in_time ? <>You can arrive from <b>{listing.check_in_time}</b>.</> : <>{biz} will confirm your check-in time.</>}{' '}
                {listing?.check_out_time ? <>Check-out is by <b>{listing.check_out_time}</b>.</> : null}
              </p>
              {place && <p className="mt-1.5 text-[#0C1A22]"><b>Address:</b> {place}</p>}
              {listing?.arrival_notes && <p className="mt-1.5 text-muted-foreground">{listing.arrival_notes}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" asChild>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"><Navigation className="h-4 w-4" /> Directions in Google Maps</a>
                </Button>
                <Button size="sm" className="gap-1.5 bg-[#1E2A4A] text-white hover:bg-[#1E2A4A]/90" onClick={askAi}>
                  <Sparkles className="h-4 w-4" /> Ask AI what’s nearby
                </Button>
              </div>
            </section>

            {/* Cost & how to pay */}
            <section className="rounded-xl border border-border p-3 text-sm">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Cost &amp; how to pay</p>
              <div className="grid gap-1.5">
                <Row label={`Agreed rate · ${nights} ${nights === 1 ? 'night' : 'nights'}`} value={`${sym}${nightly}/night`} />
                <Row label="Booking total" value={`${sym}${total}`} bold />
                <Row label="findastay commitment fee" value={`${sym}${fee.toFixed(2)}`} />
                <div className="my-1 h-px bg-border" />
                <Row label="Pay the property direct" value={`${sym}${balance.toFixed(2)}`} bold />
              </div>
              <p className="mt-2 rounded-lg bg-muted/40 p-2.5 text-[#0C1A22]"><b>How to pay:</b> {howToPay}</p>
              {methods.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Accepted: {methods.join(' · ')}</p>}
              {listing?.payment_note && <p className="mt-1 text-xs text-muted-foreground">{listing.payment_note}</p>}
            </section>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onMessage}>
            <MessageCircle className="h-4 w-4" /> Message property
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTermsOpen(true)}>
            <FileText className="h-4 w-4" /> Terms &amp; conditions
          </Button>
        </div>
      </div>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking terms</DialogTitle>
            <DialogDescription>{biz} · {dateRange(t.check_in, t.check_out)}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#0C1A22]">
            <li>Your confirmed offer is a genuine booking at the agreed rate of {sym}{nightly} per night ({sym}{total} total).</li>
            <li>The findastay commitment fee ({sym}{fee.toFixed(2)}) is a non-refundable booking commitment fee. findastay takes no commission.</li>
            <li>The remaining {sym}{balance.toFixed(2)} is paid directly to {biz}: {howToPay}</li>
            <li>For changes or cancellations, contact {biz} through Messages.</li>
          </ul>
          <p className="text-xs text-muted-foreground">The full findastay terms and conditions will be published here.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
