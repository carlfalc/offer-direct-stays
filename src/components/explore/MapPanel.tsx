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
    </div>
  );
}
