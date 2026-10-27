import { Dialog, DialogContent } from '@/components/ui/dialog';
import OfferCard from '@/components/offer/OfferCard';

interface Photo { url: string; source?: string }

/**
 * Owner-facing preview of a single room exactly as a traveller sees it when
 * making an offer. Renders the shared OfferCard in read-only mode.
 */
export default function RoomOfferPreview({ open, onOpenChange, businessName, roomName, photos, guide, currencySymbol = '$' }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  businessName: string;
  roomName: string;
  photos: Photo[];
  guide: number | null;
  auto?: number | null;
  currencySymbol?: string;
}) {
  const g = guide ?? 0;
  const hasGuide = g > 0;
  const min = Math.max(1, Math.round(g * 0.7));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] border-0 bg-transparent p-0 shadow-none">
        {hasGuide ? (
          <OfferCard
            property={businessName}
            room={roomName || 'Room'}
            photoUrl={photos?.[0]?.url || null}
            guidePrice={Math.round(g)}
            minOffer={min}
            currencySymbol={currencySymbol}
            readOnly
          />
        ) : (
          <div className="rounded-2xl bg-[#0f1416] p-7 text-center text-sm font-semibold text-[#f5f5f4]">
            Set a guide price on this room to preview the offer card.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
