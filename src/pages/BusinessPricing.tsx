import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { importLiteApiRooms } from '@/lib/listings';
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
      .upsert({ listing_room_id: r.id, base_auto: r.base_auto, base_floor: null } as any, { onConflict: 'listing_room_id' });
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
      const n = await importLiteApiRooms(listing.id, listing.liteapi_hotel_id);
      if (n === 0) {
        toast({ title: 'No rooms to import', description: 'Either rooms are already imported, or we couldn’t pull any from LiteAPI.', variant: 'destructive' });
        return;
      }
      toast({ title: `${n} room${n === 1 ? '' : 's'} imported`, description: 'Now set your guide price and auto-accept minimum.' });
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
      {/* Magazine header */}
      <button onClick={() => navigate('/business/dashboard')} className="flex items-center gap-1 font-mono text-xs text-[#0C1A22]/60 hover:text-[#0C1A22]">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </button>
      <span className="mt-3 inline-block rounded-lg border-2 border-[#0C1A22] bg-[#19C9B4] px-3 py-1 font-display text-sm font-extrabold uppercase tracking-[0.16em] text-[#0C1A22]">{listing.name}</span>
      <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.05] text-[#0C1A22] sm:text-5xl">Pricing</h1>
      <p className="mt-2 text-sm font-medium text-[#0C1A22]/70">
        Set your guide price and your auto-accept minimum for each room. Only the <b className="text-[#0C1A22]">guide</b> is ever shown to travellers.
      </p>

      {/* legend */}
      <div className="mt-4 grid gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs text-[#0C1A22] sm:grid-cols-2">
        <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> <b>Guide</b> — the public “from” price travellers see</span>
        <span className="flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5" /> <b>Auto-accept (minimum)</b> — offers at/above book instantly; lower ones come to you</span>
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
            const warn = (r.base_auto != null && r.base_guide != null && r.base_auto > r.base_guide);
            return (
              <Card key={r.id} className="p-4">
                <p className="font-display text-base font-bold text-[#0C1A22]">{r.room_name}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-[#0C1A22]">
                    Guide price ({currency})
                    <Input type="number" className="mt-1 h-9" value={r.base_guide ?? ''} onChange={(e) => setField(r.id, 'base_guide', e.target.value)} placeholder="—" />
                  </label>
                  <label className="text-xs font-semibold text-[#0C1A22]">
                    Auto-accept (minimum amount)
                    <Input type="number" className="mt-1 h-9" value={r.base_auto ?? ''} onChange={(e) => setField(r.id, 'base_auto', e.target.value)} placeholder="—" />
                  </label>
                </div>
                {autoOn ? (
                  <p className="mt-2 text-xs font-medium text-[#0C1A22]/70">Offers at or above the minimum book instantly. Anything lower comes to you to accept, counter or decline.</p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-amber-600">Auto-accept is off — every offer comes to you to accept, counter or decline (nothing books automatically).</p>
                )}
                {warn && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                    <Info className="h-3.5 w-3.5" /> Usually auto-accept ≤ guide.
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
