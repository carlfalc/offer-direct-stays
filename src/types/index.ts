export interface Property {
  id: string;
  business_id: string | null;
  name: string;
  description: string | null;
  property_type: 'hotel' | 'motel' | 'hostel' | 'apartment' | 'house' | 'cabin' | 'resort' | 'bnb';
  country: 'NZ' | 'AU';
  city: string;
  area: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  amenities: string[] | null;
  registration_status: string | null;
  is_claimed: boolean | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  max_adults: number;
  max_children: number;
  bed_configuration: string | null;
  amenities: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  properties?: Property[];
  rooms?: Room[];
}

export interface ShortlistItem {
  property: Property;
  selectedRoom?: Room;
}

export interface GuestPreferences {
  destination?: string;
  checkIn?: Date;
  checkOut?: Date;
  adults: number;
  children: number;
  accessibilityNeeds?: string;
  amenitiesRequired?: string[];
  notes?: string;
}
