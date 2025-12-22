import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface TripDestination {
  city: string;
  country: 'NZ' | 'AU';
  latitude: number;
  longitude: number;
  radius: number; // km
}

export interface TripContextData {
  destination: TripDestination | null;
  checkIn: Date | null;
  checkOut: Date | null;
  adults: number;
  children: number;
  amenities: string[];
  roomPref: string | null; // e.g., 'studio', 'suite', 'family'
  bedPref: string | null; // e.g., 'queen', 'twin', 'king'
  budget: { low: number; high: number } | null;
  currency: 'NZD' | 'AUD';
}

export interface PropertyPriceEstimate {
  low: number;
  high: number;
  p25: number;
  p75: number;
  sampleSize: number;
  currency: 'NZD' | 'AUD';
}

interface TripContextType {
  trip: TripContextData;
  setDestination: (destination: TripDestination | null) => void;
  setCheckIn: (date: Date | null) => void;
  setCheckOut: (date: Date | null) => void;
  setAdults: (count: number) => void;
  setChildren: (count: number) => void;
  setAmenities: (amenities: string[]) => void;
  setRoomPref: (pref: string | null) => void;
  setBedPref: (pref: string | null) => void;
  setBudget: (budget: { low: number; high: number } | null) => void;
  setCurrency: (currency: 'NZD' | 'AUD') => void;
  resetTrip: () => void;
  getNights: () => number;
  // Demo price estimate generator
  getPropertyPriceEstimate: (propertyId: string) => PropertyPriceEstimate;
}

const defaultTrip: TripContextData = {
  destination: null,
  checkIn: null,
  checkOut: null,
  adults: 2,
  children: 0,
  amenities: [],
  roomPref: null,
  bedPref: null,
  budget: null,
  currency: 'NZD',
};

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [trip, setTrip] = useState<TripContextData>(defaultTrip);

  const setDestination = (destination: TripDestination | null) => {
    setTrip(prev => ({
      ...prev,
      destination,
      currency: destination?.country === 'AU' ? 'AUD' : 'NZD',
    }));
  };

  const setCheckIn = (date: Date | null) => {
    setTrip(prev => ({ ...prev, checkIn: date }));
  };

  const setCheckOut = (date: Date | null) => {
    setTrip(prev => ({ ...prev, checkOut: date }));
  };

  const setAdults = (count: number) => {
    setTrip(prev => ({ ...prev, adults: Math.max(1, count) }));
  };

  const setChildren = (count: number) => {
    setTrip(prev => ({ ...prev, children: Math.max(0, count) }));
  };

  const setAmenities = (amenities: string[]) => {
    setTrip(prev => ({ ...prev, amenities }));
  };

  const setRoomPref = (pref: string | null) => {
    setTrip(prev => ({ ...prev, roomPref: pref }));
  };

  const setBedPref = (pref: string | null) => {
    setTrip(prev => ({ ...prev, bedPref: pref }));
  };

  const setBudget = (budget: { low: number; high: number } | null) => {
    setTrip(prev => ({ ...prev, budget }));
  };

  const setCurrency = (currency: 'NZD' | 'AUD') => {
    setTrip(prev => ({ ...prev, currency }));
  };

  const resetTrip = () => {
    setTrip(defaultTrip);
  };

  const getNights = () => {
    if (!trip.checkIn || !trip.checkOut) return 1;
    const diff = trip.checkOut.getTime() - trip.checkIn.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Demo price estimate generator - seeded by property ID for consistency
  const getPropertyPriceEstimate = (propertyId: string): PropertyPriceEstimate => {
    // Simple hash from property ID to get consistent prices
    let hash = 0;
    for (let i = 0; i < propertyId.length; i++) {
      hash = ((hash << 5) - hash) + propertyId.charCodeAt(i);
      hash = hash & hash;
    }
    
    const basePrice = 120 + Math.abs(hash % 180); // 120-300 base
    const variance = 20 + Math.abs((hash >> 8) % 40); // 20-60 variance
    
    return {
      low: basePrice - variance,
      high: basePrice + variance,
      p25: basePrice - Math.floor(variance / 2),
      p75: basePrice + Math.floor(variance / 2),
      sampleSize: 50 + Math.abs((hash >> 16) % 150), // 50-200 sample
      currency: trip.currency,
    };
  };

  return (
    <TripContext.Provider
      value={{
        trip,
        setDestination,
        setCheckIn,
        setCheckOut,
        setAdults,
        setChildren,
        setAmenities,
        setRoomPref,
        setBedPref,
        setBudget,
        setCurrency,
        resetTrip,
        getNights,
        getPropertyPriceEstimate,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
}
