import { useEffect, useRef, useState } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning, Settings2, MapPin, X, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface City {
  code: string;
  name: string;
  lat: number;
  lng: number;
  tz: string;
  device?: boolean;
}

const DEFAULT_CITIES: City[] = [
  { code: 'WAG', name: 'Whanganui', lat: -39.93, lng: 175.05, tz: 'Pacific/Auckland' },
  { code: 'AKL', name: 'Auckland', lat: -36.85, lng: 174.76, tz: 'Pacific/Auckland' },
  { code: 'ZQN', name: 'Queenstown', lat: -45.03, lng: 168.66, tz: 'Pacific/Auckland' },
  { code: 'BNE', name: 'Brisbane', lat: -27.47, lng: 153.03, tz: 'Australia/Brisbane' },
  { code: 'SYD', name: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' },
];

// Pick-list of cities, grouped by country (NZ + AU for now).
const CATALOG: { label: string; code: 'NZ' | 'AU'; cities: City[] }[] = [
  {
    label: 'New Zealand', code: 'NZ', cities: [
      { code: 'AKL', name: 'Auckland', lat: -36.85, lng: 174.76, tz: 'Pacific/Auckland' },
      { code: 'WLG', name: 'Wellington', lat: -41.29, lng: 174.78, tz: 'Pacific/Auckland' },
      { code: 'CHC', name: 'Christchurch', lat: -43.53, lng: 172.64, tz: 'Pacific/Auckland' },
      { code: 'WAG', name: 'Whanganui', lat: -39.93, lng: 175.05, tz: 'Pacific/Auckland' },
      { code: 'HLZ', name: 'Hamilton', lat: -37.79, lng: 175.28, tz: 'Pacific/Auckland' },
      { code: 'TRG', name: 'Tauranga', lat: -37.69, lng: 176.17, tz: 'Pacific/Auckland' },
      { code: 'ZQN', name: 'Queenstown', lat: -45.03, lng: 168.66, tz: 'Pacific/Auckland' },
      { code: 'DUD', name: 'Dunedin', lat: -45.87, lng: 170.50, tz: 'Pacific/Auckland' },
      { code: 'NPE', name: 'Napier', lat: -39.49, lng: 176.91, tz: 'Pacific/Auckland' },
      { code: 'PMR', name: 'Palmerston North', lat: -40.35, lng: 175.61, tz: 'Pacific/Auckland' },
      { code: 'NPL', name: 'New Plymouth', lat: -39.06, lng: 174.08, tz: 'Pacific/Auckland' },
      { code: 'NSN', name: 'Nelson', lat: -41.27, lng: 173.28, tz: 'Pacific/Auckland' },
      { code: 'ROT', name: 'Rotorua', lat: -38.14, lng: 176.25, tz: 'Pacific/Auckland' },
      { code: 'IVC', name: 'Invercargill', lat: -46.41, lng: 168.35, tz: 'Pacific/Auckland' },
    ],
  },
  {
    label: 'Australia', code: 'AU', cities: [
      { code: 'SYD', name: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' },
      { code: 'MEL', name: 'Melbourne', lat: -37.81, lng: 144.96, tz: 'Australia/Melbourne' },
      { code: 'BNE', name: 'Brisbane', lat: -27.47, lng: 153.03, tz: 'Australia/Brisbane' },
      { code: 'PER', name: 'Perth', lat: -31.95, lng: 115.86, tz: 'Australia/Perth' },
      { code: 'ADL', name: 'Adelaide', lat: -34.93, lng: 138.60, tz: 'Australia/Adelaide' },
      { code: 'OOL', name: 'Gold Coast', lat: -28.02, lng: 153.40, tz: 'Australia/Brisbane' },
      { code: 'CBR', name: 'Canberra', lat: -35.28, lng: 149.13, tz: 'Australia/Sydney' },
      { code: 'HBA', name: 'Hobart', lat: -42.88, lng: 147.33, tz: 'Australia/Hobart' },
      { code: 'DRW', name: 'Darwin', lat: -12.46, lng: 130.84, tz: 'Australia/Darwin' },
      { code: 'CNS', name: 'Cairns', lat: -16.92, lng: 145.77, tz: 'Australia/Brisbane' },
      { code: 'NTL', name: 'Newcastle', lat: -32.93, lng: 151.78, tz: 'Australia/Sydney' },
      { code: 'WOL', name: 'Wollongong', lat: -34.42, lng: 150.89, tz: 'Australia/Sydney' },
    ],
  },
];

const STORE_KEY = 'fs_weather_cities';
function loadSaved(): City[] | null {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const a = JSON.parse(raw); if (Array.isArray(a) && a.length) return a; } } catch { /* ignore */ }
  return null;
}

