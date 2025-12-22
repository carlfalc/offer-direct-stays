import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Property } from '@/types';
import { useTrip } from '@/contexts/TripContext';
import { Lightbulb } from 'lucide-react';

interface MapPanelProps {
  properties: Property[];
  selectedPropertyId: string | null;
  shortlistedIds: string[];
  watchlistedIds?: string[];
  onPropertySelect: (property: Property) => void;
  onPropertyClick?: (property: Property) => void;
  mapboxToken: string;
  onTokenChange: (token: string) => void;
}

export default function MapPanel({
  properties,
  selectedPropertyId,
  shortlistedIds,
  watchlistedIds = [],
  onPropertySelect,
  onPropertyClick,
  mapboxToken,
  onTokenChange,
}: MapPanelProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const { getPropertyPriceEstimate, trip } = useTrip();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [172.5, -41.5], // Center of NZ
        zoom: 4,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );

      map.current.on('load', () => {
        setIsMapReady(true);
      });

      return () => {
        map.current?.remove();
        markers.current = [];
      };
    } catch (error) {
      console.error('Map initialization error:', error);
    }
  }, [mapboxToken]);

  // Update markers when properties change
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    // Remove existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    const currencySymbol = trip.currency === 'AUD' ? 'A$' : 'NZ$';

    // Add new markers with price labels
    properties.forEach((property) => {
      if (property.latitude && property.longitude) {
        const isSelected = property.id === selectedPropertyId;
        const isShortlisted = shortlistedIds.includes(property.id);
        const isWatchlisted = watchlistedIds.includes(property.id);

        // Get price estimate for pin
        const priceEstimate = getPropertyPriceEstimate(property.id);
        const displayPrice = Math.round((priceEstimate.low + priceEstimate.high) / 2);

        // Create custom marker element with price label
        const el = document.createElement('div');
        el.className = 'custom-marker-with-price';
        el.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: transform 0.2s ease;
        `;

        // Price label
        const priceLabel = document.createElement('div');
        priceLabel.textContent = `~${currencySymbol}${displayPrice}`;
        priceLabel.style.cssText = `
          background: ${isShortlisted || isWatchlisted ? 'hsl(150, 14%, 50%)' : isSelected ? 'hsl(38, 72%, 62%)' : 'hsl(215, 50%, 25%)'};
          color: white;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 12px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
        `;
        el.appendChild(priceLabel);

        // Pin dot
        const pinDot = document.createElement('div');
        pinDot.style.cssText = `
          width: 8px;
          height: 8px;
          background: ${isShortlisted || isWatchlisted ? 'hsl(150, 14%, 50%)' : isSelected ? 'hsl(38, 72%, 62%)' : 'hsl(215, 50%, 25%)'};
          border-radius: 50%;
          margin-top: 2px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        el.appendChild(pinDot);

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.1)';
          el.style.zIndex = '10';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
          el.style.zIndex = '';
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([property.longitude, property.latitude])
          .addTo(map.current!);

        el.addEventListener('click', () => {
          if (onPropertyClick) {
            onPropertyClick(property);
          } else {
            onPropertySelect(property);
          }
        });

        markers.current.push(marker);
      }
    });

    // Fit bounds if we have properties
    if (properties.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      let hasValidCoords = false;

      properties.forEach((property) => {
        if (property.latitude && property.longitude) {
          bounds.extend([property.longitude, property.latitude]);
          hasValidCoords = true;
        }
      });

      if (hasValidCoords) {
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 12,
        });
      }
    }
  }, [properties, selectedPropertyId, shortlistedIds, watchlistedIds, isMapReady, onPropertySelect, onPropertyClick, getPropertyPriceEstimate, trip.currency]);

  // No token state - show placeholder instead of blocking UI
  if (!mapboxToken) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/30 p-8 border-l border-border">
        <div className="text-center space-y-3 max-w-xs">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="font-semibold text-foreground">Map preview (coming soon)</h3>
          <p className="text-sm text-muted-foreground">
            Add your Mapbox token in Settings to enable the 3D map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Map tip overlay */}
      <div className="absolute top-4 left-4 right-16 z-10 pointer-events-none">
        <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-border inline-flex items-center gap-2 max-w-md">
          <Lightbulb className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Tip:</span> Move the map to explore more stays. Tap a pin to see rooms & make an offer.
          </p>
        </div>
      </div>
    </div>
  );
}
