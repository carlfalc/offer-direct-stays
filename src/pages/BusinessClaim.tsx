import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { searchClaimableHotels, ClaimableHotel } from '@/lib/listings';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, MapPin, CheckCircle2, ImageIcon, ArrowRight } from 'lucide-react';

function HotelThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
        <ImageIcon className="h-4 w-4 opacity-50" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-12 w-16 flex-shrink-0 rounded-md object-cover" />;
}

export default function BusinessClaim() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClaimableHotel[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ClaimableHotel | null>(null);
  const [claiming, setClaiming] = useState(false);
  const reqId = useRef(0);

  // Debounced LiteAPI search across NZ + AU
  useEffect(() => {
    if (selected) return; // pause searching once a property is chosen
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const myReq = ++reqId.current;
    const t = setTimeout(async () => {
      const hits = await searchClaimableHotels(q);
      if (myReq === reqId.current) {
        setResults(hits);
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, selected]);

  const handleClaim = async () => {
    if (!selected) return;
    setClaiming(true);
    const { data, error } = await supabase.rpc('fs_claim_listing', {
      p_hotel_id: selected.id,
      p_name: selected.name,
      p_city: selected.city,
      p_country: selected.country,
      p_lat: selected.latitude,
      p_lng: selected.longitude,
      p_thumb: selected.thumbnail,
    } as any);
    setClaiming(false);
    if (error) {
      toast({ title: 'Could not claim property', description: error.message || 'Please try again', variant: 'destructive' });
      return;
    }
    toast({ title: 'Property claimed', description: `${selected.name} is now yours. Set your room prices to start taking offers.` });
    navigate('/business/dashboard');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Claim your property</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find your accommodation below and take control of your pricing and offers. Just start typing your property name.
        </p>
      </div>

      {!selected ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Aotea Motor Lodge"
              className="pl-10"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>

          <div className="mt-3 space-y-2">
            {query.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                No matches in New Zealand or Australia for “{query.trim()}”. Check the spelling, or try a shorter name.
              </p>
            )}

            {results.map((h) => {
              const disabled = h.claimedByOther;
              return (
                <Card
                  key={`${h.country}-${h.id}`}
                  className={disabled ? 'p-3 opacity-60' : 'cursor-pointer p-3 transition hover:border-primary/50'}
                  onClick={() => {
                    if (h.claimedByMe) {
                      navigate('/business/dashboard');
                      return;
                    }
                    if (!disabled) setSelected(h);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <HotelThumb src={h.thumbnail} alt={h.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{h.name}</p>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">
                          {h.city ? `${h.city}, ` : ''}
                          {h.country}
                        </span>
                      </div>
                    </div>
                    {h.claimedByMe ? (
                      <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Yours</Badge>
                    ) : h.claimedByOther ? (
                      <Badge variant="outline" className="text-muted-foreground">Already registered</Badge>
                    ) : (
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <HotelThumb src={selected.thumbnail} alt={selected.name} />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground">{selected.name}</p>
              <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>
                  {selected.address ? `${selected.address}, ` : ''}
                  {selected.city ? `${selected.city}, ` : ''}
                  {selected.country}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Confirm this is your property
            </p>
            <p className="mt-1 text-accent-foreground/80">
              Claiming links {selected.name} to your account so you can set your guide, auto-accept and floor prices and respond to offers.
            </p>
          </div>

          <div className="mt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setSelected(null)} disabled={claiming}>
              Not it — search again
            </Button>
            <Button className="flex-1" onClick={handleClaim} disabled={claiming}>
              {claiming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming…
                </>
              ) : (
                'Claim this property'
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
