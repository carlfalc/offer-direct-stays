import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { loadLiteApiRoomContent } from '@/lib/listings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, MapPin, Users, BedDouble, Eye, ImageIcon, Settings2 } from 'lucide-react';

interface Photo { url: string; source: string }
interface PreviewRoom {
  id: string;
  name: string;
  description: string | null;
  amenities: string | null;
  bed_configuration: string | null;
  max_occupancy: number | null;
  base_guide: number | null;
  photos: Photo[];
}
interface PreviewListing {
  id: string;
  liteapi_hotel_id: string;
  name: string;
  city: string | null;
  country: 'NZ' | 'AU';
  thumbnail: string | null;
  property_type: string | null;
  status: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  hotel: 'Hotel', motel: 'Motel', lodge: 'Lodge', resort: 'Resort', bnb: 'Bed & Breakfast',
  apartment: 'Apartment', house: 'House', holiday_home: 'Holiday home', small_holiday_home: 'Small holiday home',
  beach_bach: 'Beach bach', cabin: 'Cabin', cottage: 'Cottage', villa: 'Villa', unit: 'Unit / studio',
  room: 'Room', caravan: 'Caravan', holiday_park: 'Holiday park', hostel: 'Hostel', farmstay: 'Farmstay',
  glamping: 'Glamping', other: 'Property',
};

function RoomPhoto({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="flex h-40 w-full items-center justify-center rounded-xl bg-muted text-muted-foreground"><ImageIcon className="h-6 w-6 opacity-50" /></div>;
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-40 w-full rounded-xl object-cover" />;
}

/**
 * Owner-facing preview: shows the owner's own listing — the curated rooms,
 * photos, descriptions and guide prices — the way a traveller will see it once
 * it's live. The Make-an-offer button is inert here (preview only).
 */
export default function BusinessPreview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<PreviewListing | null>(null);
  const [rooms, setRooms] = useState<PreviewRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      const { data: l } = await supabase
        .from('fs_listings')
        .select('id,liteapi_hotel_id,name,city,country,thumbnail,property_type,status')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!l) { setLoading(false); return; }
      const listingRow = l as any as PreviewListing;
      setListing(listingRow);

      const { data: rr } = await supabase
        .from('fs_listing_rooms')
        .select('id,liteapi_room_id,room_name,max_occupancy,base_guide,photos,description,amenities,bed_configuration,sort_order')
        .eq('listing_id', listingRow.id)
        .order('sort_order', { ascending: true });

      // Seed photos/descriptions from LiteAPI for any room not yet curated.
      let liteContent: Record<string, any> = {};
      try { liteContent = await loadLiteApiRoomContent(listingRow.liteapi_hotel_id); } catch { /* best effort */ }

      const mapped: PreviewRoom[] = ((rr as any[]) || []).map((r) => {
        const lc = r.liteapi_room_id ? liteContent[String(r.liteapi_room_id)] : null;
        const curated: Photo[] = Array.isArray(r.photos) ? r.photos : [];
        const photos: Photo[] = curated.length
          ? curated
          : (lc?.images || []).map((url: string) => ({ url, source: 'liteapi' }));
        return {
          id: r.id,
          name: r.room_name || 'Room',
          description: r.description ?? lc?.description ?? null,
          amenities: r.amenities ?? lc?.amenities ?? null,
          bed_configuration: r.bed_configuration ?? lc?.beds ?? null,
          max_occupancy: r.max_occupancy ?? lc?.max_occupancy ?? null,
          base_guide: r.base_guide ?? null,
          photos,
        };
      });
      setRooms(mapped);
      setLoading(false);
    };
    run();
  }, [user]);

  const curSym = listing?.country === 'AU' ? 'A$' : '$';

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">No listing to preview yet. Claim your property first.</p>
        <Button className="mt-5" onClick={() => navigate('/business/claim')}>Claim your business</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Preview banner */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Eye className="h-4 w-4 text-primary" />
          Preview — this is how travellers see your listing
          {listing.status !== 'active' && <Badge variant="outline" className="ml-1 text-amber-600">Not live yet</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/business/content')} title="Change rooms, photos, payment methods and when the balance is due">
            <Settings2 className="mr-1 h-4 w-4" /> Edit settings
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/business/dashboard')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <RoomPhoto src={listing.thumbnail || rooms[0]?.photos[0]?.url} alt={listing.name} />
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold text-foreground">{listing.name}</h1>
            {listing.property_type && <Badge variant="secondary">{TYPE_LABEL[listing.property_type] || listing.property_type}</Badge>}
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />{listing.city ? `${listing.city}, ` : ''}{listing.country === 'AU' ? 'Australia' : 'New Zealand'}
          </div>
        </div>
      </div>

      {/* Rooms */}
      <h2 className="mt-7 mb-3 font-display text-lg font-bold text-foreground">Rooms &amp; units</h2>
      {rooms.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No rooms yet. Import or add rooms on the Rooms &amp; photos page, then preview again.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rooms.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <RoomPhoto src={r.photos[0]?.url} alt={r.name} />
              <div className="p-4">
                <p className="font-display text-base font-bold text-foreground">{r.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {r.max_occupancy != null && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Sleeps {r.max_occupancy}</span>}
                  {r.bed_configuration && <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {r.bed_configuration}</span>}
                </div>
                {r.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{r.description}</p>}
                {r.amenities && <p className="mt-2 text-xs text-muted-foreground">{r.amenities}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    {r.base_guide != null ? (
                      <p className="text-sm text-foreground"><span className="font-display text-xl font-extrabold">{curSym}{Math.round(r.base_guide)}</span> <span className="text-muted-foreground">guide / night</span></p>
                    ) : (
                      <p className="text-xs font-medium text-amber-600">No guide price set</p>
                    )}
                  </div>
                  <button type="button" title="Preview only" className="cursor-default rounded-lg bg-[#19C9B4] px-4 py-2 font-display text-sm font-extrabold text-[#0C1A22] shadow-sm">Make an offer</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
