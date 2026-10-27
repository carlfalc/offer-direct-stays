import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadRoomPhoto } from '@/lib/listings';
import { Button } from '@/components/ui/button';
import { Loader2, ImagePlus, Save, Move, Image as ImageIcon } from 'lucide-react';

/**
 * The listing's main (hero) photo. The owner can upload their own high-res image
 * and drag it to choose the focal point that shows in the banner crop.
 */
export default function MainPhotoCard({ listingId, initialUrl, fallbackSrc, initialFocusX = 50, initialFocusY = 50 }: {
  listingId: string;
  initialUrl: string | null;
  fallbackSrc: string | null;
  initialFocusX?: number;
  initialFocusY?: number;
}) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [fx, setFx] = useState(initialFocusX);
  const [fy, setFy] = useState(initialFocusY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const src = url || fallbackSrc;

  const onUpload = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const u = await uploadRoomPhoto(f, listingId, 'hero');
      setUrl(u); setFx(50); setFy(50);
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!src) return;
    drag.current = { x: e.clientX, y: e.clientY };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !frameRef.current) return;
    const r = frameRef.current.getBoundingClientRect();
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setFx((v) => Math.max(0, Math.min(100, v - (dx / r.width) * 100)));
    setFy((v) => Math.max(0, Math.min(100, v - (dy / r.height) * 100)));
  };
  const onPointerUp = () => { drag.current = null; };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('fs_listings')
      .update({ hero_photo_url: url, hero_focus_x: Math.round(fx), hero_focus_y: Math.round(fy) } as any)
      .eq('id', listingId);
    setSaving(false);
    if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Main photo saved' });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2"><Move className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-extrabold text-[#0C1A22]">Main photo</h2></div>
      <p className="mb-3 mt-1 text-sm font-medium text-[#0C1A22]/70">The big photo at the top of your listing. Upload your own high-res shot, then <b className="text-[#0C1A22]">drag it</b> to choose what shows in the banner.</p>

      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="relative h-48 w-full touch-none select-none overflow-hidden rounded-xl bg-muted sm:h-56"
        style={{ cursor: src ? 'grab' : 'default' }}
      >
        {src ? (
          <img src={src} alt="Main" draggable={false} className="h-full w-full object-cover" style={{ objectPosition: `${fx}% ${fy}%` }} />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground"><ImageIcon className="h-6 w-6 opacity-50" /></div>
        )}
        {src && <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">Drag to reposition</div>}
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onUpload(e.target.files)} />
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Uploading…</> : <><ImagePlus className="mr-1.5 h-4 w-4" /> Upload main photo</>}
        </Button>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[#0C9C8E] px-4 py-2 font-display text-sm font-extrabold text-white shadow-sm hover:bg-[#0b8c80] disabled:opacity-60">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save main photo</>}
        </button>
      </div>
    </div>
  );
}
