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
        .select('liteapi_hotel_id,status')
        .in('liteapi_hotel_id', ids);
      const byId = new Map((listings || []).map((l: any) => [l.liteapi_hotel_id, l.status]));
      props.forEach((p) => {
        const st = byId.get(p.id);
        p.is_claimed = st === 'active';
        p.registration_status = st === 'active' ? 'registered' : null;
      });
    } catch {
      /* claim status is best-effort */
    }
  }

  // Always surface OUR active listings near this area, even if LiteAPI's area search missed them.
  try {
    const { data: active } = await supabase
      .from('fs_listings')
      .select('liteapi_hotel_id,name,city,country,latitude,longitude,thumbnail,status')
      .eq('status', 'active');
    const existing = new Map(props.map((p) => [p.id, p]));
    (active || []).forEach((l: any) => {
      if (l.latitude == null || l.longitude == null) return;
      if (distKm(geo.lat, geo.lng, l.latitude, l.longitude) > 60) return;
      const already = existing.get(l.liteapi_hotel_id);
      if (already) {
        already.is_claimed = true;
        already.registration_status = 'registered';
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
  } catch {
    /* best-effort */
  }

  return props;
}

/** Load a LiteAPI hotel's room types, mapped to the app's Room shape. */
export async function loadLiteApiRooms(hotelId: string): Promise<Room[]> {
  try {
    const { data } = await supabase.functions.invoke('liteapi-content-ts', {
      body: { action: 'hotelDetails', hotelId },
    });
    const d = (data as any)?.data ?? data;
    const rooms = d?.rooms || [];
    return rooms.map((r: any) => ({
      id: String(r.id),
      property_id: hotelId,
      name: r.roomName || r.name || 'Room',
      description: stripHtml(r.description) || null,
      max_adults: r.maxAdults ?? 2,
      max_children: r.maxChildren ?? 0,
      bed_configuration:
        (r.bedTypes || []).map((b: any) => `${b.quantity}× ${b.bedType}`).join(', ') || null,
      amenities: (r.roomAmenities || []).map((a: any) => a.name).slice(0, 12),
      avg_rate: null,
      actual_rate: null,
      currency: geo_currency(hotelId),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

// Rooms carry no currency from content; default by nothing known here.
function geo_currency(_hotelId: string): string {
  return 'NZD';
}
