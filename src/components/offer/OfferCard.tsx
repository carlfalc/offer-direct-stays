import { useState } from 'react';

/**
 * findastay offer card — night mode, upmarket. Based on the approved design.
 * No "Instant" badge and no sweet-spot/dice cues: the auto-accept price stays
 * hidden (Option A). Works controlled (pass value + onChange) or uncontrolled.
 */
export type OfferCardProps = {
  property: string;
  room: string;
  photoUrl?: string | null;
  guidePrice: number;
  minOffer: number;
  otaNames?: string[];
  currencySymbol?: string;
  accent?: string;
  value?: number;
  onChange?: (amount: number) => void;
  onSubmit?: (amount: number) => void;
  submitting?: boolean;
  readOnly?: boolean;
};

export default function OfferCard({
  property,
  room,
  photoUrl,
  guidePrice,
  minOffer,
  otaNames = ['Booking.com', 'Expedia', 'Airbnb'],
  currencySymbol = '$',
  accent = '#5eead4',
  value,
  onChange,
  onSubmit,
  submitting = false,
  readOnly = false,
}: OfferCardProps) {
  const clamp = (n: number) => Math.min(guidePrice, Math.max(minOffer, Math.round(n || minOffer)));
  const [internal, setInternal] = useState<number>(clamp(guidePrice));
  const offer = clamp(value ?? internal);
  const set = (n: number) => { if (onChange) onChange(clamp(n)); else setInternal(clamp(n)); };

  return (
    <div
      className="flex w-full max-w-[440px] flex-col gap-6 rounded-[28px] bg-[#0f1416] p-7 text-[#f5f5f4]"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c7ccd1]">{property}</span>
        <span className="text-[11px] font-semibold" style={{ color: accent }}>findastay</span>
      </div>

      {/* Photo */}
      <div className="flex h-[200px] items-center justify-center overflow-hidden rounded-[18px] bg-[#1c2426] text-[13px] text-[#78716c] sm:h-[220px]">
        {photoUrl ? <img src={photoUrl} alt={room} className="h-full w-full object-cover" /> : 'room photo'}
      </div>

      {/* Title + OTA price */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em]">{room}</h1>
        <div className="flex items-center gap-2 text-[13px] text-[#c7ccd1]">
          <span>{otaNames.join(' · ')}</span>
          <span className="font-semibold text-[#d6d3d1] line-through">{currencySymbol}{guidePrice}</span>
        </div>
      </div>

      {/* Offer panel */}
      <div className="flex flex-col gap-4 rounded-[20px] border border-[#27333a] bg-[#171f22] p-[22px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c7ccd1]">Your offer</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-[22px] font-medium text-[#c7ccd1]">{currencySymbol}</span>
            <label htmlFor="offer" className="sr-only">Your offer</label>
            <input
              id="offer"
              type="number"
              inputMode="numeric"
              value={offer}
              min={minOffer}
              max={guidePrice}
              onChange={(e) => set(Number(e.target.value))}
              onBlur={() => set(offer)}
              className="w-[140px] bg-transparent p-0 text-[52px] font-semibold tracking-[-0.04em] text-[#f5f5f4] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Slider */}
        <div className="flex flex-col gap-2">
          <label htmlFor="offer-range" className="sr-only">Adjust offer</label>
          <input
            id="offer-range"
            type="range"
            min={minOffer}
            max={guidePrice}
            value={offer}
            onChange={(e) => set(Number(e.target.value))}
            className="h-6 w-full cursor-pointer"
            style={{ accentColor: accent }}
          />
          <div className="flex justify-between text-[11px] text-[#78716c]">
            <span>{currencySymbol}{minOffer}</span>
            <span>{currencySymbol}{guidePrice} guide</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => { if (!readOnly && !submitting) onSubmit?.(offer); }}
        disabled={submitting}
        className="h-14 rounded-2xl text-[16px] font-semibold text-[#0f1416] transition-opacity disabled:opacity-70"
        style={{ background: accent }}
      >
        {submitting ? 'Sending…' : `Send offer · ${currencySymbol}${offer}`}
      </button>

      <p className="text-center text-[12px] text-[#c7ccd1]">
        {readOnly ? 'Preview — this is how travellers make an offer' : 'Drag left to lower your offer · host replies as soon as possible'}
      </p>
    </div>
  );
}
