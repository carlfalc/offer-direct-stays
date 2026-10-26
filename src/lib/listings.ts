import { supabase } from '@/integrations/supabase/client';
import { Property, Room } from '@/types';

export interface GeoPoint {
  name: string;
  lat: number;
  lng: number;
  country: 'NZ' | 'AU';
}

const stripHtml = (s?: string) => (s || '').replace(/<[^>]+>/g, '').trim();

const EARTH_KM = 6371;
function distKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export interface ClaimableHotel {
  id: string;
  name: string;
  city: string | null;
  country: 'NZ' | 'AU';
  thumbnail: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  claimedByOther: boolean;
  claimedByMe: boolean;
}

/**
 * Type-ahead search of LiteAPI accommodation across NZ + AU by name, for the
 * business claim flow. Merges findastay claim status so the UI can show which
 * are already registered.
 */
export async function searchClaimableHotels(query: string): Promise<ClaimableHotel[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const countries: Array<'NZ' | 'AU'> = ['NZ', 'AU'];
  const results = await Promise.all(
    countries.map(async (cc) => {
      try {
        const { data } = await supabase.functions.invoke('liteapi-content-ts', {
          body: { action: 'searchHotels', params: { countryCode: cc, hotelName: q, limit: 8 } },
        });
        const list = (data as any)?.data || [];
        return list.map((h: any) => ({ h, cc }));
      } catch {
        return [];
      }
    }),
  );
  const flat = results.flat();
  if (flat.length === 0) return [];

  // Who's claimed already?
  const ids = flat.map((x) => String(x.h.id));
  let owners: Record<string, string | null> = {};
  try {
    const { data: me } = await supabase.auth.getUser();
    const myId = me?.user?.id ?? null;
    const { data: rows } = await supabase
      .from('fs_listings')
      .select('liteapi_hotel_id,owner_id')
      .in('liteapi_hotel_id', ids);
    (rows as any[] | null)?.forEach((r) => (owners[r.liteapi_hotel_id] = r.owner_id));
    return flat.map(({ h, cc }) => {
      const owner = owners[String(h.id)] ?? null;
      return {
        id: String(h.id),
        name: h.name,
        city: h.city ?? null,
        country: cc,
        thumbnail: h.thumbnail || h.main_photo || null,
        latitude: typeof h.latitude === 'number' ? h.latitude : null,
        longitude: typeof h.longitude === 'number' ? h.longitude : null,
        address: h.address ?? null,
        claimedByOther: !!owner && owner !== myId,
        claimedByMe: !!owner && owner === myId,
      } as ClaimableHotel;
    });
  } catch {
    return flat.map(({ h, cc }) => ({
      id: String(h.id),
      name: h.name,
      city: h.city ?? null,
      country: cc,
      thumbnail: h.thumbnail || h.main_photo || null,
      latitude: typeof h.latitude === 'number' ? h.latitude : null,
      longitude: typeof h.longitude === 'number' ? h.longitude : null,
      address: h.address ?? null,
      claimedByOther: false,
      claimedByMe: false,
    }));
  }
}

// LiteAPI hotelTypeId → our rough category. Most API inventory is commercial
// (hotels/motels/resorts/aparthotels); only a few ids read as homes/apartments.
const LITE_HOME_TYPE_IDS = new Set([219, 220, 223]); // apartment / villa
// Owner-declared property_type strings that belong in the "homes" group.
const HOME_TYPES = new Set(['home', 'home_apartment', 'apartment', 'villa', 'house', 'cabin', 'cottage', 'bach']);
const PARK_TYPES = new Set(['holiday_park', 'holiday park', 'caravan', 'campground', 'camp', 'motor_camp']);

export function categoryOf(propertyType?: string | null): 'homes' | 'hotels' | 'parks' {
  if (!propertyType) return 'hotels';
  if (PARK_TYPES.has(propertyType)) return 'parks';
  if (HOME_TYPES.has(propertyType)) return 'homes';
  return 'hotels';
}

