import { useEffect, useRef } from "react";

/** Animated city brand backdrop. Fixed, full-viewport, sits behind page content.
 *  variant "night" (default) = dusk sky with lit windows; "day" = white sky with
 *  the same skyline kept as a soft silhouette (for the light business theme). */
export default function BrandBackdrop({ variant = 'night' }: { variant?: 'night' | 'day' }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const isDay = variant === 'day';
    const cv = ref.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    if (!cx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    let W = 0, H = 0, DPR = 1, raf = 0;
    let layers: any[] = [], stars: any[] = [], clouds: any[] = [];
    let mx = 0, my = 0, tmx = 0, tmy = 0;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    function build() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const defs = [
        { y: .98, bw: [70, 150], bh: [.18, .42], col: "#0a1526", depth: 14 },
        { y: 1.0, bw: [46, 96], bh: [.28, .6], col: "#0b1a2e", depth: 26 },
        { y: 1.0, bw: [30, 64], bh: [.4, .86], col: "#0d2338", depth: 42 },
      ];
      layers = defs.map((d: any) => {
        const blds: any[] = []; let x = -40;
        while (x < W + 60) {
          const w = rnd(d.bw[0], d.bw[1]), h = rnd(d.bh[0], d.bh[1]) * H;
          const wins: any[] = [];
          const cols = Math.max(2, Math.floor(w / 16)), rows = Math.max(3, Math.floor(h / 20));
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (Math.random() < .5) wins.push({ x: x + 8 + c * ((w - 14) / cols), y: H * d.y - h + 12 + r * ((h - 16) / rows), on: Math.random() < .5, ph: Math.random() * 6.28 });
          }
          blds.push({ x, w, h, wins }); x += w + rnd(-6, 10);
        }
        return { d, blds };
      });
      stars = []; for (let i = 0; i < 70; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * .5, r: rnd(.4, 1.3), ph: Math.random() * 6.28 });
      clouds = []; for (let j = 0; j < 5; j++) clouds.push({ x: Math.random() * W, y: rnd(H * .08, H * .42), r: rnd(120, 260), sp: rnd(.06, .18), a: rnd(.04, .1) });
    }
    function draw(t: number) {
      const g = cx.createLinearGradient(0, 0, 0, H);
      if (isDay) {
        g.addColorStop(0, "#f7fafc"); g.addColorStop(.45, "#eef4f9"); g.addColorStop(.75, "#e6eef4"); g.addColorStop(1, "#dfeae8");
      } else {
        g.addColorStop(0, "#070C16"); g.addColorStop(.42, "#0C1A2E"); g.addColorStop(.72, "#163049"); g.addColorStop(.9, "#123c40"); g.addColorStop(1, "#0c5248");
      }
      cx.fillStyle = g; cx.fillRect(0, 0, W, H);
      const gg = cx.createRadialGradient(W * .5, H * .96, 10, W * .5, H * .96, W * .7);
      if (isDay) { gg.addColorStop(0, "rgba(47,160,178,.08)"); gg.addColorStop(1, "rgba(47,160,178,0)"); }
      else { gg.addColorStop(0, "rgba(47,214,178,.22)"); gg.addColorStop(1, "rgba(47,214,178,0)"); }
      cx.fillStyle = gg; cx.fillRect(0, H * .5, W, H * .5);
      if (!isDay) {
        cx.save();
        stars.forEach((s: any) => { const tw = .5 + .5 * Math.sin(t * .001 + s.ph); cx.globalAlpha = tw * .8; cx.fillStyle = "#dfe9ff"; cx.beginPath(); cx.arc(s.x + tmx * .4, s.y + tmy * .3, s.r, 0, 6.3); cx.fill(); });
        cx.restore();
      }
      clouds.forEach((c: any) => {
        c.x += c.sp; if (c.x - c.r > W) c.x = -c.r;
        const cg = cx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        cg.addColorStop(0, "rgba(120,150,190," + c.a + ")"); cg.addColorStop(1, "rgba(120,150,190,0)");
        cx.fillStyle = cg; cx.beginPath(); cx.arc(c.x + tmx * .6, c.y, c.r, 0, 6.3); cx.fill();
      });
      layers.forEach((L: any, li: number) => {
        const off = (li + 1) / layers.length; const px = tmx * L.d.depth * off, py = tmy * L.d.depth * .3 * off;
        cx.save(); cx.translate(px, py);
        L.blds.forEach((b: any) => {
          cx.fillStyle = L.d.col; cx.fillRect(b.x, H - b.h, b.w, b.h + 30);
          b.wins.forEach((w: any) => {
            const lit = w.on ? (.55 + .45 * Math.sin(t * .0012 + w.ph)) : 0.06;
            if (Math.random() < .0007) w.on = !w.on;
            // Day: faint pale windows so the skyline reads as a clean silhouette.
            cx.fillStyle = isDay
              ? "rgba(228,236,244," + (lit * 0.5) + ")"
              : "rgba(150," + (220 + 30 * lit) + ",255," + lit + ")";
            cx.fillRect(w.x, w.y, 3.2, 4.2);
          });
        });
        cx.restore();
      });
    }
    function loop(t: number) { tmx += (mx - tmx) * .05; tmy += (my - tmy) * .05; draw(t); raf = requestAnimationFrame(loop); }
    function start() { build(); if (reduce) draw(0); else { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } }
    let rz: any;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(start, 180); };
    const onMove = (e: MouseEvent) => { mx = (e.clientX / window.innerWidth - .5) * 2; my = (e.clientY / window.innerHeight - .5) * 2; };
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMove);
    start();
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, [variant]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />;
}
