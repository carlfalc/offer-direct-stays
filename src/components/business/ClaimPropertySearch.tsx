import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { searchClaimableHotels, ClaimableHotel } from '@/lib/listings';
import BusinessDetailsForm from './BusinessDetailsForm';
import RequestOnboardingForm from './RequestOnboardingForm';
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

interface Props {
  heading?: string;
  subtitle?: string;
  /** Called after a successful claim. Default: go to the business dashboard. */
  onClaimed?: (hotel: ClaimableHotel) => void;
}

/**
 * "Claim my business" — type-ahead search of LiteAPI accommodation across NZ+AU
 * by name, then claim it (fs_claim_listing). No map: businesses just search.
 */
export default function ClaimPropertySearch({
  heading = 'Claim my business',
  subtitle = 'Find your accommodation below and take control of your pricing and offers. Just start typing your business name.',
  onClaimed,
}: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClaimableHotel[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ClaimableHotel | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimedHotel, setClaimedHotel] = useState<ClaimableHotel | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [checking, setChecking] = useState(true);
  const reqId = useRef(0);

  // If the user already owns a listing but hasn't completed their business
  // profile, jump straight to the details form for it (breaks the
  // claim → dashboard → guard → onboarding loop).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setChecking(false);
        return;
      }
      const { data: biz } = await supabase.from('businesses').select('id').eq('user_id', user.id).maybeSingle();
      if (!cancelled && !biz) {
        const { data: ls } = await supabase
          .from('fs_listings')
          .select('liteapi_hotel_id,name,city,country,latitude,longitude,thumbnail')
          .eq('owner_id', user.id)
          .limit(1);
        const l = (ls as any[])?.[0];
        if (!cancelled && l) {
          setClaimedHotel({
            id: l.liteapi_hotel_id,
            name: l.name,
            city: l.city,
            country: (l.country === 'AU' ? 'AU' : 'NZ'),
            thumbnail: l.thumbnail,
            latitude: l.latitude,
            longitude: l.longitude,
            address: null,
            claimedByOther: false,
            claimedByMe: true,
          });
        }
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (selected) return;
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
    const { error } = await supabase.rpc('fs_claim_listing', {
      p_hotel_id: selected.id,
      p_name: selected.name,
      p_city: selected.city,
      p_country: selected.country,
      p_lat: selected.latitude,
      p_lng: selected.longitude,
      p_thumb: selected.thumbnail,
    } as any);
    if (error) {
      setClaiming(false);
      toast({ title: 'Could not claim business', description: error.message || 'Please try again', variant: 'destructive' });
      return;
    }
    // Claimed. If there's no business profile yet, collect it next; otherwise done.
    let hasProfile = false;
    if (user) {
      const { data: biz } = await supabase.from('businesses').select('id').eq('user_id', user.id).maybeSingle();
      hasProfile = !!biz;
    }
    setClaiming(false);
    toast({ title: 'Business claimed', description: `${selected.name} is now yours.` });
    if (hasProfile) {
      if (onClaimed) onClaimed(selected);
      else navigate('/business/dashboard');
    } else {
      setClaimedHotel(selected); // show the details form
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (claimedHotel) {
    return <BusinessDetailsForm hotel={claimedHotel} onDone={() => window.location.assign('/business/dashboard')} />;
  }

  if (showRequest) {
    return <RequestOnboardingForm initialBusinessName={query.trim()} onBack={() => setShowRequest(false)} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">{heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {!selected ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing your business name… e.g. Aotea Motor Lodge" className="pl-10" />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>

          <div className="mt-3 space-y-2">
            {query.trim().length >= 2 && !searching && results.length === 0 && (
              <div className="px-1 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No matches in New Zealand or Australia for “{query.trim()}”.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowRequest(true)}>
                  Can't find it? Request onboarding
                </Button>
              </div>
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

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Business not listed or brand new?{' '}
            <button onClick={() => setShowRequest(true)} className="font-medium text-primary underline-offset-2 hover:underline">
              Request onboarding
            </button>
          </p>
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
              <CheckCircle2 className="h-4 w-4" /> Confirm this is your business
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
                'Claim this business'
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
