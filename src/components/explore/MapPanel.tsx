import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Property } from '@/types';
import { useTrip } from '@/contexts/TripContext';
import { MapPin, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

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

// Mock pricing pins for the stylized map
const MOCK_PINS = [
  { lat: -33.87, lng: 151.21, price: '$185', city: 'Sydney' },
  { lat: -37.82, lng: 144.97, price: '$142', city: 'Melbourne' },
  { lat: -27.47, lng: 153.02, price: '$168', city: 'Brisbane' },
  { lat: -28.02, lng: 153.43, price: '$195', city: 'Gold Coast' },
  { lat: -36.85, lng: 174.76, price: '$165', city: 'Auckland' },
  { lat: -41.29, lng: 174.78, price: '$138', city: 'Wellington' },
  { lat: -45.03, lng: 168.66, price: '$220', city: 'Queenstown' },
  { lat: -43.53, lng: 172.64, price: '$125', city: 'Christchurch' },
];

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
  const hoverPopup = useRef<mapboxgl.Popup | null>(null);
  const { getPropertyPriceEstimate, trip } = useTrip();

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [150, -30],
        zoom: 3.5,
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

  // Keep the canvas correct when returning to the tab or resizing, so markers don't mis-render.
  useEffect(() => {
    const resize = () => {
      try {
        map.current?.resize();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('focus', resize);
    document.addEventListener('visibilitychange', resize);
    return () => {
      window.removeEventListener('focus', resize);
      document.removeEventListener('visibilitychange', resize);
    };
  }, []);

  // Rebuild markers ONLY when the set of properties changes — never on hover, selection,
  // zoom, pan, or tab-return — so pins never flicker or vanish.
  const propsKey = properties.map((p) => p.id).join('|');

  useEffect(() => {
    if (!map.current || !isMapReady) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    hoverPopup.current?.remove();

    const currencySymbol = trip.currency === 'AUD' ? 'A$' : 'NZ$';

    properties.forEach((property) => {
      if (property.latitude && property.longitude) {
        const isSelected = property.id === selectedPropertyId;
        const isShortlisted = shortlistedIds.includes(property.id);
        const isWatchlisted = watchlistedIds.includes(property.id);
        const isEv = (property.amenities || []).some((amenity) => {
          const value = amenity.toLowerCase().replace(/[-_]/g, ' ');
          return value.includes('ev') && value.includes('charg');
        });

        const priceEstimate = getPropertyPriceEstimate(property.id);
        const displayPrice = Math.round((priceEstimate.low + priceEstimate.high) / 2);

        const el = document.createElement('div');
        el.className = 'premium-map-pin';
        el.innerHTML = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            <div style="
              background: ${isShortlisted || isWatchlisted 
                ? 'linear-gradient(135deg, hsl(190, 64%, 34%), hsl(190, 64%, 44%))' 
                : isSelected 
                  ? 'linear-gradient(135deg, hsl(40, 45%, 55%), hsl(40, 55%, 65%))' 
                  : 'linear-gradient(135deg, hsl(220, 26%, 15%), hsl(220, 26%, 25%))'};
              color: ${isSelected || isShortlisted || isWatchlisted ? 'hsl(220, 26%, 9%)' : 'hsl(40, 33%, 96%)'};
              font-size: 12px;
              font-weight: 600;
              padding: 6px 12px;
              border-radius: 20px;
              white-space: nowrap;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3), ${isSelected ? '0 0 20px hsla(40, 45%, 60%, 0.4)' : 'none'};
              transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
              display: flex;
              align-items: center;
              gap: 6px;
            ">
              ${property.is_claimed ? `<span>~${currencySymbol}${displayPrice}</span>` : ''}
              ${isEv ? `
                <span style="
                  font-size: 10px;
                  font-weight: 700;
                  letter-spacing: 0.4px;
                  padding: 2px 6px;
                  border-radius: 999px;
                  border: 1px solid hsla(190, 64%, 44%, 0.7);
                  background: hsla(190, 64%, 34%, 0.15);
                  color: hsl(190, 64%, 44%);
                ">⚡ EV</span>
              ` : ''}
              ${!property.is_claimed ? `
                <span style="
                  font-size: 10px;
                  font-weight: 700;
                  letter-spacing: 0.3px;
                  padding: 2px 6px;
                  border-radius: 999px;
                  border: 1px solid hsla(40, 80%, 55%, 0.7);
                  background: hsla(40, 80%, 50%, 0.18);
                  color: hsl(40, 85%, 62%);
                ">Claim</span>
              ` : ''}
            </div>
            <div style="
              width: 2px;
              height: 8px;
              background: ${isShortlisted || isWatchlisted 
                ? 'hsl(190, 64%, 34%)' 
                : isSelected 
                  ? 'hsl(40, 45%, 60%)' 
                  : 'hsl(220, 26%, 20%)'};
              margin-top: 2px;
            "></div>
            <div style="
              width: 8px;
              height: 8px;
              background: ${isShortlisted || isWatchlisted 
                ? 'hsl(190, 64%, 34%)' 
                : isSelected 
                  ? 'hsl(40, 45%, 60%)' 
                  : 'hsl(220, 26%, 20%)'};
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            "></div>
          </div>
        `;

        // Scale an inner wrapper on hover — never the marker element itself, or it
        // overwrites Mapbox's own position transform and the pin jumps off-screen.
        const inner = el.firstElementChild as HTMLElement | null;
        el.addEventListener('mouseenter', () => {
          if (inner) inner.style.transform = 'scale(1.12)';
          el.style.zIndex = '10';
          if (!hoverPopup.current) {
            hoverPopup.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 22, className: 'fs-pin-popup' });
          }
          hoverPopup.current
            .setLngLat([property.longitude!, property.latitude!])
            .setHTML(
              `<div style="display:flex;gap:8px;align-items:center;max-width:230px">` +
                (property.image_url
                  ? `<img src="${esc(property.image_url)}" alt="" style="width:46px;height:46px;border-radius:8px;object-fit:cover;flex:none" onerror="this.style.display='none'"/>`
                  : '') +
                `<div style="min-width:0">` +
                `<div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(property.name)}</div>` +
                `<div style="font-size:11px;opacity:.75">${property.is_claimed ? 'Open to offers · tap to view' : 'Unclaimed · tap to view / claim'}</div>` +
                `</div></div>`,
            )
            .addTo(map.current!);
        });
        el.addEventListener('mouseleave', () => {
          if (inner) inner.style.transform = 'scale(1)';
          el.style.zIndex = '';
          hoverPopup.current?.remove();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propsKey, isMapReady, trip.currency]);

  // Stylized map placeholder when no token
  if (!mapboxToken) {
    return (
      <div className="h-full relative overflow-hidden bg-secondary">
        {/* Stylized gradient map background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary/95 to-accent/10" />
          
          {/* Subtle grid pattern */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px'
            }}
          />

          {/* Stylized land masses */}
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <ellipse cx="70" cy="40" rx="15" ry="20" fill="hsl(var(--primary) / 0.3)" />
            <ellipse cx="75" cy="65" rx="8" ry="12" fill="hsl(var(--primary) / 0.25)" />
            <ellipse cx="85" cy="70" rx="5" ry="8" fill="hsl(var(--accent) / 0.3)" />
            <ellipse cx="90" cy="80" rx="4" ry="6" fill="hsl(var(--accent) / 0.25)" />
          </svg>
        </div>

        {/* Mock pricing pins */}
        <div className="absolute inset-0 pointer-events-none">
          {MOCK_PINS.map((pin, index) => (
            <div
              key={index}
              className={cn(
                "absolute transform -translate-x-1/2 -translate-y-1/2 animate-fade-in",
                "opacity-60 hover:opacity-100 transition-opacity"
              )}
              style={{
                left: `${((pin.lng + 180) / 360) * 100}%`,
                top: `${((pin.lat * -1 + 90) / 180) * 100}%`,
                animationDelay: `${index * 150}ms`
              }}
            >
              <div className="flex flex-col items-center">
                <div className="bg-primary/90 text-primary-foreground text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg">
                  {pin.price}
                </div>
                <div className="w-0.5 h-2 bg-primary/50 mt-0.5" />
                <div className="w-2 h-2 rounded-full bg-primary/50" />
              </div>
            </div>
          ))}
        </div>

        {/* Central content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4 p-8 max-w-md">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 animate-float">
              <MapPin className="w-10 h-10 text-primary" />
            </div>
            
            <h3 className="text-2xl font-semibold text-secondary-foreground">
              Interactive Map
            </h3>
            
            <p className="text-secondary-foreground/70 text-sm leading-relaxed">
              Real-time pricing pins will appear here as you explore. Start by telling us where you'd like to stay.
            </p>

            <div className="flex items-center justify-center gap-2 text-xs text-primary/80">
              <Sparkles className="w-4 h-4" />
              <span>Powered by AI price predictions</span>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-secondary to-transparent" />

        {/* Legend */}
        <div className="absolute bottom-6 left-6 pointer-events-none">
          <div className="bg-secondary/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-border/30 shadow-lg text-xs text-secondary-foreground/80 space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary/70" />
              <span>Price pins</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-5 px-2 rounded-full border border-primary/40 text-[10px] font-semibold text-primary">⚡ EV</span>
              <span>EV charging</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Map tip overlay */}
      <div className="absolute top-4 left-4 right-16 z-10 pointer-events-none">
        <div className="bg-secondary/90 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-lg border border-border/30 inline-flex items-center gap-2 max-w-md">
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-xs text-secondary-foreground/80">
            <span className="font-medium text-secondary-foreground">Explore freely</span> — tap any pin to see rooms & make an offer
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-10 pointer-events-none">
        <div className="bg-secondary/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-border/30 shadow-lg text-xs text-secondary-foreground/80 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-primary/70" />
            <span>Price pins</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-5 px-2 rounded-full border border-primary/40 text-[10px] font-semibold text-primary">⚡ EV</span>
            <span>EV charging</span>
          </div>
        </div>
      </div>
    </div>
  );
}
