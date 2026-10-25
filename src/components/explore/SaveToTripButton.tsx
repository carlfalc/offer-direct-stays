import { useState } from 'react';
import { Heart, Plus, Check, Loader2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Property } from '@/types';
import { FsTrip, listTrips, listTripItems, createTrip, saveToTrip, removeTripItem } from '@/lib/trips';

interface Props {
  property: Property;
  /** Whether this property is already in one of the traveller's trips. */
  saved?: boolean;
  /** Called after the saved state changes, so the parent can refresh its hearts. */
  onChange?: () => void;
  className?: string;
}

export default function SaveToTripButton({ property, saved, onChange, className }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<FsTrip[]>([]);
  const [inTrips, setInTrips] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [t, items] = await Promise.all([listTrips(user.id), listTripItems(user.id)]);
    setTrips(t);
    setInTrips(new Set(items.filter((i) => i.property_id === property.id).map((i) => i.trip_id)));
    setLoading(false);
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) load();
  };

  const toggle = async (tripId: string, tripName: string) => {
    if (!user) return;
    setBusy(true);
    if (inTrips.has(tripId)) {
      await removeTripItem(user.id, tripId, property.id);
      setInTrips((prev) => {
        const n = new Set(prev);
        n.delete(tripId);
        return n;
      });
    } else {
      await saveToTrip(user.id, tripId, property);
      setInTrips((prev) => new Set(prev).add(tripId));
      toast({ description: `Saved to ${tripName}` });
    }
    setBusy(false);
    onChange?.();
  };

  const addAndSave = async () => {
    if (!user || !newName.trim()) return;
    setBusy(true);
    const t = await createTrip(user.id, newName.trim());
    if (t) {
      await saveToTrip(user.id, t.id, property);
      setTrips((prev) => [t, ...prev]);
      setInTrips((prev) => new Set(prev).add(t.id));
      setNewName('');
      toast({ description: `Saved to ${t.name}` });
    } else {
      toast({ description: 'Could not create that trip.', variant: 'destructive' });
    }
    setBusy(false);
    onChange?.();
  };

  const isSaved = saved ?? inTrips.size > 0;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          aria-label="Save to a trip"
          className={cn(
            'grid h-8 w-8 place-items-center rounded-full bg-white/90 text-foreground shadow transition hover:scale-105',
            className,
          )}
        >
          <Heart className={cn('h-4 w-4', isSaved && 'fill-red-500 text-red-500')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-foreground">Save to a trip</p>
        <p className="mb-2 truncate text-xs text-muted-foreground">{property.name}</p>

        {loading ? (
          <div className="flex items-center justify-center py-5">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {trips.map((t) => (
              <button
                key={t.id}
                disabled={busy}
                onClick={() => toggle(t.id, t.name)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-foreground transition hover:bg-muted disabled:opacity-60"
              >
                <span className="truncate">{t.name}</span>
                {inTrips.has(t.id) ? (
                  <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                ) : (
                  <Heart className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                )}
              </button>
            ))}
            {trips.length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">No trips yet — create one below.</p>
            )}
          </div>
        )}

        <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAndSave()}
            placeholder="New trip, e.g. Noosa"
            className="h-8 text-sm"
          />
          <Button size="sm" className="h-8 px-2" disabled={busy || !newName.trim()} onClick={addAndSave}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
