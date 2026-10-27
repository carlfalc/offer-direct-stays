import { useEffect, useState } from 'react';
import { Gauge, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

/** Resolution-based quality score (0–100) for an image's short side. */
function scoreFor(minDim: number): number {
  return Math.max(0, Math.min(100, Math.round((minDim / 1200) * 100)));
}

/**
 * An honest, on-device photo-quality check: measures each image's real pixel
 * dimensions and scores the listing's photos out of 100, flagging low-definition
 * ones so the owner knows which to replace with sharper shots. No upload/AI call.
 */
export default function PhotoQualityScore({ urls }: { urls: string[] }) {
  const [scores, setScores] = useState<number[] | null>(null);
  const key = urls.filter(Boolean).join('|');

  useEffect(() => {
    let cancelled = false;
    const uniq = Array.from(new Set(urls.filter(Boolean)));
    if (uniq.length === 0) { setScores([]); return; }
    Promise.all(uniq.map((u) => new Promise<number>((res) => {
      const img = new Image();
      img.onload = () => res(scoreFor(Math.min(img.naturalWidth, img.naturalHeight)));
      img.onerror = () => res(-1);
      img.src = u;
    }))).then((rs) => { if (!cancelled) setScores(rs.filter((r) => r >= 0)); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (scores === null) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking photo quality…
      </div>
    );
  }
  if (scores.length === 0) return null;

  const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const low = scores.filter((s) => s < 60).length;
  const n = scores.length;
  const tone = overall >= 80 ? 'good' : overall >= 60 ? 'ok' : 'low';
  const barColor = tone === 'good' ? '#0C9C8E' : tone === 'ok' ? '#E0A024' : '#DC2626';

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-extrabold text-[#0C1A22]">Photo quality score</h2></div>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex-none font-display text-4xl font-extrabold" style={{ color: barColor }}>{overall}<span className="text-xl text-[#0C1A22]/50">/100</span></div>
        <div className="min-w-0 flex-1">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${overall}%`, background: barColor }} />
          </div>
          <p className="mt-1.5 text-xs font-medium text-[#0C1A22]/70">Based on the resolution of your {n} photo{n === 1 ? '' : 's'}.</p>
        </div>
      </div>

      {low > 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm font-medium text-[#0C1A22]">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
          <p><b>{low} of {n}</b> photo{low === 1 ? ' is' : 's are'} low-definition. Travellers judge fast on images — replacing these with sharper shots (at least 1200px on the short side) will lift how your listing looks and converts.</p>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm font-medium text-[#0C1A22]">
          <CheckCircle2 className="h-4 w-4 flex-none text-success" /> Your photos look crisp — nice work.
        </div>
      )}
    </div>
  );
}
