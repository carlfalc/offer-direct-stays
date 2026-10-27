import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ImageIcon } from 'lucide-react';
import '@/styles/room-preview.css';

interface Photo { url: string; source?: string }

/**
 * Owner-facing preview of a single room exactly as a traveller sees it when
 * making an offer — the "other booking sites" anchor price and the live offer
 * slider (with a manual input and the sweet-spot / rolling-the-dice states).
 * The Send button is inert here; this is a preview.
 */
export default function RoomOfferPreview({ open, onOpenChange, businessName, roomName, photos, guide, auto, currencySymbol = '$' }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  businessName: string;
  roomName: string;
  photos: Photo[];
  guide: number | null;
  auto: number | null;
  currencySymbol?: string;
}) {
  const g = guide ?? 0;
  const hasGuide = g > 0;
  const a = auto && auto > 0 ? auto : null;
  const min = Math.max(1, Math.round((a ?? g) * 0.7));
  const [offer, setOffer] = useState<number>(g || min);
  const [failed, setFailed] = useState(false);

  // Reset to the guide each time the dialog opens.
  useEffect(() => { if (open) { setOffer(g || min); setFailed(false); } }, [open, g, min]);

  const clamp = (x: number) => Math.max(min, Math.min(g || min, Math.round(x || min)));
  const sweet = a != null && offer >= a;
  const state: 'sweet' | 'manual' = sweet ? 'sweet' : 'manual';
  const cover = photos?.[0]?.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="text-center">
            <span className="inline-block rounded-full border-2 px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-[#0C1A22]" style={{ background: '#19C9B4', borderColor: '#0C1A22' }}>{businessName}</span>
            <h2 className="mt-2 font-display text-xl font-extrabold text-[#0C1A22]">{roomName || 'Room'}</h2>
          </div>

          {cover && !failed ? (
            <img src={cover} alt={roomName} onError={() => setFailed(true)} className="mt-3 h-40 w-full rounded-xl object-cover" />
          ) : (
            <div className="mt-3 grid h-40 w-full place-items-center rounded-xl bg-muted text-muted-foreground"><ImageIcon className="h-6 w-6 opacity-50" /></div>
          )}

          {!hasGuide ? (
            <p className="mt-4 rounded-xl border-2 border-dashed border-border p-4 text-center text-sm font-semibold text-[#0C1A22]">Set a guide price on this room to preview the offer slider.</p>
          ) : (
            <>
              {/* Other booking sites anchor */}
              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl p-4" style={{ border: '3px solid #1E2A4A' }}>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: '#1E2A4A' }}>Price on other booking sites</p>
                  <p className="mt-2 text-xs font-semibold text-[#0C1A22]">Booking.com · Expedia · Airbnb · Agoda · Hotels.com</p>
                </div>
                <span className="flex-none whitespace-nowrap font-display text-xl font-extrabold text-[#0C1A22]">{currencySymbol}{g}<span className="text-sm font-bold text-[#0C1A22]"> /night</span></span>
              </div>

              {/* Make your offer */}
              <div className="mt-4 rounded-xl border border-border p-4">
                <div className="text-center">
                  <span className="font-display text-sm font-extrabold text-[#0C1A22]">find<span style={{ color: '#0C9C8E' }}>a</span>stay</span>
                  <p className="font-display text-2xl font-extrabold text-[#0C1A22]">Make your offer</p>
                </div>

                <div className="rp-trk mt-3">
                  <input type="range" className="rp-range" min={min} max={g} value={offer} onChange={(e) => setOffer(clamp(Number(e.target.value)))} />
                  <span className="rp-tick" style={{ left: '25%' }} /><span className="rp-tick" style={{ left: '50%' }} /><span className="rp-tick" style={{ left: '75%' }} />
                </div>

                <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-[#0C1A22]">
                  <span>or enter your offer:</span>
                  <div className="flex items-center rounded-md border-2 px-2 font-display text-lg font-extrabold text-[#0C1A22]" style={{ borderColor: '#0a7d72' }}>
                    <span>{currencySymbol}</span>
                    <input className="rp-man font-display text-lg font-extrabold text-[#0C1A22]" value={offer} onChange={(e) => setOffer(clamp(Number(e.target.value)))} inputMode="numeric" />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-white" style={{ background: sweet ? '#0C1A22' : '#1E2A4A' }}>
                  <span key={state} className={`rp-ic ${state}`}>{sweet ? '✨' : '🎲'}</span>
                  {sweet ? 'Sweet spot — books instantly' : 'Rolling the dice — let’s try your luck'}
                </div>

                <button type="button" title="Preview only" className="mt-3 w-full rounded-lg border-2 py-2.5 font-display font-extrabold text-white" style={{ background: '#0C9C8E', borderColor: '#0C1A22' }}>
                  Send offer of {currencySymbol}{offer}
                </button>
                <p className="mt-2 text-center text-xs font-semibold text-[#0C1A22]">Preview — this is how travellers make an offer.</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
