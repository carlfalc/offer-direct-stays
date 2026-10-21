import { useState } from 'react';
import { Room } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, Users, Maximize2, ImageIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface RoomPickerProps {
  rooms: Room[];
  selectedRoomId: string | null;
  onSelect: (roomId: string) => void;
  currency: string;
}

/** A room photo with a graceful fallback when the image can't load. */
function RoomImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-muted/60 text-muted-foreground', className)}>
        <ImageIcon className="h-6 w-6 opacity-50" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}

function occupancy(room: Room): number {
  return room.max_occupancy ?? room.max_adults + (room.max_children || 0);
}

/** Full-screen gallery for one room, with "Select this room". */
function RoomGallery({
  room,
  currency,
  onSelect,
  onClose,
}: {
  room: Room;
  currency: string;
  onSelect: () => void;
  onClose: () => void;
}) {
  const images = room.images?.length ? room.images : room.image_url ? [room.image_url] : [];
  const [idx, setIdx] = useState(0);
  const has = images.length > 0;
  const go = (d: number) => setIdx((i) => (i + d + images.length) % images.length);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">{room.name}</h3>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Sleeps {occupancy(room)}
            </span>
            {room.size_sqm ? (
              <span className="flex items-center gap-1">
                <Maximize2 className="h-3.5 w-3.5" /> {room.size_sqm} m²
              </span>
            ) : null}
            {room.avg_rate ? (
              <span className="font-medium text-foreground">
                from {currency} ${Math.round(room.avg_rate)}
              </span>
            ) : null}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close gallery" className="rounded-full p-2 hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <RoomImage src={has ? images[idx] : null} alt={room.name} className="h-full w-full" />
        {images.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow hover:bg-background"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow hover:bg-background"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium">
              {idx + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-border px-4 py-3">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn(
                'h-14 w-20 flex-shrink-0 overflow-hidden rounded-md ring-2 transition',
                i === idx ? 'ring-primary' : 'ring-transparent opacity-70 hover:opacity-100',
              )}
            >
              <RoomImage src={src} alt={`${room.name} ${i + 1}`} className="h-full w-full" />
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-4">
        <Button
          className="w-full"
          onClick={() => {
            onSelect();
            onClose();
          }}
        >
          Select this room
        </Button>
      </div>
    </div>
  );
}

export default function RoomPicker({ rooms, selectedRoomId, onSelect, currency }: RoomPickerProps) {
  const [galleryRoom, setGalleryRoom] = useState<Room | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rooms.map((room) => {
          const selected = room.id === selectedRoomId;
          const photoCount = room.images?.length ?? (room.image_url ? 1 : 0);
          return (
            <div
              key={room.id}
              className={cn(
                'group relative overflow-hidden rounded-xl border bg-card text-left transition',
                selected ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary/50',
              )}
            >
              {/* Photo — tap to open the gallery */}
              <button
                type="button"
                onClick={() => setGalleryRoom(room)}
                className="relative block aspect-[4/3] w-full"
                aria-label={`View photos of ${room.name}`}
              >
                <RoomImage src={room.image_url} alt={room.name} className="h-full w-full" />
                {photoCount > 1 && (
                  <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium text-foreground">
                    <ImageIcon className="h-3 w-3" /> {photoCount}
                  </span>
                )}
                {selected && (
                  <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </button>

              {/* Details + select */}
              <div className="space-y-2 p-3">
                <div>
                  <p className="text-sm font-semibold leading-tight text-foreground">{room.name}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {occupancy(room)}
                    </span>
                    {room.size_sqm ? (
                      <span className="flex items-center gap-1">
                        <Maximize2 className="h-3.5 w-3.5" /> {room.size_sqm} m²
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  {room.avg_rate ? (
                    <span className="text-xs text-muted-foreground">
                      from <span className="font-semibold text-foreground">{currency} ${Math.round(room.avg_rate)}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Name your price</span>
                  )}
                  <Button
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    className="h-7 px-3 text-xs"
                    onClick={() => onSelect(room.id)}
                  >
                    {selected ? 'Selected' : 'Choose'}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {galleryRoom && (
        <RoomGallery
          room={galleryRoom}
          currency={currency}
          onSelect={() => onSelect(galleryRoom.id)}
          onClose={() => setGalleryRoom(null)}
        />
      )}
    </>
  );
}
