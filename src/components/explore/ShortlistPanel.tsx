import { Property, ShortlistItem, Room } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, MapPin, ChevronRight } from 'lucide-react';

interface ShortlistPanelProps {
  items: ShortlistItem[];
  onRemove: (propertyId: string) => void;
  onMakeOffer: () => void;
}

export default function ShortlistPanel({ items, onRemove, onMakeOffer }: ShortlistPanelProps) {
  if (items.length === 0) {
    return (
      <div className="p-4 border-t border-border bg-muted/30">
        <p className="text-sm text-muted-foreground text-center">
          Click on a property or map pin to add to your shortlist
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-medium text-sm">
          Shortlist ({items.length})
        </h3>
        <Button 
          onClick={onMakeOffer}
          size="sm"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          Make an Offer
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="max-h-48">
        <div className="p-2 space-y-2">
          {items.map((item) => (
            <div
              key={item.property.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 group"
            >
              {item.property.image_url && (
                <img
                  src={item.property.image_url}
                  alt={item.property.name}
                  className="w-10 h-10 rounded-md object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.property.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{item.property.city}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(item.property.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
