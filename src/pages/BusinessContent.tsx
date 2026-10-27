import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { loadLiteApiRoomContent, uploadRoomPhoto } from '@/lib/listings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2, ArrowLeft, Save, Plus, Trash2, Star, X, ImagePlus, Info, CheckCircle2, SlidersHorizontal, Eye, PenLine } from 'lucide-react';

interface Photo { url: string; source: string }
interface RoomDraft {
  id: string;
  persisted: boolean;
  is_custom: boolean;
  liteapi_room_id: string | null;
  room_name: string;
  description: string;
  amenities: string;
  bed_configuration: string;
  max_occupancy: number | null;
  base_guide: number | null;
  base_auto: number | null;
  base_floor: number | null;
  photos: Photo[];
}

const tempId = () => `temp:${Math.random().toString(36).slice(2, 10)}`;

export default function BusinessContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [listing, setListing] = useState<any | null>(null);
  const [rooms, setRooms] = useState<RoomDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [ownerDesc, setOwnerDesc] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: listings } = await supabase
      .from('fs_listings')
      .select('id,liteapi_hotel_id,name,country,payment_methods,payment_note,payment_terms,payment_lead_days,owner_description')
      .eq('owner_id', user.id)
      .order('claimed_at', { ascending: true });
    const l = (listings as any[])?.[0] || null;
    setListing(l);
    setOwnerDesc(l?.owner_description || '');
    if (!l) { setRooms([]); setLoading(false); return; }

    const { data: roomRows } = await supabase
      .from('fs_listing_rooms')
      .select('id,liteapi_room_id,room_name,max_occupancy,base_guide,is_custom,photos,description,amenities,bed_configuration,sort_order')
      .eq('listing_id', l.id)
      .order('sort_order');
    const roomsArr = (roomRows as any[]) || [];
    const { data: th } = await supabase
      .from('fs_room_thresholds')
      .select('listing_room_id,base_auto,base_floor')
      .in('listing_room_id', roomsArr.map((r) => r.id));
    const byRoom: Record<string, any> = {};
    (th as any[] | null)?.forEach((t) => (byRoom[t.listing_room_id] = t));

    // Seed photos / details from LiteAPI for any room not yet curated.
    let liteContent: Record<string, any> = {};
    if (l.liteapi_hotel_id) {
      try { liteContent = await loadLiteApiRoomContent(l.liteapi_hotel_id); } catch { /* best effort */ }
    }

    setRooms(roomsArr.map((r) => {
      const lc = r.liteapi_room_id ? liteContent[String(r.liteapi_room_id)] : null;
      const curated: Photo[] = Array.isArray(r.photos) ? r.photos : [];
      const photos: Photo[] = curated.length
        ? curated
        : (lc?.images || []).map((url: string) => ({ url, source: 'liteapi' }));
      return {
        id: r.id,
        persisted: true,
        is_custom: !!r.is_custom,
        liteapi_room_id: r.liteapi_room_id ?? null,
        room_name: r.room_name || 'Room',
        description: r.description ?? lc?.description ?? '',
        amenities: r.amenities ?? lc?.amenities ?? '',
        bed_configuration: r.bed_configuration ?? lc?.beds ?? '',
        max_occupancy: r.max_occupancy ?? lc?.max_occupancy ?? null,
        base_guide: r.base_guide ?? null,
        base_auto: byRoom[r.id]?.base_auto ?? null,
        base_floor: byRoom[r.id]?.base_floor ?? null,
        photos,
      };
    }));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const currency = listing?.country === 'AU' ? 'AUD' : 'NZD';

  const patch = (id: string, p: Partial<RoomDraft>) =>
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const addUnit = () => {
    const id = tempId();
    setRooms((rs) => [...rs, {
      id, persisted: false, is_custom: true, liteapi_room_id: null,
      room_name: '', description: '', amenities: '', bed_configuration: '',
      max_occupancy: null, base_guide: null, base_auto: null, base_floor: null, photos: [],
    }]);
    setTimeout(() => document.getElementById(`unit-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const removeUnit = async (d: RoomDraft) => {
    if (d.persisted) {
      const { error } = await supabase.from('fs_listing_rooms').delete().eq('id', d.id);
      if (error) { toast({ title: 'Could not remove', description: error.message, variant: 'destructive' }); return; }
    }
    setRooms((rs) => rs.filter((r) => r.id !== d.id));
    toast({ title: 'Unit removed' });
  };

  const onPickFiles = async (d: RoomDraft, files: FileList | null) => {
    if (!files || !files.length || !listing) return;
    setUploadingId(d.id);
    try {
      const added: Photo[] = [];
      for (const f of Array.from(files)) {
        try { added.push({ url: await uploadRoomPhoto(f, listing.id, d.id), source: 'upload' }); }
        catch (e: any) { toast({ title: 'Upload failed', description: e?.message || f.name, variant: 'destructive' }); }
      }
      if (added.length) patch(d.id, { photos: [...d.photos, ...added] });
    } finally { setUploadingId(null); }
  };

  const removePhoto = (d: RoomDraft, idx: number) =>
    patch(d.id, { photos: d.photos.filter((_, i) => i !== idx) });
  const makeCover = (d: RoomDraft, idx: number) => {
    const next = d.photos.slice();
    const [p] = next.splice(idx, 1);
    patch(d.id, { photos: [p, ...next] });
  };

  const saveRoom = async (d: RoomDraft) => {
    if (!listing) return;
    if (!d.room_name.trim()) { toast({ title: 'Name needed', description: 'Give this unit a name first.', variant: 'destructive' }); return; }
    setSavingId(d.id);
    try {
      let id = d.id;
      const content = {
        room_name: d.room_name.trim(),
        max_occupancy: d.max_occupancy,
        base_guide: d.base_guide,
        photos: d.photos,
        description: d.description || null,
        amenities: d.amenities || null,
        bed_configuration: d.bed_configuration || null,
      };
      if (!d.persisted) {
        const { data: ins, error } = await supabase
          .from('fs_listing_rooms')
          .insert({
            listing_id: listing.id,
            liteapi_room_id: `custom:${(crypto as any).randomUUID?.() || Math.random().toString(36).slice(2)}`,
            is_custom: true,
            currency,
            ...content,
          } as any)
          .select('id')
          .single();
        if (error || !ins) throw error || new Error('insert failed');
        id = (ins as any).id;
      } else {
        const { error } = await supabase.from('fs_listing_rooms').update(content as any).eq('id', id);
        if (error) throw error;
      }
      const { error: te } = await supabase
        .from('fs_room_thresholds')
        .upsert({ listing_room_id: id, base_auto: d.base_auto, base_floor: d.base_floor } as any, { onConflict: 'listing_room_id' });
      if (te) throw te;
      patch(d.id, { persisted: true });
      if (d.id !== id) patch(d.id, { id }); // swap temp id for real id
      toast({ title: 'Saved', description: `${d.room_name.trim()} updated.` });
    } catch (e: any) {
      toast({ title: 'Could not save', description: e?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!listing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">No property claimed yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Claim your business first, then review your rooms and photos here.</p>
        <Button className="mt-5" onClick={() => navigate('/business/claim')}>Claim your business</Button>
      </div>
    );
  }

  const saveOwnerDesc = async () => {
    if (!listing) return;
    setSavingDesc(true);
    const { error } = await supabase.from('fs_listings').update({ owner_description: ownerDesc.trim() || null } as any).eq('id', listing.id);
    setSavingDesc(false);
    if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Description saved' });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Magazine header */}
      <button onClick={() => navigate('/business/dashboard')} className="flex items-center gap-1 font-mono text-xs text-[#0C1A22]/60 hover:text-[#0C1A22]">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </button>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <span className="inline-block rounded-lg border-2 border-[#0C1A22] bg-[#19C9B4] px-3 py-1 font-display text-sm font-extrabold uppercase tracking-[0.16em] text-[#0C1A22]">{listing.name}</span>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.05] text-[#0C1A22] sm:text-5xl">Rooms, Photos<br />&amp; Description</h1>
        </div>
        <button onClick={() => navigate('/business/preview')} className="mt-1 flex flex-none items-center gap-1.5 rounded-lg bg-[#0C9C8E] px-4 py-2 font-display text-sm font-extrabold text-white shadow-sm hover:bg-[#0b8c80]">
          <Eye className="h-4 w-4" /> Preview listing
        </button>
      </div>

      {/* Instruction banner */}
      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-sm font-medium text-[#0C1A22]">
        <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
        <p>
          Please check the images we have for your rooms/units. If you’re happy with them, you’re done —
          otherwise add more images per unit, and fix any names, descriptions or amenities.
          Missing a room, unit or apartment? Add it at the bottom, set its price and details, then save.
        </p>
      </div>

      {/* Owner's description — black, bold, larger */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2"><PenLine className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-extrabold text-[#0C1A22]">Owner's description</h2></div>
        <p className="mb-3 mt-1 text-sm font-medium text-[#0C1A22]/70">Tell travellers about your property — shown when they tap <b className="text-[#0C1A22]">More details</b> on your listing.</p>
        <Textarea value={ownerDesc} onChange={(e) => setOwnerDesc(e.target.value)} rows={4}
          placeholder="Type anything relevant to travellers — onsite restaurant, Sky TV, free parking, walking distance to town…"
          className="w-full border-2 text-[1.05rem] font-semibold leading-relaxed text-[#0C1A22]" />
        <div className="mt-3 flex justify-end">
          <button onClick={saveOwnerDesc} disabled={savingDesc} className="flex items-center gap-1.5 rounded-lg bg-[#0C9C8E] px-4 py-2 font-display text-sm font-extrabold text-white shadow-sm hover:bg-[#0b8c80] disabled:opacity-60">
            {savingDesc ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save description</>}
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {rooms.map((d) => {
          const guideMissing = d.base_guide == null;
          return (
            <Card key={d.id} id={`unit-${d.id}`} className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Unit name</label>
                  <Input value={d.room_name} onChange={(e) => patch(d.id, { room_name: e.target.value })} placeholder="e.g. Studio Unit" className="mt-1 h-9 font-semibold" />
                </div>
                {d.is_custom && (
                  <Button size="icon" variant="ghost" className="mt-5 text-muted-foreground hover:text-red-600" title="Remove this unit" onClick={() => removeUnit(d)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Photo gallery */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Photos {d.photos.length > 0 && <span>· {d.photos.length}</span>}</p>
                  <PhotoAddButton busy={uploadingId === d.id} onPick={(files) => onPickFiles(d, files)} />
                </div>
                {d.photos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    No photos yet. Add your own so travellers can see this unit.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {d.photos.map((p, i) => (
                      <div key={p.url + i} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted">
                        <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        {i === 0 && <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
                        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          {i !== 0 && (
                            <button type="button" onClick={() => makeCover(d, i)} title="Make cover" className="rounded-full bg-white/90 p-1.5 text-foreground hover:bg-white">
                              <Star className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button type="button" onClick={() => removePhoto(d, i)} title="Remove" className="rounded-full bg-white/90 p-1.5 text-red-600 hover:bg-white">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Sleeps (max occupancy)
                  <Input type="number" min={1} value={d.max_occupancy ?? ''} onChange={(e) => patch(d.id, { max_occupancy: e.target.value === '' ? null : Number(e.target.value) })} className="mt-1 h-9" placeholder="—" />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Beds
                  <Input value={d.bed_configuration} onChange={(e) => patch(d.id, { bed_configuration: e.target.value })} className="mt-1 h-9" placeholder="e.g. 1× Queen, 1× Single" />
                </label>
              </div>
              <label className="mt-3 block text-xs font-medium text-muted-foreground">
                Overview
                <Textarea value={d.description} onChange={(e) => patch(d.id, { description: e.target.value })} className="mt-1 min-h-[72px]" placeholder="A short description of this unit." />
              </label>
              <label className="mt-3 block text-xs font-medium text-muted-foreground">
                Amenities
                <Textarea value={d.amenities} onChange={(e) => patch(d.id, { amenities: e.target.value })} className="mt-1 min-h-[56px]" placeholder="e.g. Kitchenette, Free WiFi, Heat pump, Sky TV" />
              </label>

              {/* Prices */}
              <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-medium text-foreground">Prices ({currency}) — only the guide is shown to travellers</p>
                <div className="grid grid-cols-3 gap-3">
                  <label className="text-xs text-muted-foreground">
                    Guide
                    <Input type="number" value={d.base_guide ?? ''} onChange={(e) => patch(d.id, { base_guide: e.target.value === '' ? null : Number(e.target.value) })} className="mt-1 h-9" placeholder="—" />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Auto-accept
                    <Input type="number" value={d.base_auto ?? ''} onChange={(e) => patch(d.id, { base_auto: e.target.value === '' ? null : Number(e.target.value) })} className="mt-1 h-9" placeholder="—" />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Floor
                    <Input type="number" value={d.base_floor ?? ''} onChange={(e) => patch(d.id, { base_floor: e.target.value === '' ? null : Number(e.target.value) })} className="mt-1 h-9" placeholder="—" />
                  </label>
                </div>
                {guideMissing && <p className="mt-2 flex items-center gap-1 text-xs text-amber-600"><Info className="h-3.5 w-3.5" /> A guide price is required before you can go live.</p>}
              </div>

              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={() => saveRoom(d)} disabled={savingId === d.id}>
                  {savingId === d.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="mr-2 h-4 w-4" /> Save unit</>}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add new unit */}
      <button onClick={addUnit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
        <Plus className="h-4 w-4" /> Add new room / unit / apartment
      </button>

      {/* Footer actions */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button variant="outline" asChild><a href="/business/pricing"><SlidersHorizontal className="mr-1.5 h-4 w-4" /> Pricing page</a></Button>
        <Button className="gap-1.5 bg-[#0C1A22] text-white hover:bg-[#0C1A22]/90" onClick={() => navigate('/business/dashboard')}>
          <CheckCircle2 className="h-4 w-4" /> Done — back to dashboard
        </Button>
      </div>
    </div>
  );
}

/** Hidden file input wrapped as an "Add photos" button. */
function PhotoAddButton({ busy, onPick }: { busy: boolean; onPick: (files: FileList | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onPick(e.target.files); if (ref.current) ref.current.value = ''; }} />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Uploading…</> : <><ImagePlus className="mr-1.5 h-4 w-4" /> Add photos</>}
      </Button>
    </>
  );
}
