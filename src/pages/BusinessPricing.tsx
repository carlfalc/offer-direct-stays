import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { loadLiteApiRooms } from '@/lib/listings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, ArrowLeft, Download, Save, Eye, EyeOff, Info } from 'lucide-react';

interface RoomRow {
  id: string;
  room_name: string;
  base_guide: number | null;
  base_auto: number | null;
  base_floor: number | null;
}

export default function BusinessPricing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [listing, setListing] = useState<any | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [autoOn, setAutoOn] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: listings } = await supabase
      .from('fs_listings')
      .select('id,liteapi_hotel_id,name,country,auto_accept_enabled')
      .eq('owner_id', user.id)
      .order('claimed_at', { ascending: true });
    const l = (listings as any[])?.[0] || null;
    setListing(l);
    if (!l) {
      setRooms([]);
      setLoading(false);
      return;
    }
    setAutoOn(l.auto_accept_enabled !== false);

    const { data: roomRows } = await supabase
      .from('fs_listing_rooms')
      .select('id,room_name,base_guide')
      .eq('listing_id', l.id)
      .order('room_name');
    const roomsArr = (roomRows as any[]) || [];
    // thresholds (owner-only) keyed by room id
    const { data: th } = await supabase
      .from('fs_room_thresholds')
      .select('listing_room_id,base_auto,base_floor')
      .in('listing_room_id', roomsArr.map((r) => r.id));
    const byRoom: Record<string, any> = {};
    (th as any[] | null)?.forEach((t) => (byRoom[t.listing_room_id] = t));
    setRooms(
      roomsArr.map((r) => ({
        id: r.id,
        room_name: r.room_name,
        base_guide: r.base_guide,
        base_auto: byRoom[r.id]?.base_auto ?? null,
        base_floor: byRoom[r.id]?.base_floor ?? null,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = listing?.country === 'AU' ? 'AUD' : 'NZD';

  const setField = (id: string, field: 'base_guide' | 'base_auto' | 'base_floor', value: string) => {
    const num = value === '' ? null : Number(value);
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: num } : r)));
  };

  const saveRoom = async (r: RoomRow) => {
    setSavingId(r.id);
    const { error: e1 } = await supabase
      .from('fs_listing_rooms')
      .update({ base_guide: r.base_guide })
      .eq('id', r.id);
    const { error: e2 } = await supabase
      .from('fs_room_thresholds')
      .upsert({ listing_room_id: r.id, base_auto: r.base_auto, base_floor: r.base_floor } as any, { onConflict: 'listing_room_id' });
    setSavingId(null);
    if (e1 || e2) {
      toast({ title: 'Could not save', description: (e1 || e2)?.message || 'Please try again', variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved', description: `${r.room_name} prices updated.` });
  };

  const importRooms = async () => {
    if (!listing) return;
    setImporting(true);
    try {
      const liteRooms = await loadLiteApiRooms(listing.liteapi_hotel_id);
      if (liteRooms.length === 0) {
        toast({ title: 'No rooms found', description: 'We couldn’t pull rooms for this property from LiteAPI.', variant: 'destructive' });
        return;
      }
      for (const lr of liteRooms) {
        const { data: inserted, error } = await supabase
          .from('fs_listing_rooms')
          .insert({
            listing_id: listing.id,
            liteapi_room_id: lr.id,
            room_name: lr.name,
            max_adults: lr.max_adults,
            max_children: lr.max_children,
            max_occupancy: lr.max_occupancy ?? null,
            currency,
          } as any)
          .select('id')
          .single();
        if (!error && inserted) {
          await supabase.from('fs_room_thresholds').insert({ listing_room_id: (inserted as any).id } as any);
        }
      }
      toast({ title: 'Rooms imported', description: 'Now set your guide, auto-accept and floor prices.' });
      load();
    } finally {
      setImporting(false);
    }
  };

  const toggleAuto = async (on: boolean) => {
    if (!listing) return;
    setAutoOn(on);
    const { error } = await supabase.from('fs_listings').update({ auto_accept_enabled: on }).eq('id', listing.id);
    if (error) {
      setAutoOn(!on);
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">No property claimed yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Claim your business first, then set your prices here.</p>
        <Button className="mt-5" onClick={() => navigate('/business/claim')}>Claim your business</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button onClick={() => navigate('/business/dashboard')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </button>

      <h1 className="text-2xl font-semibold text-foreground">Pricing — {listing.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Set three prices per room. Only the <span className="font-medium">guide</span> is ever shown to travellers.
      </p>

      {/* legend */}
      <div className="mt-4 grid gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground sm:grid-cols-3">
        <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> <b className="text-foreground">Guide</b> — public “from” price</span>
        <span className="flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5" /> <b className="text-foreground">Auto-accept</b> — offers at/above this auto-accept</span>
        <span className="flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5" /> <b className="text-foreground">Floor</b> — below this is auto-declined</span>
      </div>

      {/* master auto toggle */}
      <Card className="mt-4 flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Auto-accept offers</p>
          <p className="text-xs text-muted-foreground">When off, every offer routes to you to accept, counter or decline.</p>
        </div>
        <Switch checked={autoOn} onCheckedChange={toggleAuto} />
      </Card>

      {rooms.length === 0 ? (
        <Card className="mt-6 p-6 text-center">
          <p className="text-sm font-medium text-foreground">No rooms set up yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Import your room types from your listing to start pricing them.</p>
          <Button className="mt-4" onClick={importRooms} disabled={importing}>
            {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</> : <><Download className="mr-2 h-4 w-4" /> Import rooms</>}
          </Button>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {rooms.map((r) => {
            const warn =
              (r.base_floor != null && r.base_auto != null && r.base_floor > r.base_auto) ||
              (r.base_auto != null && r.base_guide != null && r.base_auto > r.base_guide);
            return (
              <Card key={r.id} className="p-4">
                <p className="text-sm font-semibold text-foreground">{r.room_name}</p>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <label className="text-xs text-muted-foreground">
                    Guide ({currency})
                    <Input type="number" className="mt-1 h-9" value={r.base_guide ?? ''} onChange={(e) => setField(r.id, 'base_guide', e.target.value)} placeholder="—" />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Auto-accept
                    <Input type="number" className="mt-1 h-9" value={r.base_auto ?? ''} onChange={(e) => setField(r.id, 'base_auto', e.target.value)} placeholder="—" />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Floor
                    <Input type="number" className="mt-1 h-9" value={r.base_floor ?? ''} onChange={(e) => setField(r.id, 'base_floor', e.target.value)} placeholder="—" />
                  </label>
                </div>
                {warn && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                    <Info className="h-3.5 w-3.5" /> Usually floor ≤ auto-accept ≤ guide.
                  </p>
                )}
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={() => saveRoom(r)} disabled={savingId === r.id}>
                    {savingId === r.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
