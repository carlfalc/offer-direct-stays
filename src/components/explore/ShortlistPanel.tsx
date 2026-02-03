import { Property, ShortlistItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, MapPin, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShortlistPanelProps {
  items: ShortlistItem[];
  onRemove: (propertyId: string) => void;
  onMakeOffer: (property: Property) => void;
  sentOfferIds?: string[];
}

export default function ShortlistPanel({ items, onRemove, onMakeOffer, sentOfferIds = [] }: ShortlistPanelProps) {
  if (items.length === 0) {
    return (
      <div className="p-4 border-t border-border/50 bg-card/50 backdrop-blur-sm">
        <p className="text-sm text-muted-foreground text-center">
          Tap a pin or property card to start building your shortlist
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-foreground">Shortlist</h3>
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {items.length} {items.length === 1 ? 'property' : 'properties'}
          </span>
        </div>
      </div>
      
      <ScrollArea className="max-h-48 lg:max-h-64 xl:max-h-72">
        <div className="p-3 space-y-2">
          {items.map((item) => {
            const hasSentOffer = sentOfferIds.includes(item.property.id);
            return (
              <div
                key={item.property.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl group transition-all duration-200",
                  "bg-background/50 border border-border/30",
                  "hover:border-primary/30 hover:shadow-sm"
                )}
              >
                {item.property.image_url && (
                  <img
                    src={item.property.image_url}
                    alt={item.property.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.property.name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{item.property.city}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasSentOffer ? (
                    <Badge className="text-xs bg-accent/10 text-accent border-accent/30 gap-1">
                      <Sparkles className="w-3 h-3" />
                      Offer sent
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => onMakeOffer(item.property)}
                    >
                      Make offer
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    onClick={() => onRemove(item.property.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
