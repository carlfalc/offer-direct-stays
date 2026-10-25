import { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning, Settings2, MapPin } from 'lucide-react';
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

function iconFor(code: number): { Icon: LucideIcon; label: string } {
  if (code === 0) return { Icon: Sun, label: 'Fine' };
  if (code <= 3) return { Icon: Cloud, label: 'Cloudy' };
  if (code === 45 || code === 48) return { Icon: CloudFog, label: 'Fog' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { Icon: CloudRain, label: 'Showers' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { Icon: CloudSnow, label: 'Snow' };
  if (code >= 95) return { Icon: CloudLightning, label: 'Storm' };
  return { Icon: Cloud, label: '—' };
}

interface WxState {
  temp: number | null;
  code: number | null;
}

export default function WeatherTiles() {
  const [cities, setCities] = useState<City[]>(DEFAULT_CITIES);
  const [wx, setWx] = useState<Record<string, WxState>>({});
  const [unit, setUnit] = useState<'c' | 'f'>('c');
  const [, setTick] = useState(0);

  // tick every minute so the clocks stay current
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // device-location tile (best effort)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Pacific/Auckland';
        setCities((prev) => {
          if (prev.some((c) => c.device)) return prev;
          return [{ code: 'You', name: 'Your location', lat: pos.coords.latitude, lng: pos.coords.longitude, tz, device: true }, ...prev];
        });
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
      cities.map(async (c) => {
        try {
          const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=temperature_2m,weather_code&temperature_unit=${u}`,
          );
          const j = await r.json();
          return [c.code, { temp: Math.round(j?.current?.temperature_2m ?? NaN), code: j?.current?.weather_code ?? null }] as const;
        } catch {
          return [c.code, { temp: null, code: null }] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setWx(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [cities, unit]);

  const timeIn = (tz: string) => {
    try {
      return new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz })
        .format(new Date())
        .replace(/\s?(am|pm)/i, (m) => m.trim().toLowerCase()[0]);
    } catch {
      return '';
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {cities.map((c) => {
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
        onClick={() => setUnit((u) => (u === 'c' ? 'f' : 'c'))}
        className="grid h-[34px] w-[34px] place-items-center rounded-[10px] border border-dashed border-black/20 bg-white/60 text-muted-foreground transition hover:text-foreground"
        title="Change cities & units (°C/°F)"
        aria-label="Weather settings"
      >
        <Settings2 className="h-4 w-4" />
      </button>
    </div>
  );
}
