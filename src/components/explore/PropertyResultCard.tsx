import { Property } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Heart, Star } from 'lucide-react';
import { useTrip, PropertyPriceEstimate } from '@/contexts/TripContext';

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

  // Get top 3 amenities
  const topAmenities = property.amenities?.slice(0, 3) || [];
  
  // Generate short highlights from property description
  const highlights = property.description
    ? property.description.split('.').slice(0, 2).map(s => s.trim()).filter(Boolean)
    : [];

  const currencySymbol = trip.currency === 'AUD' ? 'A$' : 'NZ$';

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex gap-3 p-3">
        {/* Image */}
        {property.image_url && (
          <img
            src={property.image_url}
            alt={property.name}
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
          />
        )}
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h4 className="font-semibold text-sm truncate">{property.name}</h4>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {property.area ? `${property.area}, ` : ''}{property.city}
                </span>
              </div>
            </div>
            
            {/* Badges */}
            <div className="flex gap-1 flex-shrink-0">
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {propertyTypeLabels[property.property_type] || property.property_type}
              </Badge>
              {property.registration_status === 'registered' && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 text-success border-success">
                  Registered
                </Badge>
              )}
            </div>
          </div>

          {/* Price Guide Panel */}
          {priceEstimate && (
            <div className="bg-muted/50 rounded-md p-2 my-2 space-y-1">
              <p className="text-xs font-medium">
                Est. {currencySymbol}{priceEstimate.low}–{priceEstimate.high} / night
                <span className="text-muted-foreground font-normal"> (guide for your dates)</span>
              </p>
              {priceEstimate.sampleSize >= 50 && (
                <p className="text-xs text-muted-foreground">
                  Travellers like you typically book {currencySymbol}{priceEstimate.p25}–{priceEstimate.p75} / night
                </p>
              )}
            </div>
          )}

          {/* Amenities chips */}
          {topAmenities.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {topAmenities.map((amenity) => (
                <Badge key={amenity} variant="outline" className="text-xs px-1.5 py-0">
                  {amenity}
                </Badge>
              ))}
            </div>
          )}

          {/* Highlights */}
          {highlights.length > 0 && (
            <div className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {highlights.map((h, i) => (
                <span key={i}>
                  <Star className="inline h-3 w-3 mr-0.5 text-primary/60" />
                  {h}
                  {i < highlights.length - 1 && ' • '}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="text-xs h-7 flex-1" onClick={onMakeOffer}>
              Make an offer
            </Button>
            <Button
              size="sm"
              variant={isWatchlisted ? 'secondary' : 'outline'}
              className={`text-xs h-7 ${isWatchlisted ? 'text-destructive' : ''}`}
              onClick={onAddToWatchlist}
            >
              <Heart className={`h-3 w-3 mr-1 ${isWatchlisted ? 'fill-current' : ''}`} />
              {isWatchlisted ? 'Saved' : 'Watchlist'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
