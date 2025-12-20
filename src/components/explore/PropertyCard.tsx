import { Property } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Star, Plus, Check } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
  onSelect: () => void;
  isShortlisted: boolean;
  compact?: boolean;
}

export default function PropertyCard({ 
  property, 
  onSelect, 
  isShortlisted,
  compact = false 
}: PropertyCardProps) {
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

  if (compact) {
    return (
      <Card 
        className={`p-3 cursor-pointer transition-all hover:shadow-md ${
          isShortlisted ? 'ring-2 ring-success bg-success/5' : ''
        }`}
        onClick={onSelect}
      >
        <div className="flex gap-3">
          {property.image_url && (
            <img
              src={property.image_url}
              alt={property.name}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm truncate">{property.name}</h4>
              {isShortlisted ? (
                <Check className="h-4 w-4 text-success flex-shrink-0" />
              ) : (
                <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3" />
              <span>{property.city}, {property.country}</span>
            </div>
            <div className="flex gap-1 mt-2">
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
        </div>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden transition-all hover:shadow-lg ${
      isShortlisted ? 'ring-2 ring-success' : ''
    }`}>
      {property.image_url && (
        <div className="relative h-48">
          <img
            src={property.image_url}
            alt={property.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 right-3">
            <Button
              size="icon"
              variant={isShortlisted ? "default" : "secondary"}
              className={isShortlisted ? "bg-success hover:bg-success/90" : ""}
              onClick={onSelect}
            >
              {isShortlisted ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-lg">{property.name}</h3>
        </div>
        
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <MapPin className="h-4 w-4" />
          <span>{property.area ? `${property.area}, ` : ''}{property.city}, {property.country}</span>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {property.description}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary">
            {propertyTypeLabels[property.property_type] || property.property_type}
          </Badge>
          {property.registration_status === 'registered' && (
            <Badge variant="outline" className="text-success border-success">
              Registered
            </Badge>
          )}
        </div>
        
        {property.amenities && property.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {property.amenities.slice(0, 4).map((amenity) => (
              <Badge key={amenity} variant="outline" className="text-xs">
                {amenity}
              </Badge>
            ))}
            {property.amenities.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{property.amenities.length - 4} more
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
