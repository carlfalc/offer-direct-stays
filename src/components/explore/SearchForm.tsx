import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stepper } from '@/components/ui/stepper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';

export interface SearchCriteria {
  country: 'NZ' | 'AU';
  city: string;
  checkIn: string;   // YYYY-MM-DD
  checkOut: string;  // YYYY-MM-DD
  adults: number;
  children: number;
  childAges: number[];
}

interface Props {
  initial: SearchCriteria;
  loading?: boolean;
  onSearch: (c: SearchCriteria) => void;
  variant?: 'default' | 'hero';
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function SearchForm({ initial, loading, onSearch, variant = 'default' }: Props) {
  const hero = variant === 'hero';
  const labelCls = hero ? 'text-xs text-white/80' : 'text-xs text-muted-foreground';
  const [country, setCountry] = useState<'NZ' | 'AU'>(initial.country || 'NZ');
  const [city, setCity] = useState(initial.city || '');
  const [checkIn, setCheckIn] = useState(initial.checkIn || iso(new Date(Date.now() + 14 * 864e5)));
  const [checkOut, setCheckOut] = useState(initial.checkOut || iso(new Date(Date.now() + 16 * 864e5)));
  const [adults, setAdults] = useState(initial.adults || 2);
  const [children, setChildren] = useState(initial.children || 0);
  const [childAges, setChildAges] = useState<number[]>(initial.childAges || []);
  const [error, setError] = useState<string | null>(null);

  const setChildCount = (n: number) => {
    setChildren(n);
    setChildAges((ages) => {
      const next = ages.slice(0, n);
      while (next.length < n) next.push(8);
      return next;
    });
  };

  const submit = () => {
    if (!city.trim()) return setError('Enter a town or city.');
    if (new Date(checkOut) <= new Date(checkIn)) return setError('Check-out must be after check-in.');
    setError(null);
    onSearch({ country, city: city.trim(), checkIn, checkOut, adults, children, childAges });
  };

  return (
    <div className={hero
      ? 'space-y-3 rounded-3xl border border-white/40 bg-white/15 p-5 backdrop-blur-xl shadow-2xl'
      : 'space-y-3 border-b border-border/50 bg-card/40 p-4 backdrop-blur-sm'}>
      {hero && (
        <div className="flex items-center gap-2 text-white font-semibold text-sm pb-1">
          <Search className="h-4 w-4 text-primary" /> Where to?
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className={labelCls}>Country</Label>
          <Select value={country} onValueChange={(v) => setCountry(v as 'NZ' | 'AU')}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NZ">New Zealand</SelectItem>
              <SelectItem value="AU">Australia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={labelCls}>Town / city</Label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. Whanganui"
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className={labelCls}>Check-in</Label>
          <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className={labelCls}>Check-out</Label>
          <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-1" />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={16} />
        <Stepper label="Children" value={children} onChange={setChildCount} min={0} max={10} />
      </div>

      {children > 0 && (
        <div>
          <Label className={labelCls}>Age of each child at check-out</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {childAges.map((age, i) => (
              <Input
                key={i}
                type="number"
                min={0}
                max={17}
                value={age}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(17, Number(e.target.value) || 0));
                  setChildAges((ages) => ages.map((a, j) => (j === i ? v : a)));
                }}
                className="h-9 w-16"
                aria-label={`Child ${i + 1} age`}
              />
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button className="w-full" onClick={submit} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
          </>
        ) : (
          <>
            <Search className="mr-2 h-4 w-4" /> Search stays
          </>
        )}
      </Button>
    </div>
  );
}
