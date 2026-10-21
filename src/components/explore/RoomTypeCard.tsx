import { useState } from 'react';
import { Room } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Bed, ImageIcon } from 'lucide-react';

interface RoomTypeCardProps {
  room: Room;
  estimatedRate: number;
  currency: 'NZD' | 'AUD';
  onMakeOffer: () => void;
}

export default function RoomTypeCard({
  room,
  estimatedRate,
  currency,
  onMakeOffer,
}: RoomTypeCardProps) {
  const currencySymbol = currency === 'AUD' ? 'A$' : 'NZ$';
  const [imgFailed, setImgFailed] = useState(false);
  const photoCount = room.images?.length ?? (room.image_url ? 1 : 0);

  return (
    <Card className="p-3">
      <div className="flex justify-between items-start gap-3">
        {/* Room photo */}
        <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted/60">
          {room.image_url && !imgFailed ? (
            <img
              src={room.image_url}
              alt={room.name}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-5 w-5 opacity-50" />
            </div>
          )}
          {photoCount > 1 && (
            <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-full bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
              <ImageIcon className="h-2.5 w-2.5" /> {photoCount}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h5 className="font-medium text-sm">{room.name}</h5>
          
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {room.max_adults} adult{room.max_adults > 1 ? 's' : ''}
              {room.max_children > 0 && `, ${room.max_children} child${room.max_children > 1 ? 'ren' : ''}`}
            </span>
            {room.bed_configuration && (
              <span className="flex items-center gap-1">
                <Bed className="h-3 w-3" />
                {room.bed_configuration}
              </span>
            )}
          </div>

          {room.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {room.description}
            </p>
          )}

          {room.amenities && room.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {room.amenities.slice(0, 4).map((amenity) => (
                <Badge key={amenity} variant="outline" className="text-xs px-1.5 py-0">
                  {amenity}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold">
            ~{currencySymbol}{estimatedRate}
          </p>
          <p className="text-xs text-muted-foreground">per night</p>
          <Button size="sm" className="mt-2 text-xs h-7" onClick={onMakeOffer}>
            Make offer
          </Button>
        </div>
      </div>
    </Card>
  );
}
