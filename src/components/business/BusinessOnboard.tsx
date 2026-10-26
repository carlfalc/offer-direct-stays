import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { searchClaimableHotels, ClaimableHotel } from '@/lib/listings';
import BusinessClaimForm, { ClaimPayload } from './BusinessClaimForm';
import FsCelebration from './FsCelebration';
import '@/styles/findastay-onboard.css';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, MapPin, ImageIcon, ArrowRight, Plus } from 'lucide-react';

function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground"><ImageIcon className="h-4 w-4 opacity-50" /></div>;
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-12 w-16 flex-shrink-0 rounded-md object-cover" />;
}

/**
 * Business onboarding: search the directory and claim, or create a business
 * that isn't listed. Both paths require business details + all four agreements
 * before anything is claimed. Writes only to fs_listings.
 */
export default function BusinessOnboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClaimableHotel[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ClaimableHotel | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [celebrate, setCelebrate] = useState(false);
  const reqId = useRef(0);

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

  const claim = async (p: ClaimPayload) => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc('fs_claim_listing', {
      p_hotel_id: selected.id, p_name: selected.name, p_city: selected.city, p_country: selected.country,
      p_lat: selected.latitude, p_lng: selected.longitude, p_thumb: selected.thumbnail,
      p_contact_name: p.contactName, p_business_email: p.businessEmail, p_business_phone: p.businessPhone,
      p_nzbn: p.nzbn, p_property_type: p.propertyType, p_payment_terms: p.paymentTerms,
      p_payment_lead_days: p.paymentTerms === 'days_before' ? p.leadDays : null, p_agreements: p.agreements,
    } as any);
    // Payment methods aren't a claim arg — save them straight after.
    if (!error) {
      await supabase.from('fs_listings').update({ payment_methods: p.paymentMethods, payment_note: p.paymentNote || null } as any).eq('liteapi_hotel_id', selected.id);
    }
    setBusy(false);
    if (error) { toast({ title: 'Could not claim', description: error.message || 'Please try again', variant: 'destructive' }); return; }
    setCelebrate(true);
  };

  const create = async (p: ClaimPayload) => {
    setBusy(true);
    const { error } = await supabase.rpc('fs_create_listing', {
      p_name: p.name, p_city: p.city || null, p_country: p.country, p_address: p.address || null,
      p_payment_methods: p.paymentMethods, p_payment_note: p.paymentNote || null,
      p_contact_name: p.contactName, p_business_email: p.businessEmail, p_business_phone: p.businessPhone,
      p_nzbn: p.nzbn, p_property_type: p.propertyType, p_payment_terms: p.paymentTerms,
      p_payment_lead_days: p.paymentTerms === 'days_before' ? p.leadDays : null, p_agreements: p.agreements,
    } as any);
    setBusy(false);
    if (error) { toast({ title: 'Could not create', description: error.message || 'Please try again', variant: 'destructive' }); return; }
    setCelebrate(true);
  };

  const cele = <FsCelebration show={celebrate} onDone={() => navigate('/business/content')} />;

  if (mode === 'create') {
    return <>{cele}<BusinessClaimForm mode="create" busy={busy} onBack={() => setMode('search')} onSubmit={create} /></>;
  }
  if (selected) {
    return <>{cele}<BusinessClaimForm mode="claim" hotel={selected} busy={busy} onBack={() => setSelected(null)} onSubmit={claim} /></>;
  }

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
                  : <ArrowRight className="h-6 w-6 flex-shrink-0 text-foreground" strokeWidth={2.5} />}
              </div>
            </Card>
          );
        })}

        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p className="px-1 py-4 text-center text-sm text-muted-foreground">No matches for “{query.trim()}” in NZ or Australia.</p>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-border p-4 text-center">
        <p className="text-sm font-medium text-foreground">Can’t find your business, or brand new?</p>
        <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setMode('create')}><Plus className="h-4 w-4" /> Create your business here</Button>
      </div>
    </div>
  );
}
