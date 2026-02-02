import { Property } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Heart, Sparkles } from 'lucide-react';
import { useTrip, PropertyPriceEstimate } from '@/contexts/TripContext';
import { cn } from '@/lib/utils';

interface PropertyResultCardProps {
  property: Property;
  onMakeOffer: () => void;
  onAddToWatchlist: () => void;
  isWatchlisted: boolean;
  priceEstimate?: PropertyPriceEstimate;
}

export default function PropertyResultCard({
  property,
  onMakeOffer,
  onAddToWatchlist,
  isWatchlisted,
  priceEstimate,
}: PropertyResultCardProps) {
  const { trip } = useTrip();
  
  const propertyTypeLabels: Record<string, string> = {
    hotel: 'Hotel',
    motel: 'Motel',
    hostel: 'Hostel',
    apartment: 'Apartment',
    house: 'House',
    cabin: 'Cabin',
    resort: 'Resort',
    bnb: 'B&B',
  };

  const topAmenities = property.amenities?.slice(0, 3) || [];
  const currencySymbol = trip.currency === 'AUD' ? 'A$' : 'NZ$';

  return (
    <div className={cn(
      "premium-card overflow-hidden group",
      "hover:border-primary/40"
    )}>
      <div className="flex gap-4 p-4">
        {/* Image */}
        {property.image_url && (
          <div className="relative flex-shrink-0">
            <img
              src={property.image_url}
              alt={property.name}
              className="w-24 h-24 rounded-xl object-cover"
            />
            {property.registration_status === 'registered' && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-accent-foreground" />
              </div>
            )}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h4 className="font-semibold text-foreground truncate">{property.name}</h4>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">
                  {property.area ? `${property.area}, ` : ''}{property.city}
                </span>
              </div>
            </div>
            
            <Badge 
              variant="outline" 
              className="text-xs px-2 py-0.5 border-primary/30 text-primary bg-primary/5"
            >
              {propertyTypeLabels[property.property_type] || property.property_type}
            </Badge>
          </div>

          {/* Price Guide */}
          {priceEstimate && (
            <div className="bg-secondary/5 rounded-lg p-3 my-2 border border-border/30">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold text-foreground">
                  {currencySymbol}{priceEstimate.low}–{priceEstimate.high}
                </span>
                <span className="text-sm text-muted-foreground">/night</span>
              </div>
              {priceEstimate.sampleSize >= 50 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Most book at {currencySymbol}{priceEstimate.p25}–{priceEstimate.p75}
                </p>
              )}
            </div>
          )}

          {/* Amenities */}
          {topAmenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {topAmenities.map((amenity) => (
                <span 
                  key={amenity} 
                  className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground"
                >
                  {amenity}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className={cn(
                "flex-1 text-sm h-9 font-medium",
                "bg-primary hover:bg-primary/90 text-primary-foreground"
              )}
              onClick={onMakeOffer}
            >
              Make an offer
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-9 px-3",
                isWatchlisted 
                  ? "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20" 
                  : "hover:border-primary/30 hover:bg-primary/5"
              )}
              onClick={onAddToWatchlist}
            >
              <Heart className={cn(
                "h-4 w-4",
                isWatchlisted && "fill-current text-accent"
              )} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
