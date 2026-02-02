import { useTrip } from '@/contexts/TripContext';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Users, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TripSummaryBarProps {
  onEdit?: () => void;
}

export default function TripSummaryBar({ onEdit }: TripSummaryBarProps) {
  const { trip, resetTrip } = useTrip();

  if (!trip.destination && !trip.checkIn && !trip.checkOut) {
    return null;
  }

  const formatDateRange = () => {
    if (!trip.checkIn || !trip.checkOut) return null;
    return `${format(trip.checkIn, 'MMM d')} – ${format(trip.checkOut, 'MMM d')}`;
  };

  const guestLabel = `${trip.adults} adult${trip.adults > 1 ? 's' : ''}${
    trip.children > 0 ? `, ${trip.children} child${trip.children > 1 ? 'ren' : ''}` : ''
  }`;

  return (
    <div className="bg-secondary/5 border-b border-border/50 px-6 py-2.5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {trip.destination && (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
              "bg-card border border-border/50 text-foreground"
            )}>
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">{trip.destination.city}</span>
              <span className="text-muted-foreground">{trip.destination.country}</span>
            </div>
          )}
          
          {trip.checkIn && trip.checkOut && (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
              "bg-card border border-border/50 text-foreground"
            )}>
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{formatDateRange()}</span>
            </div>
          )}
          
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
            "bg-card border border-border/50 text-foreground"
          )}>
            <Users className="h-3.5 w-3.5 text-primary" />
            <span>{guestLabel}</span>
          </div>

          {trip.amenities.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-primary/5 border border-primary/20 text-primary">
              {trip.amenities.slice(0, 2).join(', ')}
              {trip.amenities.length > 2 && ` +${trip.amenities.length - 2}`}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onEdit && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onEdit} 
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Edit
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-muted-foreground hover:text-foreground" 
            onClick={resetTrip}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
