import { useEffect, useRef } from 'react';

/** Full-screen celebration: confetti + "hold on tight" copy + progress, then onDone. */
export default function FsCelebration({ show, onDone, title = 'Hold on tight!', message = "This is getting exciting — we're right behind you. Setting up your dashboard…" }: {
  show: boolean; onDone: () => void; title?: string; message?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const msgRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!show) return;
    // confetti burst
    const cv = canvasRef.current;
    if (cv) {
      const ctx = cv.getContext('2d');
      const W = (cv.width = window.innerWidth), H = (cv.height = window.innerHeight);
      const cols = ['#0C9C8E', '#19C9B4', '#F4B24A', '#2ED3C0', '#cfe3e0'];
      const ps = Array.from({ length: 140 }, (_, i) => ({
        x: W / 2 + (Math.random() - 0.5) * 120, y: H * 0.4,
        vx: (Math.random() - 0.5) * 11, vy: Math.random() * -13 - 4, g: 0.32,
        r: Math.random() * 7 + 3, c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      }));
      let t = 0; let raf = 0;
      const loop = () => {
        t++; if (!ctx) return;
        ctx.clearRect(0, 0, W, H);
        ps.forEach((p) => { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); ctx.restore(); });
        if (t < 150) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      // cleanup raf on hide
      var cancel = () => cancelAnimationFrame(raf);
    }
    // progress + hand-off
    let p = 0;
    const iv = setInterval(() => {
      p += 2.2;
      if (fillRef.current) fillRef.current.style.width = `${Math.min(p, 100)}%`;
      if (p > 55 && msgRef.current) msgRef.current.textContent = 'Almost there — your dashboard is nearly live…';
      if (p >= 100) { clearInterval(iv); setTimeout(onDone, 500); }
    }, 90);
    return () => { clearInterval(iv); if (typeof cancel === 'function') cancel(); };
  }, [show, onDone]);

  return (
    <div className={`fo-cele${show ? ' show' : ''}`} aria-hidden={!show}>
      <canvas ref={canvasRef} className="fo-confetti" />
      <div className="fo-celebox">
        <div className="fo-rocket">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 8-10c3 0 5 2 5 5a22 22 0 0 1-10 8z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>
        </div>
        <h2 className="fo-disp">{title}</h2>
        <p ref={msgRef}>{message}</p>
        <div className="fo-pbar"><span ref={fillRef} /></div>
      </div>
    </div>
  );
}
