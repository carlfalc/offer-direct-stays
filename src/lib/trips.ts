import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types';

export interface FsTrip {
  id: string;
  name: string;
  created_at: string;
}

export interface FsTripItem {
  id: string;
  trip_id: string;
  property_id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export async function listTrips(userId: string): Promise<FsTrip[]> {
  const { data } = await supabase
    .from('fs_trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as any) || [];
}

export async function listTripItems(userId: string): Promise<FsTripItem[]> {
  const { data } = await supabase
    .from('fs_trip_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as any) || [];
}

/** Property ids the traveller has saved into any trip (drives the red heart). */
export async function getSavedPropertyIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('fs_trip_items').select('property_id').eq('user_id', userId);
  return new Set(((data as any) || []).map((r: any) => r.property_id));
}

export async function createTrip(userId: string, name: string): Promise<FsTrip | null> {
  const { data, error } = await supabase
    .from('fs_trips')
    .insert({ user_id: userId, name: name.trim() } as any)
    .select()
    .single();
  if (error) return null;
  return data as any;
}

export async function saveToTrip(userId: string, tripId: string, p: Property) {
  return supabase.from('fs_trip_items').upsert(
    {
      trip_id: tripId,
      user_id: userId,
      property_id: p.id,
      name: p.name,
      city: p.city,
      country: p.country,
      image_url: p.image_url,
      lat: p.latitude,
      lng: p.longitude,
    } as any,
    { onConflict: 'trip_id,property_id' },
  );
}

export async function removeTripItem(userId: string, tripId: string, propertyId: string) {
  return supabase
    .from('fs_trip_items')
    .delete()
    .eq('user_id', userId)
    .eq('trip_id', tripId)
    .eq('property_id', propertyId);
}

export async function deleteTrip(userId: string, tripId: string) {
  return supabase.from('fs_trips').delete().eq('user_id', userId).eq('id', tripId);
}
