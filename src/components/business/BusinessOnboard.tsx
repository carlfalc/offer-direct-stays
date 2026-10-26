import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { searchClaimableHotels, ClaimableHotel } from '@/lib/listings';
import { PAYMENT_METHODS, PaymentMethodId } from '@/lib/paymentMethods';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Search, Loader2, MapPin, ImageIcon, ArrowRight, CheckCircle2, Plus } from 'lucide-react';

function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground"><ImageIcon className="h-4 w-4 opacity-50" /></div>;
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-12 w-16 flex-shrink-0 rounded-md object-cover" />;
}

/**
 * Clean business onboarding: search the directory and claim, or create a
 * business that isn't listed. Writes only to fs_listings — no legacy tables.
 * After claim/create the owner goes to set up rooms & photos.
 */
export default function BusinessOnboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClaimableHotel[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ClaimableHotel | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const reqId = useRef(0);

  // create-your-business form
  const [cName, setCName] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cCity, setCCity] = useState('');
  const [cCountry, setCCountry] = useState<'NZ' | 'AU'>('NZ');
  const [methods, setMethods] = useState<Set<PaymentMethodId>>(new Set(['bank_transfer']));
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (selected || mode === 'create') return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const myReq = ++reqId.current;
    const t = setTimeout(async () => {
      const hits = await searchClaimableHotels(q);
      if (myReq === reqId.current) { setResults(hits); setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query, selected, mode]);

  const claim = async () => {
    if (!selected) return;
    setClaiming(true);
    const { error } = await supabase.rpc('fs_claim_listing', {
      p_hotel_id: selected.id, p_name: selected.name, p_city: selected.city,
      p_country: selected.country, p_lat: selected.latitude, p_lng: selected.longitude, p_thumb: selected.thumbnail,
    } as any);
    setClaiming(false);
    if (error) { toast({ title: 'Could not claim', description: error.message || 'Please try again', variant: 'destructive' }); return; }
    toast({ title: 'Business claimed 🎉', description: `${selected.name} is now yours. Let's set up your rooms.` });
    navigate('/business/content');
  };

  const toggleMethod = (id: PaymentMethodId) =>
    setMethods((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const create = async () => {
    if (!cName.trim()) { toast({ title: 'Name needed', description: 'Give your business a name.', variant: 'destructive' }); return; }
    setCreating(true);
    const { error } = await supabase.rpc('fs_create_listing', {
      p_name: cName.trim(), p_city: cCity.trim() || null, p_country: cCountry,
      p_address: cAddress.trim() || null, p_payment_methods: Array.from(methods), p_payment_note: note.trim() || null,
    } as any);
    setCreating(false);
    if (error) { toast({ title: 'Could not create', description: error.message || 'Please try again', variant: 'destructive' }); return; }
    toast({ title: 'Business created 🎉', description: `${cName.trim()} is set up. Let's add your rooms.` });
    navigate('/business/content');
  };

  // ---- Create form ----
  if (mode === 'create') {
    return (
      <div className="space-y-4">
        <button onClick={() => setMode('search')} className="text-sm text-muted-foreground hover:text-foreground">← Back to search</button>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Create your business</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add your details — you can refine everything (rooms, photos, prices) next.</p>
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">Business name
            <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. Aotea Motor Lodge" className="mt-1" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">Address
            <Input value={cAddress} onChange={(e) => setCAddress(e.target.value)} placeholder="Street address" className="mt-1" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-muted-foreground">Town / city
              <Input value={cCity} onChange={(e) => setCCity(e.target.value)} placeholder="e.g. Whanganui" className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">Country
              <select value={cCountry} onChange={(e) => setCCountry(e.target.value as 'NZ' | 'AU')} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="NZ">New Zealand</option>
                <option value="AU">Australia</option>
              </select>
            </label>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">How do you want to receive payment?</p>
          <p className="mb-2 text-xs text-muted-foreground">Tick all you accept — you can change these any time. findastay only ever takes the commitment fee.</p>
          <div className="space-y-2">
            {PAYMENT_METHODS.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 hover:border-primary/40">
                <input type="checkbox" checked={methods.has(m.id)} onChange={() => toggleMethod(m.id)} className="mt-0.5 h-4 w-4 flex-none" />
                <span className="min-w-0"><span className="text-sm font-medium text-foreground">{m.label}</span><span className="block text-xs text-muted-foreground">{m.hint}</span></span>
              </label>
            ))}
          </div>
          {methods.has('payment_link') && (
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paste your payment link or add any payment notes for guests" className="mt-2 min-h-[56px]" />
          )}
        </div>

        <Button className="w-full" onClick={create} disabled={creating}>
          {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : 'Create business & set up rooms'}
        </Button>
      </div>
    );
  }

  // ---- Confirm claim ----
  if (selected) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Thumb src={selected.thumbnail} alt={selected.name} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground">{selected.name}</p>
            <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /><span>{selected.city ? `${selected.city}, ` : ''}{selected.country}</span></div>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
          <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Confirm this is your business</p>
          <p className="mt-1 text-accent-foreground/80">Claiming links {selected.name} to your account so you can set prices, add photos and take offers.</p>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setSelected(null)} disabled={claiming}>Not it — search again</Button>
          <Button className="flex-1" onClick={claim} disabled={claiming}>{claiming ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming…</> : 'Claim this business'}</Button>
        </div>
      </Card>
    );
  }

  // ---- Search ----
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing your business name… e.g. Aotea Motor Lodge" className="pl-10" />
        {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      <div className="mt-3 space-y-2">
        {results.map((h) => {
          const disabled = h.claimedByOther;
          return (
            <Card key={`${h.country}-${h.id}`} className={disabled ? 'p-3 opacity-60' : 'cursor-pointer p-3 transition hover:border-primary/50'}
              onClick={() => { if (h.claimedByMe) { navigate('/business/dashboard'); return; } if (!disabled) setSelected(h); }}>
              <div className="flex items-center gap-3">
                <Thumb src={h.thumbnail} alt={h.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{h.name}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /><span className="truncate">{h.city ? `${h.city}, ` : ''}{h.country}</span></div>
                </div>
                {h.claimedByMe ? <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Yours</Badge>
                  : h.claimedByOther ? <Badge variant="outline" className="text-muted-foreground">Already registered</Badge>
                  : <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
              </div>
            </Card>
          );
        })}

        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p className="px-1 py-4 text-center text-sm text-muted-foreground">No matches for “{query.trim()}” in NZ or Australia.</p>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">Can’t find your business, or brand new?</p>
        <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setMode('create')}><Plus className="h-4 w-4" /> Create your business here</Button>
      </div>
    </div>
  );
}
