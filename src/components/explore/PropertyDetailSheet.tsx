import { useState, useEffect } from 'react';
import { Property, Room } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Heart, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTrip } from '@/contexts/TripContext';
import RoomTypeCard from './RoomTypeCard';

interface PropertyDetailSheetProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMakeOffer: (property: Property, room?: Room) => void;
  onAddToWatchlist: (property: Property) => void;
  isWatchlisted: boolean;
}

export default function PropertyDetailSheet({
  property,
  open,
  onOpenChange,
  onMakeOffer,
  onAddToWatchlist,
  isWatchlisted,
}: PropertyDetailSheetProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const { trip, getPropertyPriceEstimate } = useTrip();

  useEffect(() => {
    if (property && open) {
      loadRooms();
    }
  }, [property, open]);

  const loadRooms = async () => {
    if (!property) return;
    
    setLoadingRooms(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', property.id);

      if (error) throw error;
      setRooms((data as Room[]) || []);
    } catch (err) {
      console.error('Error loading rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  if (!property) return null;

  const priceEstimate = getPropertyPriceEstimate(property.id);
  const currencySymbol = trip.currency === 'AUD' ? 'A$' : 'NZ$';

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

  // Calculate room-specific estimate (base + variance per room)
  const getRoomEstimate = (room: Room, index: number): number => {
    const base = priceEstimate.low + (priceEstimate.high - priceEstimate.low) * 0.5;
    const roomVariance = (index * 25) - 25; // First room is cheaper
    return Math.round(base + roomVariance);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="text-left">{property.name}</SheetTitle>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3 w-3" />
                <span>{property.area ? `${property.area}, ` : ''}{property.city}, {property.country}</span>
              </div>
              <div className="flex gap-1 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {propertyTypeLabels[property.property_type] || property.property_type}
                </Badge>
                {property.registration_status === 'registered' && (
                  <Badge variant="outline" className="text-xs text-success border-success">
                    Registered
                  </Badge>
                )}
              </div>
            </div>
            
            <Button
              size="icon"
              variant={isWatchlisted ? 'secondary' : 'outline'}
              onClick={() => onAddToWatchlist(property)}
            >
              <Heart className={`h-4 w-4 ${isWatchlisted ? 'fill-destructive text-destructive' : ''}`} />
            </Button>
          </div>

          {/* Price Guide */}
          <div className="bg-muted/50 rounded-md p-3 mt-3">
            <p className="text-sm font-medium">
              Est. {currencySymbol}{priceEstimate.low}–{priceEstimate.high} / night
            </p>
            {priceEstimate.sampleSize >= 50 && (
              <p className="text-xs text-muted-foreground mt-1">
                Travellers like you typically book {currencySymbol}{priceEstimate.p25}–{priceEstimate.p75} / night
              </p>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100%-180px)] mt-4">
          <div className="space-y-4 pb-4">
            {/* Description */}
            {property.description && (
              <p className="text-sm text-muted-foreground">{property.description}</p>
            )}

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Amenities</h4>
                <div className="flex flex-wrap gap-1">
                  {property.amenities.map((amenity) => (
                    <Badge key={amenity} variant="outline" className="text-xs">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Room Types */}
            <div>
              <h4 className="text-sm font-medium mb-3">Available Room Types</h4>
              
              {loadingRooms ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rooms.length > 0 ? (
                <div className="space-y-3">
                  {rooms.map((room, index) => (
                    <RoomTypeCard
                      key={room.id}
                      room={room}
                      estimatedRate={getRoomEstimate(room, index)}
                      currency={trip.currency}
                      onMakeOffer={() => onMakeOffer(property, room)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No room information available
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="pt-4 border-t border-border">
          <Button className="w-full" onClick={() => onMakeOffer(property)}>
            Make an offer for this property
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
