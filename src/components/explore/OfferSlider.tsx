import '@/styles/room-preview.css';

interface OfferSliderProps {
  value: number;
  min: number;
  max: number;
  sweetLo: number;
  sweetHi: number;
  currency: string;
  onChange: (v: number) => void;
}

/**
 * findastay offer slider. The sweet-spot nudge is derived from the PUBLIC guide
 * (sweetLo/sweetHi), never the private auto-accept price — so it encourages a
 * fair offer without revealing where instant-booking kicks in. Darker-jade
 * track, gauge ticks, a manual input, and the sweet-spot / rolling-the-dice
 * states with a popping star / rolling dice.
 */
export default function OfferSlider({ value, min, max, sweetLo, sweetHi, currency, onChange }: OfferSliderProps) {
  const sym = currency === 'AUD' ? 'A$' : '$';
  const clamp = (x: number) => Math.max(min, Math.min(max, Math.round(x || min)));
  const v = clamp(value);
  const sweet = v >= sweetLo;
  const zone = sweet ? 'sweet' : 'dice';
  const text = sweet
    ? (v >= sweetHi ? 'Strong offer — right around the rate' : 'Sweet spot — a smart offer')
    : 'Rolling the dice — let’s try your luck';

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-center">
        <span className="font-display text-sm font-extrabold text-[#0C1A22]">find<span style={{ color: '#0C9C8E' }}>a</span>stay</span>
        <p className="font-display text-2xl font-extrabold text-[#0C1A22]">Make your offer</p>
      </div>

      <div className="rp-trk mt-3">
        <input
          type="range"
          className="rp-range"
          min={min}
          max={max}
          value={v}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          aria-label="Your nightly offer"
        />
        <span className="rp-tick" style={{ left: '25%' }} />
        <span className="rp-tick" style={{ left: '50%' }} />
        <span className="rp-tick" style={{ left: '75%' }} />
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-[#0C1A22]">
        <span>or enter your offer:</span>
        <div className="flex items-center rounded-md border-2 px-2 font-display text-lg font-extrabold text-[#0C1A22]" style={{ borderColor: '#0a7d72' }}>
          <span>{sym}</span>
          <input
            className="rp-man font-display text-lg font-extrabold text-[#0C1A22]"
            value={v}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            inputMode="numeric"
            aria-label="Enter your offer"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-white" style={{ background: sweet ? '#0C1A22' : '#1E2A4A' }}>
        <span key={zone} className={`rp-ic ${sweet ? 'sweet' : 'manual'}`}>{sweet ? '✨' : '🎲'}</span>
        {text}
      </div>
    </div>
  );
}
