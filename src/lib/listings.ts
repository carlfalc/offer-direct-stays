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
export async function searchListings(geo: GeoPoint, limit = 24): Promise<Property[]> {
  const invoke = (params: Record<string, unknown>) =>
    supabase.functions.invoke('liteapi-content-ts', {
      body: { action: 'searchHotels', params },
    });

  let hotels: any[] = [];
  try {
    const { data } = await invoke({
      countryCode: geo.country,
      latitude: geo.lat,
      longitude: geo.lng,
      radius: 25000,
      limit,
    });
    const d = (data as any)?.data ?? data;
    if (Array.isArray(d)) hotels = d;
  } catch {
    /* ignore — try city fallback */
  }

  if (!hotels.length) {
    try {
      const { data } = await invoke({ countryCode: geo.country, cityName: geo.name, limit });
      const d = (data as any)?.data ?? data;
      if (Array.isArray(d)) hotels = d;
    } catch {
      /* ignore */
    }
  }

  let props = hotels
    .map((h) => mapHotelToProperty(h, geo.country))
    .filter((p) => p.latitude != null && p.longitude != null);

  // Keep it local: nearest within 60km, else the nearest dozen
  props = props
    .map((p) => ({ p, d: distKm(geo.lat, geo.lng, p.latitude as number, p.longitude as number) }))
    .sort((a, b) => a.d - b.d)
    .filter((x, i) => x.d <= 60 || i < 12)
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
