import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Property } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MapPanelProps {
  properties: Property[];
  selectedPropertyId: string | null;
  shortlistedIds: string[];
  onPropertySelect: (property: Property) => void;
  mapboxToken: string;
  onTokenChange: (token: string) => void;
}

export default function MapPanel({
  properties,
  selectedPropertyId,
  shortlistedIds,
  onPropertySelect,
  mapboxToken,
  onTokenChange,
}: MapPanelProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

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

    // Add new markers
    properties.forEach((property) => {
      if (property.latitude && property.longitude) {
        const isSelected = property.id === selectedPropertyId;
        const isShortlisted = shortlistedIds.includes(property.id);

        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.cssText = `
          width: ${isSelected ? '36px' : '28px'};
          height: ${isSelected ? '36px' : '28px'};
          background: ${isShortlisted ? 'hsl(150, 14%, 50%)' : isSelected ? 'hsl(38, 72%, 62%)' : 'hsl(215, 50%, 25%)'};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        // Add inner dot for shortlisted
        if (isShortlisted) {
          const check = document.createElement('div');
          check.style.cssText = `
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
          `;
          el.appendChild(check);
        }

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.2)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([property.longitude, property.latitude])
          .addTo(map.current!);

        // Add popup
        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          className: 'property-popup',
        }).setHTML(`
          <div style="padding: 8px; min-width: 150px;">
            <strong style="display: block; margin-bottom: 4px;">${property.name}</strong>
            <span style="color: #666; font-size: 12px;">${property.city}, ${property.country}</span>
          </div>
        `);

        marker.setPopup(popup);

        el.addEventListener('click', () => {
          onPropertySelect(property);
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
  }, [properties, selectedPropertyId, shortlistedIds, isMapReady, onPropertySelect]);

  // No token state
  if (!mapboxToken) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/50 p-8">
        <div className="max-w-md text-center space-y-4">
          <h3 className="font-semibold text-lg">Map Setup Required</h3>
          <p className="text-sm text-muted-foreground">
            Enter your Mapbox public token to enable the map. You can find it at{' '}
            <a 
              href="https://mapbox.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              mapbox.com
            </a>{' '}
            in the Tokens section of your dashboard.
          </p>
          <div className="space-y-2 text-left">
            <Label htmlFor="mapbox-token">Mapbox Public Token</Label>
            <Input
              id="mapbox-token"
              placeholder="pk.eyJ1..."
              onChange={(e) => onTokenChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
}
