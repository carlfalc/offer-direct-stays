/* findastay landing — imperative brand behaviour (canvas backdrop, offer slider,
   generative property tiles, deal chips, count-up, view routing).
   Returns a cleanup function. Scoped to the given root element. */
export function initLanding(
  root: HTMLElement,
  navigate: (to: string) => void,
  initialView: string
): () => void {
  const $ = (s: string) => root.querySelector(s) as any;
  const $$ = (s: string) => Array.from(root.querySelectorAll(s)) as any[];
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const cleanups: Array<() => void> = [];

  /* ---------- animated dusk-city backdrop ---------- */
  const cv = $('#sky') as HTMLCanvasElement;
  let raf = 0;
  if (cv) {
    const cx = cv.getContext('2d') as CanvasRenderingContext2D;
    let W = 0, H = 0, DPR = 1;
    let layers: any[] = [], stars: any[] = [], clouds: any[] = [];
    let mx = 0, my = 0, tmx = 0, tmy = 0;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    function build() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const defs = [
        { y: .98, bw: [70, 150], bh: [.18, .42], col: '#0a1526', win: .015, depth: 14 },
        { y: 1.0, bw: [46, 96], bh: [.28, .6], col: '#0b1a2e', win: .03, depth: 26 },
        { y: 1.0, bw: [30, 64], bh: [.4, .86], col: '#0d2338', win: .06, depth: 42 }
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
          blds.push({ x, w, h, wins });
          x += w + rnd(-6, 10);
        }
        return { d, blds };
      });
      stars = []; for (let i = 0; i < 70; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * .5, r: rnd(.4, 1.3), ph: Math.random() * 6.28 });
      clouds = []; for (let j = 0; j < 5; j++) clouds.push({ x: Math.random() * W, y: rnd(H * .08, H * .42), r: rnd(120, 260), sp: rnd(.06, .18), a: rnd(.04, .1) });
    }
    function draw(t: number) {
      const g = cx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#070C16'); g.addColorStop(.42, '#0C1A2E'); g.addColorStop(.72, '#163049'); g.addColorStop(.9, '#123c40'); g.addColorStop(1, '#0c5248');
      cx.fillStyle = g; cx.fillRect(0, 0, W, H);
      const gg = cx.createRadialGradient(W * .5, H * .96, 10, W * .5, H * .96, W * .7);
      gg.addColorStop(0, 'rgba(47,214,178,.22)'); gg.addColorStop(1, 'rgba(47,214,178,0)');
      cx.fillStyle = gg; cx.fillRect(0, H * .5, W, H * .5);
      cx.save();
      stars.forEach((s: any) => { const tw = .5 + .5 * Math.sin(t * .001 + s.ph); cx.globalAlpha = tw * .8; cx.fillStyle = '#dfe9ff'; cx.beginPath(); cx.arc(s.x + tmx * .4, s.y + tmy * .3, s.r, 0, 6.3); cx.fill(); });
      cx.restore();
      clouds.forEach((c: any) => {
        c.x += c.sp; if (c.x - c.r > W) c.x = -c.r;
        const cg = cx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        cg.addColorStop(0, 'rgba(120,150,190,' + c.a + ')'); cg.addColorStop(1, 'rgba(120,150,190,0)');
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
            cx.fillStyle = 'rgba(' + (150) + ',' + (220 + 30 * lit) + ',' + (255) + ',' + lit + ')';
            cx.fillRect(w.x, w.y, 3.2, 4.2);
          });
        });
        cx.restore();
      });
    }
    function loop(t: number) { tmx += (mx - tmx) * .05; tmy += (my - tmy) * .05; draw(t); raf = requestAnimationFrame(loop); }
    function startBackdrop() { build(); if (reduce) { draw(0); } else { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } }
    let rz: any;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(startBackdrop, 180); };
    const onMove = (e: MouseEvent) => { mx = (e.clientX / window.innerWidth - .5) * 2; my = (e.clientY / window.innerHeight - .5) * 2; };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMove);
    cleanups.push(() => { window.removeEventListener('resize', onResize); window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); });
    startBackdrop();
  }

  /* ---------- generative property tiles ---------- */
  function paintBuilding(canvas: HTMLCanvasElement, hue: any) {
    const c = canvas.getContext('2d') as CanvasRenderingContext2D, w = canvas.width, h = canvas.height;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hue.sky0); g.addColorStop(.6, hue.sky1); g.addColorStop(1, hue.sky2);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const gg = c.createRadialGradient(w * .5, h * .9, 5, w * .5, h * .9, w * .8);
    gg.addColorStop(0, 'rgba(47,214,178,.3)'); gg.addColorStop(1, 'rgba(47,214,178,0)');
    c.fillStyle = gg; c.fillRect(0, 0, w, h);
    let x = -10;
    while (x < w + 10) {
      const bw = 10 + Math.random() * 26, bh = (.3 + Math.random() * .55) * h;
      c.fillStyle = hue.bld; c.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 6; yy < h - 6; yy += 9) for (let xx = x + 3; xx < x + bw - 3; xx += 7) {
        if (Math.random() < .5) { c.fillStyle = 'rgba(160,235,255,' + (0.25 + Math.random() * 0.6) + ')'; c.fillRect(xx, yy, 2.4, 3); }
      }
      x += bw + Math.random() * 6;
    }
  }
  const palettes = [
    { sky0: '#1a2746', sky1: '#2a3b5e', sky2: '#1f6e60', bld: '#0e1a30' },
    { sky0: '#241a33', sky1: '#3d2b4e', sky2: '#235e7a', bld: '#160f24' },
    { sky0: '#102b33', sky1: '#1d4a4e', sky2: '#1a7a6a', bld: '#08202a' },
    { sky0: '#2a2238', sky1: '#463858', sky2: '#355a8a', bld: '#180f22' },
    { sky0: '#132238', sky1: '#24405e', sky2: '#1f6e60', bld: '#0a1526' },
    { sky0: '#1f2b22', sky1: '#35503c', sky2: '#2a7a6a', bld: '#0e1a12' }
  ];
  const props = [
    { loc: 'Whanganui, NZ', name: 'Aotea Motor Lodge', rate: 'offers from $150', was: '$189', badge: 'Open to offers' },
    { loc: 'Queenstown, NZ', name: 'Lakeedge Suites', rate: 'offers from $220', was: '$285', badge: 'Open to offers' },
    { loc: 'Byron Bay, AU', name: 'The Dune House', rate: 'offers from $240', was: '$310', badge: 'Open to offers' },
    { loc: 'Wānaka, NZ', name: 'Alpine View Lodge', rate: 'offers from $175', was: '$229', badge: 'Open to offers' },
    { loc: 'Gold Coast, AU', name: 'Kirra Beach Rooms', rate: 'offers from $165', was: '$210', badge: 'Open to offers' },
    { loc: 'Napier, NZ', name: 'Deco Boutique Hotel', rate: 'offers from $140', was: '$179', badge: 'Open to offers' }
  ];
  const sc = $('#showcase');
  if (sc) {
    props.forEach((p, i) => {
      const card = document.createElement('div'); card.className = 'prop-card';
      const cvs = document.createElement('canvas'); cvs.width = 320; cvs.height = 400;
      paintBuilding(cvs, palettes[i % palettes.length]); card.appendChild(cvs);
      const scrim = document.createElement('div'); scrim.className = 'scrim'; card.appendChild(scrim);
      const badge = document.createElement('div'); badge.className = 'badge'; badge.textContent = p.badge; card.appendChild(badge);
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.innerHTML = '<div class="loc">' + p.loc + '</div><h3>' + p.name + '</h3><div class="rate"><s>' + p.was + '</s> ' + p.rate + '</div>';
      card.appendChild(meta); sc.appendChild(card);
    });
  }
  const th = $('#thumb'); if (th) paintBuilding(th, palettes[0]);

  /* ---------- interactive offer slider ---------- */
  const slider = $('#slider'), amt = $('#amt'), verdict = $('#verdict'), vText = $('#verdictText'), nets = $('#nets');
  function updOffer() {
    const v = +slider.value;
    amt.textContent = '$' + v;
    const pct = (v - +slider.min) / (+slider.max - +slider.min) * 100;
    slider.style.setProperty('--fill', pct + '%');
    nets.textContent = '$' + (v - 9.99).toFixed(0);
    verdict.classList.remove('go', 'mid');
    if (v >= 160) { verdict.classList.add('go'); vText.textContent = v >= 185 ? "Instant yes — that's near the listed rate." : "Likely accepted — you're in the sweet spot."; verdict.querySelector('.ic').innerHTML = '<path d="M5 13l4 4L19 7"/>'; }
    else if (v >= 142) { verdict.classList.add('mid'); vText.textContent = "They'll probably counter — close, but a touch low."; verdict.querySelector('.ic').innerHTML = '<path d="M12 8v5M12 16v.5"/><circle cx="12" cy="12" r="9"/>'; }
    else { vText.textContent = "Bold offer — worth a shot on a quiet night."; verdict.querySelector('.ic').innerHTML = '<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>'; }
  }
  if (slider) { slider.addEventListener('input', updOffer); updOffer(); }

  /* ---------- floating deal chips ---------- */
  const dealData = [{ t: '$155 accepted', s: 'Rotorua' }, { t: '$210 · counter', s: 'Byron Bay' }, { t: '$140 accepted', s: 'Napier' }, { t: '$188 accepted', s: 'Wānaka' }];
  const dealsEl = $('#deals');
  if (dealsEl) {
    const positions = [{ l: '62%', t: '10px' }, { l: '4%', t: '70px' }, { l: '72%', t: '130px' }, { l: '30%', t: '180px' }];
    dealData.forEach((d, i) => {
      const c = document.createElement('div'); c.className = 'chip'; c.style.left = positions[i].l; c.style.top = positions[i].t; c.style.animationDelay = (i * 1.3) + 's';
      c.innerHTML = '<span class="tick"></span><b>' + d.t + '</b> · ' + d.s; dealsEl.appendChild(c);
    });
  }

  /* ---------- pointer glow on step cards ---------- */
  $$('.step').forEach((s: any) => {
    s.addEventListener('pointermove', (e: PointerEvent) => { const r = s.getBoundingClientRect(); s.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%'); s.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%'); });
  });

  /* ---------- count-up stats ---------- */
  function countUp(el: any) {
    const target = +el.dataset.count, dec = +(el.dataset.dec || 0), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    if (reduce) { el.textContent = pre + target.toFixed(dec) + suf; return; }
    const start = performance.now(), dur = 1100;
    function fr(now: number) { const k = Math.min((now - start) / dur, 1); const e = 1 - Math.pow(1 - k, 3); el.textContent = pre + (target * e).toFixed(dec) + suf; if (k < 1) requestAnimationFrame(fr); }
    requestAnimationFrame(fr);
  }
  let statsSeen = false;
  const io = new IntersectionObserver((en) => { en.forEach((x) => { if (x.isIntersecting && !statsSeen) { statsSeen = true; $$('#stats .big').forEach(countUp); } }); }, { threshold: .4 });
  const statsEl = $('#stats'); if (statsEl) io.observe(statsEl);
  cleanups.push(() => io.disconnect());

  /* ---------- view routing ---------- */
  const views: any = { home: $('#view-home'), 'new-era': $('#view-new-era'), faq: $('#view-faq') };
  const navl = $$('.nav-links a[data-view]');
  function show(name: string, scrollTo?: string) {
    if (!views[name]) name = 'home';
    for (const k in views) if (views[k]) views[k].hidden = (k !== name);
    navl.forEach((a: any) => a.classList.toggle('active', a.dataset.view === name));
    root.classList.remove('mobile-open');
    if (scrollTo) { const el = $('#' + scrollTo); setTimeout(() => { if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 60); }
    else window.scrollTo({ top: 0, behavior: 'auto' });
  }
  const onClick = (e: any) => {
    const t = e.target.closest('[data-nav],[data-go]'); if (!t) return;
    e.preventDefault();
    if (t.dataset.go) { navigate(t.dataset.go); return; }
    show(t.dataset.view || 'home', t.dataset.scroll);
  };
  root.addEventListener('click', onClick);
  cleanups.push(() => root.removeEventListener('click', onClick));

  const menuBtn = $('#menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', () => root.classList.toggle('mobile-open'));

  const form = $('#bizForm');
  if (form) form.addEventListener('submit', (e: Event) => { e.preventDefault(); const em = $('#bizEmail'); if (!em.value) { em.focus(); return; } form.hidden = true; $('#bizOk').hidden = false; });

  show(initialView || 'home');

  return () => { cleanups.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } }); };
}
