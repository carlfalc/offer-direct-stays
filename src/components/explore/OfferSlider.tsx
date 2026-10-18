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
 * Brand offer slider — mirrors the landing-page "name your price" slider:
 * teal fill, glowing thumb, a highlighted sweet-spot band, and a live verdict.
 */
export default function OfferSlider({ value, min, max, sweetLo, sweetHi, currency, onChange }: OfferSliderProps) {
  const pct = (x: number) => ((Math.min(max, Math.max(min, x)) - min) / (max - min)) * 100;
  const fill = pct(value);
  const sLo = pct(sweetLo);
  const sHi = pct(sweetHi);

  let cls = 'bold';
  let text = 'Bold offer — worth a shot on a quiet night.';
  if (value >= sweetHi) {
    cls = 'go';
    text = 'Strong offer — right around the going rate.';
  } else if (value >= sweetLo) {
    cls = 'go';
    text = "Likely accepted — you're in the sweet spot.";
  } else if (value >= sweetLo * 0.88) {
    cls = 'mid';
    text = "They'll probably counter — close, but a touch low.";
  }

  return (
    <div className="fs-offer-slider">
      <div className="fsos-amt">
        {currency} ${value}
        <span>/night</span>
      </div>
      <div className="fsos-track-wrap">
        <div className="fsos-sweet" style={{ left: `${sLo}%`, width: `${sHi - sLo}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={Math.min(max, Math.max(min, value))}
          style={{ ['--fill' as string]: `${fill}%` } as React.CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Your nightly offer"
        />
      </div>
      <div className="fsos-scale">
        <span>${min}</span>
        <span>drag to set your offer</span>
        <span>${max}</span>
      </div>
      <div className={`fsos-verdict ${cls}`}>{text}</div>
    </div>
  );
}
