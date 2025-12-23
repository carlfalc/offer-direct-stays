import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin } from 'lucide-react';

export interface AddressData {
  addressLine1: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteProps {
  value: AddressData;
  onChange: (data: AddressData) => void;
  mapboxToken?: string;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
  properties?: {
    address?: string;
  };
  address?: string;
}

export function AddressAutocomplete({ value, onChange, mapboxToken }: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value.addressLine1 || '');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isManualMode, setIsManualMode] = useState(!mapboxToken);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync query with value when it changes externally
  useEffect(() => {
    if (value.addressLine1 && value.addressLine1 !== query) {
      setQuery(value.addressLine1);
    }
  }, [value.addressLine1]);

  const searchAddress = async (searchQuery: string) => {
    if (!mapboxToken || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxToken}&types=address&limit=5`
      );
      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Address search error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    
    if (isManualMode) {
      onChange({ ...value, addressLine1: newQuery });
      return;
    }

    // Debounce API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchAddress(newQuery);
    }, 300);
  };

  const parseMapboxFeature = (feature: MapboxFeature): AddressData => {
    const context = feature.context || [];
    
    // Extract components from context
    let city = '';
    let region = '';
    let postcode = '';
    let country = '';
    let countryCode = '';

    for (const ctx of context) {
      if (ctx.id.startsWith('place')) {
        city = ctx.text;
      } else if (ctx.id.startsWith('locality')) {
        if (!city) city = ctx.text;
      } else if (ctx.id.startsWith('region')) {
        region = ctx.text;
      } else if (ctx.id.startsWith('postcode')) {
        postcode = ctx.text;
      } else if (ctx.id.startsWith('country')) {
        country = ctx.short_code?.toUpperCase() || ctx.text;
        countryCode = ctx.short_code?.toUpperCase() || '';
      }
    }

    // Build address line from street number + street name
    const streetNumber = feature.address || feature.properties?.address || '';
    const streetName = feature.text || '';
    const addressLine1 = streetNumber ? `${streetNumber} ${streetName}` : streetName;

    return {
      addressLine1: addressLine1 || feature.place_name.split(',')[0],
      city,
      region,
      postcode,
      country: countryCode || country,
      lat: feature.center[1],
      lng: feature.center[0],
    };
  };

  const handleSelectSuggestion = (feature: MapboxFeature) => {
    const parsed = parseMapboxFeature(feature);
    setQuery(parsed.addressLine1);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange(parsed);
  };

  const handleManualFieldChange = (field: keyof AddressData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  // Manual mode fallback UI
  if (isManualMode) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="addressLine1">Business Address *</Label>
          <Input
            id="addressLine1"
            value={value.addressLine1}
            onChange={(e) => handleManualFieldChange('addressLine1', e.target.value)}
            placeholder="Enter your business address"
          />
          <p className="text-xs text-muted-foreground">
            Address autocomplete unavailable. Please enter details manually.
          </p>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City / Suburb *</Label>
            <Input
              id="city"
              value={value.city}
              onChange={(e) => handleManualFieldChange('city', e.target.value)}
              placeholder="e.g., Auckland"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="region">Region / State *</Label>
            <Input
              id="region"
              value={value.region}
              onChange={(e) => handleManualFieldChange('region', e.target.value)}
              placeholder="e.g., Auckland Region"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode *</Label>
            <Input
              id="postcode"
              value={value.postcode}
              onChange={(e) => handleManualFieldChange('postcode', e.target.value)}
              placeholder="e.g., 1010"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="country">Country *</Label>
            <Input
              id="country"
              value={value.country}
              onChange={(e) => handleManualFieldChange('country', e.target.value)}
              placeholder="e.g., NZ"
            />
          </div>
        </div>
      </div>
    );
  }

  // Autocomplete mode UI
  return (
    <div className="space-y-4">
      <div className="space-y-2" ref={containerRef}>
        <Label htmlFor="addressSearch">Business Address *</Label>
        <div className="relative">
          <Input
            id="addressSearch"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Start typing your address..."
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MapPin className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
              {suggestions.map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                  onClick={() => handleSelectSuggestion(feature)}
                >
                  <span className="font-medium">{feature.text}</span>
                  <span className="text-muted-foreground ml-1">
                    {feature.place_name.replace(feature.text + ', ', '')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Start typing your address and select a suggestion.
        </p>
      </div>
      
      {/* Read-only parsed fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">City / Suburb</Label>
          <Input
            id="city"
            value={value.city}
            readOnly
            className="bg-muted/50"
            placeholder="Auto-filled from address"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="region">Region / State</Label>
          <Input
            id="region"
            value={value.region}
            readOnly
            className="bg-muted/50"
            placeholder="Auto-filled from address"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="postcode">Postcode</Label>
          <Input
            id="postcode"
            value={value.postcode}
            readOnly
            className="bg-muted/50"
            placeholder="Auto-filled from address"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={value.country}
            readOnly
            className="bg-muted/50"
            placeholder="Auto-filled from address"
          />
        </div>
      </div>
    </div>
  );
}
