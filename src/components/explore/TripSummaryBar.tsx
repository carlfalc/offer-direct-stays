import { useTrip } from '@/contexts/TripContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Users, X } from 'lucide-react';
import { format } from 'date-fns';

interface TripSummaryBarProps {
  onEdit?: () => void;
}

export default function TripSummaryBar({ onEdit }: TripSummaryBarProps) {
  const { trip, resetTrip } = useTrip();

  // Don't show if no trip context set
  if (!trip.destination && !trip.checkIn && !trip.checkOut) {
    return null;
  }

  const formatDateRange = () => {
    if (!trip.checkIn || !trip.checkOut) return null;
    return `${format(trip.checkIn, 'MMM d')} – ${format(trip.checkOut, 'MMM d')}`;
  };

  const guestCount = trip.adults + trip.children;
  const guestLabel = `${trip.adults} adult${trip.adults > 1 ? 's' : ''}${
    trip.children > 0 ? `, ${trip.children} child${trip.children > 1 ? 'ren' : ''}` : ''
  }`;

  return (
    <div className="bg-primary/5 border-b border-primary/20 px-4 py-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {trip.destination && (
            <Badge variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5">
              <MapPin className="h-3 w-3" />
              <span>{trip.destination.city}, {trip.destination.country}</span>
            </Badge>
          )}
          
          {trip.checkIn && trip.checkOut && (
            <Badge variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5">
              <Calendar className="h-3 w-3" />
              <span>{formatDateRange()}</span>
            </Badge>
          )}
          
          <Badge variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5">
            <Users className="h-3 w-3" />
            <span>{guestLabel}</span>
          </Badge>

          {trip.amenities.length > 0 && (
            <Badge variant="outline" className="py-1 px-2.5">
              {trip.amenities.slice(0, 2).join(', ')}
              {trip.amenities.length > 2 && ` +${trip.amenities.length - 2}`}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit} className="text-xs">
              Edit
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetTrip}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