/** Map one LiteAPI content hotel into the app's Property shape. */
export function mapHotelToProperty(h: any, country: 'NZ' | 'AU'): Property {
  const lat = typeof h.latitude === 'number' ? h.latitude : h.location?.latitude ?? null;
  const lng = typeof h.longitude === 'number' ? h.longitude : h.location?.longitude ?? null;
  return {
    id: String(h.id),
    business_id: null,
    name: h.name || 'Unnamed property',
    description: stripHtml(h.hotelDescription || h.description) || null,
    property_type: 'hotel',
    country,
    city: h.city || '',
    area: null,
    address: h.address || null,
    latitude: lat,
    longitude: lng,
    amenities: Array.isArray(h.hotelFacilities)
      ? h.hotelFacilities.slice(0, 20)
      : Array.isArray(h.facilities)
      ? h.facilities.slice(0, 20)
      : null,
    registration_status: null,
    is_claimed: false,
    image_url: h.main_photo || h.thumbnail || null,
    category: LITE_HOME_TYPE_IDS.has(Number(h.hotelTypeId)) ? 'homes' : 'hotels',
    rating: typeof h.rating === 'number' ? h.rating : null,
    review_count: typeof h.reviewCount === 'number' ? h.reviewCount : null,
    guide_price: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Fetch real LiteAPI properties for an area and merge in findastay claim status.
 * Returns the nearest properties with `is_claimed` set from fs_listings.
 */
export async function searchListings(geo: GeoPoint, limit = 100): Promise<Property[]> {
  const invoke = (params: Record<string, unknown>) =>
    supabase.functions.invoke('liteapi-content-ts', {
      body: { action: 'searchHotels', params },
    });

  // Pull hotels a few ways and merge, since LiteAPI area coverage varies.
  const seen = new Set<string>();
  let hotels: any[] = [];
  const addHotels = (d: any) => {
    const arr = (d as any)?.data ?? d;
    if (Array.isArray(arr)) {
      for (const h of arr) {
        const id = String(h.id);
        if (!seen.has(id)) {
          seen.add(id);
          hotels.push(h);
        }
      }
    }
  };

  try {
    const { data } = await invoke({ countryCode: geo.country, latitude: geo.lat, longitude: geo.lng, radius: 30000, limit });
    addHotels(data);
  } catch { /* ignore */ }
  try {
    const { data } = await invoke({ countryCode: geo.country, cityName: geo.name, limit });
    addHotels(data);
  } catch { /* ignore */ }

  let props = hotels
    .map((h) => mapHotelToProperty(h, geo.country))
    .filter((p) => p.latitude != null && p.longitude != null);

  // Keep it local: everything within 50km, else the nearest 30.
  props = props
    .map((p) => ({ p, d: distKm(geo.lat, geo.lng, p.latitude as number, p.longitude as number) }))
    .sort((a, b) => a.d - b.d)
    .filter((x, i) => x.d <= 50 || i < 30)
    .map((x) => x.p);

  // Merge claim status from fs_listings
  if (props.length) {
    try {
      const ids = props.map((p) => p.id);
      const { data: listings } = await supabase
        .from('fs_listings')
        .select('liteapi_hotel_id,status,published_at,property_type,payment_terms,payment_lead_days')
        .in('liteapi_hotel_id', ids);
      const byId = new Map((listings || []).map((l: any) => [l.liteapi_hotel_id, l]));
      props.forEach((p) => {
        const l = byId.get(p.id);
        if (!l) return;
        // Only a PUBLISHED business is treated as live/registered with owner settings.
        const live = l.status === 'active' && l.published_at != null;
        if (!live) return;
        p.is_claimed = true;
        p.registration_status = 'registered';
        if (l.property_type) p.category = categoryOf(l.property_type); // owner's declared type wins
        p.payment_terms = l.payment_terms ?? p.payment_terms;
        p.payment_lead_days = l.payment_lead_days ?? p.payment_lead_days;
      });
    } catch {
      /* claim status is best-effort */
    }
  }

  // Always surface OUR active listings near this area, even if LiteAPI's area search missed them.
  try {
    const { data: active } = await supabase
      .from('fs_listings')
      .select('liteapi_hotel_id,name,city,country,latitude,longitude,thumbnail,status,property_type,payment_terms,payment_lead_days')
      .eq('status', 'active')
      .not('published_at', 'is', null);
    const existing = new Map(props.map((p) => [p.id, p]));
    (active || []).forEach((l: any) => {
      if (l.latitude == null || l.longitude == null) return;
      if (distKm(geo.lat, geo.lng, l.latitude, l.longitude) > 60) return;
      const already = existing.get(l.liteapi_hotel_id);
      if (already) {
        already.is_claimed = true;
        already.registration_status = 'registered';
        if (l.property_type) already.category = categoryOf(l.property_type);
        already.payment_terms = l.payment_terms ?? already.payment_terms;
        already.payment_lead_days = l.payment_lead_days ?? already.payment_lead_days;
        return;
      }
      props.unshift({
        id: l.liteapi_hotel_id,
        business_id: null,
        name: l.name || 'Property',
        description: null,
        property_type: 'hotel',
        country: l.country === 'AU' ? 'AU' : 'NZ',
        city: l.city || '',
        area: null,
        address: null,
        latitude: l.latitude,
        longitude: l.longitude,
        amenities: null,
        registration_status: 'registered',
        is_claimed: true,
        image_url: l.thumbnail || null,
        category: categoryOf(l.property_type),
        payment_terms: l.payment_terms ?? null,
        payment_lead_days: l.payment_lead_days ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
  } catch {
    /* best-effort */
  }

  // Real price range: lowest–highest room GUIDE price for each claimed listing.
  try {
    const claimedHotelIds = props.filter((p) => p.is_claimed).map((p) => p.id);
    if (claimedHotelIds.length) {
      const { data: ls } = await supabase
        .from('fs_listings')
        .select('id,liteapi_hotel_id')
        .in('liteapi_hotel_id', claimedHotelIds)
        .eq('status', 'active')
        .not('published_at', 'is', null);
      const hotelByListing = new Map((ls || []).map((l: any) => [l.id, l.liteapi_hotel_id]));
      const listingIds = (ls || []).map((l: any) => l.id);
      if (listingIds.length) {
        const { data: roomRows } = await supabase
          .from('fs_listing_rooms')
          .select('listing_id,base_guide')
          .in('listing_id', listingIds);
        const range = new Map<string, { min: number; max: number }>();
        (roomRows || []).forEach((r: any) => {
          if (r.base_guide == null) return;
          const hotel = hotelByListing.get(r.listing_id);
          if (!hotel) return;
          const v = Number(r.base_guide);
          const cur = range.get(hotel);
          if (!cur) range.set(hotel, { min: v, max: v });
          else range.set(hotel, { min: Math.min(cur.min, v), max: Math.max(cur.max, v) });
        });
        props.forEach((p) => {
          const r = range.get(p.id);
          if (r) {
            p.guide_min = r.min;
            p.guide_max = r.max;
          }
        });
      }
    }
  } catch {
    /* best-effort */
  }

  return props;
}

/** Pull a LiteAPI room's photos, main photo first, as plain URLs. */
function roomImages(r: any): string[] {
  // LiteAPI returns the room's picture array under `photos` (sometimes `images`).
  const imgs = [...((r?.photos as any[]) || (r?.images as any[]) || [])].sort(
    (a, b) => (b?.mainPhoto ? 1 : 0) - (a?.mainPhoto ? 1 : 0),
  );
  return imgs
    .map((i) => i?.url || i?.hd_url || i?.failoverPhoto)
    .filter((u): u is string => !!u);
}

/**
 * Map of liteapi_room_id -> content (photos, size, occupancy) for one hotel.
 * Used to attach LiteAPI photos to a claimed listing's engine rooms.
 */
export async function loadLiteApiRoomContent(
  hotelId: string,
): Promise<Record<string, { images: string[]; size_sqm: number | null; max_occupancy: number | null; description: string | null; amenities: string | null; beds: string | null }>> {
  try {
    const { data } = await supabase.functions.invoke('liteapi-content-ts', {
      body: { action: 'hotelDetails', hotelId },
    });
    const d = (data as any)?.data ?? data;
    const out: Record<string, any> = {};
    for (const r of d?.rooms || []) {
      out[String(r.id)] = {
        images: roomImages(r),
        size_sqm: r.roomSizeSquare ?? null,
        max_occupancy: r.maxOccupancy ?? null,
        description: stripHtml(r.description) || null,
        amenities: (r.roomAmenities || []).map((a: any) => a?.name).filter(Boolean).join(', ') || null,
        beds: (r.bedTypes || []).map((b: any) => `${b.quantity}× ${b.bedType}`).join(', ') || null,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Upload an owner photo for a room to the `room-photos` bucket and return its
 * public URL. Paths are namespaced by listing + room so they're easy to find.
 */
export async function uploadRoomPhoto(file: File, listingId: string, roomId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${listingId}/${roomId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('room-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('room-photos').getPublicUrl(path);
  return data.publicUrl;
}

/** Load a LiteAPI hotel's room types, mapped to the app's Room shape. */
export async function loadLiteApiRooms(hotelId: string): Promise<Room[]> {
  try {
    const { data } = await supabase.functions.invoke('liteapi-content-ts', {
      body: { action: 'hotelDetails', hotelId },
    });
    const d = (data as any)?.data ?? data;
    const rooms = d?.rooms || [];
    return rooms.map((r: any) => {
      const images = roomImages(r);
      return {
        id: String(r.id),
        property_id: hotelId,
        name: r.roomName || r.name || 'Room',
        description: stripHtml(r.description) || null,
        max_adults: r.maxAdults ?? 2,
        max_children: r.maxChildren ?? 0,
        max_occupancy: r.maxOccupancy ?? null,
        size_sqm: r.roomSizeSquare ?? null,
        images,
        image_url: images[0] ?? null,
        bed_configuration:
          (r.bedTypes || []).map((b: any) => `${b.quantity}× ${b.bedType}`).join(', ') || null,
        amenities: (r.roomAmenities || []).map((a: any) => a.name).slice(0, 12),
        avg_rate: null,
        actual_rate: null,
        currency: geo_currency(hotelId),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

// Rooms carry no currency from content; default by nothing known here.
function geo_currency(_hotelId: string): string {
  return 'NZD';
}