function iconFor(code: number): { Icon: LucideIcon; label: string } {
  if (code === 0) return { Icon: Sun, label: 'Fine' };
  if (code <= 3) return { Icon: Cloud, label: 'Cloudy' };
  if (code === 45 || code === 48) return { Icon: CloudFog, label: 'Fog' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { Icon: CloudRain, label: 'Showers' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { Icon: CloudSnow, label: 'Snow' };
  if (code >= 95) return { Icon: CloudLightning, label: 'Storm' };
  return { Icon: Cloud, label: '—' };
}

interface WxState { temp: number | null; code: number | null }

export default function WeatherTiles() {
  const [cities, setCities] = useState<City[]>(() => loadSaved() ?? DEFAULT_CITIES);
  const [device, setDevice] = useState<City | null>(null);
  const [wx, setWx] = useState<Record<string, WxState>>({});
  const [unit, setUnit] = useState<'c' | 'f'>('c');
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<'NZ' | 'AU'>('NZ');
  const [pick, setPick] = useState('');
  const [, setTick] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const allCities = device ? [device, ...cities] : cities;

  // persist user cities (not the device tile)
  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cities)); } catch { /* ignore */ } }, [cities]);

  // tick every minute so the clocks stay current
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // close the editor on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // device-location tile (best effort)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Pacific/Auckland';
        setDevice({ code: 'You', name: 'Your location', lat: pos.coords.latitude, lng: pos.coords.longitude, tz, device: true });
      },
      () => {},
      { timeout: 8000, maximumAge: 600000 },
    );
  }, []);

  // fetch weather for all cities
  useEffect(() => {
    let cancelled = false;
    const u = unit === 'f' ? 'fahrenheit' : 'celsius';
    Promise.all(
      allCities.map(async (c) => {
        try {
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=temperature_2m,weather_code&temperature_unit=${u}`);
          const j = await r.json();
          return [c.code, { temp: Math.round(j?.current?.temperature_2m ?? NaN), code: j?.current?.weather_code ?? null }] as const;
        } catch {
          return [c.code, { temp: null, code: null }] as const;
        }
      }),
    ).then((entries) => { if (!cancelled) setWx(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allCities.map((c) => c.code)), unit]);

  const timeIn = (tz: string) => {
    try {
      return new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz })
        .format(new Date()).replace(/\s?(am|pm)/i, (m) => m.trim().toLowerCase()[0]);
    } catch { return ''; }
  };

  const addCity = () => {
    if (!pick) return;
    const found = CATALOG.find((g) => g.code === country)?.cities.find((c) => c.code === pick);
    if (!found) return;
    setCities((prev) => (prev.some((c) => c.code === found.code) ? prev : [...prev, found]));
    setPick('');
  };
  const removeCity = (code: string) => setCities((prev) => prev.filter((c) => c.code !== code));

  const options = (CATALOG.find((g) => g.code === country)?.cities || []).filter((c) => !cities.some((x) => x.code === c.code));

  return (
    <div className="relative mb-4 flex flex-wrap items-center gap-2">
      {allCities.map((c) => {
        const w = wx[c.code];
        const { Icon, label } = w?.code != null ? iconFor(w.code) : { Icon: Cloud, label: '…' };
        return (
          <div
            key={c.code}
            className={`flex items-center gap-2 rounded-xl border bg-white px-2.5 py-1.5 shadow-[0_4px_12px_-9px_rgba(8,22,30,.45)] ${c.device ? 'border-foreground/15 outline outline-2 outline-foreground/10' : 'border-black/10'}`}
            title={c.name}
          >
            {c.device ? <MapPin className="h-[18px] w-[18px] flex-none text-[#243640]" /> : <Icon className="h-[18px] w-[18px] flex-none text-[#243640]" />}
            <div className="leading-tight">
              <div className="text-[0.8rem] font-bold text-foreground">{c.code} · {w?.temp != null ? `${w.temp}°` : '—'}</div>
              <div className="text-[0.66rem] text-muted-foreground">{label}</div>
            </div>
            <span className="ml-0.5 border-l border-border pl-2 font-mono text-[0.72rem] font-bold text-foreground">{timeIn(c.tz)}</span>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-[34px] w-[34px] place-items-center rounded-[10px] border border-dashed border-black/20 bg-white/60 text-muted-foreground transition hover:text-foreground"
        title="Edit locations & units"
        aria-label="Edit weather locations"
      >
        <Settings2 className="h-4 w-4" />
      </button>

      {open && (
        <div ref={panelRef} className="absolute left-0 top-full z-20 mt-2 w-[300px] rounded-xl border border-border bg-white p-3 text-foreground shadow-xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Your locations</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {cities.map((c) => (
              <span key={c.code} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs font-semibold">
                {c.name}
                <button type="button" onClick={() => removeCity(c.code)} className="text-muted-foreground hover:text-red-600" aria-label={`Remove ${c.name}`}><X className="h-3 w-3" /></button>
              </span>
            ))}
            {cities.length === 0 && <span className="text-xs text-muted-foreground">No locations yet — add one below.</span>}
          </div>

          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Add a location</p>
          <div className="flex items-center gap-1.5">
            <select value={country} onChange={(e) => { setCountry(e.target.value as 'NZ' | 'AU'); setPick(''); }} className="rounded-lg border border-border bg-white px-2 py-1 text-sm">
              {CATALOG.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
            </select>
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-white px-2 py-1 text-sm">
              <option value="">Select a city…</option>
              {options.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <button type="button" onClick={addCity} disabled={!pick} className="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg bg-[#0C9C8E] text-white disabled:opacity-50" aria-label="Add city"><Plus className="h-4 w-4" /></button>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
            <span className="text-xs font-semibold text-muted-foreground">Units</span>
            <div className="flex overflow-hidden rounded-lg border border-border text-xs font-bold">
              <button type="button" onClick={() => setUnit('c')} className={`px-2.5 py-1 ${unit === 'c' ? 'bg-[#0C9C8E] text-white' : 'text-foreground'}`}>°C</button>
              <button type="button" onClick={() => setUnit('f')} className={`px-2.5 py-1 ${unit === 'f' ? 'bg-[#0C9C8E] text-white' : 'text-foreground'}`}>°F</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
