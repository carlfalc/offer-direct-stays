import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFsCounts } from '@/hooks/useFsCounts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FsTrip, FsTripItem, listTrips, listTripItems } from '@/lib/trips';
import { cn } from '@/lib/utils';
import WeatherTiles from '@/components/explore/WeatherTiles';
import { useTileOrder } from '@/hooks/useTileOrder';
import { Search, Send, MessageSquare, Heart, MapPin, Loader2, ArrowRight, RotateCcw } from 'lucide-react';

const BAND_BG: Record<string, string> = { yellow: '#FBEFC9', orange: '#F7D6B6', navy: '#1E2A4A' };

export default function TravellerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toConfirm } = useFsCounts();

  const [trips, setTrips] = useState<FsTrip[]>([]);
  const [items, setItems] = useState<FsTripItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [bandColor, setBandColor] = useState<'yellow' | 'orange' | 'navy'>(() => {
    try { return (localStorage.getItem('fs_band') as any) || 'navy'; } catch { return 'navy'; }
  });
  const pickBand = (c: 'yellow' | 'orange' | 'navy') => {
    setBandColor(c);
    try { localStorage.setItem('fs_band', c); } catch { /* ignore */ }
  };
  const navy = bandColor === 'navy';
  const { order, reset: resetTiles, dragProps } = useTileOrder('fs_trav_tiles', ['offers', 'messages', 'browse']);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([listTrips(user.id), listTripItems(user.id)])
      .then(([t, i]) => { setTrips(t); setItems(i); })
      .finally(() => setLoading(false));
  }, [user]);

  const itemsByTrip = (tripId: string) => items.filter((i) => i.trip_id === tripId);
  const firstName = (user?.email || 'there').split('@')[0];

  const tileCfg: Record<string, { icon: React.ReactNode; label: string; sub: string; badge?: number; to: string }> = {
    offers: { icon: <Send className="h-5 w-5" />, label: 'My offers', sub: toConfirm > 0 ? `${toConfirm} to confirm` : 'Track your offers', badge: toConfirm, to: '/offers' },
    messages: { icon: <MessageSquare className="h-5 w-5" />, label: 'Messages', sub: 'Chat with hosts', to: '/messages' },
    browse: { icon: <Search className="h-5 w-5" />, label: 'Browse stays', sub: 'Name your price', to: '/explore' },
  };

  return (
    <div className="fas-brand-day min-h-screen bg-background text-foreground">
      {/* Template band — welcome, change-the-look + reset, weather */}
      <div style={{ backgroundColor: BAND_BG[bandColor] }}>
        <div className="mx-auto w-full max-w-5xl px-4 pb-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn('mb-1 font-mono text-[0.65rem] uppercase tracking-[0.18em]', navy ? 'text-white/70' : 'text-foreground/70')}>Welcome back</p>
              <h1 className={cn('font-display text-3xl font-extrabold capitalize tracking-tight md:text-4xl', navy ? 'text-white' : 'text-foreground')}>
                Hi {firstName} — where to next?
              </h1>
              <Button size="sm" className="mt-3 gap-2 bg-[#0C1A22] text-white hover:bg-[#0C1A22]/90" onClick={() => navigate('/explore')}>
                <Search className="h-4 w-4" /> Find a stay
              </Button>
            </div>
            <div className={cn('flex items-center gap-2 text-xs font-semibold', navy ? 'text-white/85' : 'text-muted-foreground')}>
              Change the look
              {(['yellow', 'orange', 'navy'] as const).map((c) => (
                <button key={c} type="button" onClick={() => pickBand(c)} aria-label={c}
                  className={cn('h-5 w-5 rounded-full border-2 border-black/10', bandColor === c && (navy ? 'outline outline-2 outline-white' : 'outline outline-2 outline-foreground'))}
                  style={{ backgroundColor: BAND_BG[c] }} />
              ))}
              <button type="button" onClick={() => { pickBand('navy'); resetTiles(); }} title="Reset look & tile layout to default"
                className={cn('ml-1 inline-flex items-center gap-1 rounded-md border px-2 py-1', navy ? 'border-white/30 text-white/80' : 'border-black/15 text-muted-foreground')}>
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
          </div>
          <div className="mt-4"><WeatherTiles /></div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        {/* Quick tiles — hover to lift, drag to rearrange */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {order.map((id) => {
            const c = tileCfg[id];
            if (!c) return null;
            return (
              <button
                key={id}
                {...dragProps(id)}
                onClick={() => navigate(c.to)}
                className="group relative flex cursor-grab flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_14px_28px_-14px_rgba(8,22,30,.45)] active:cursor-grabbing"
              >
                {c.badge && c.badge > 0 ? (
                  <span className="absolute right-3 top-3 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                    {c.badge > 99 ? '99+' : c.badge}
                  </span>
                ) : null}
                <span className="text-primary">{c.icon}</span>
                <span className="font-semibold text-foreground">{c.label}</span>
                <span className="text-xs text-muted-foreground">{c.sub}</span>
              </button>
            );
          })}
        </div>

        {/* Your trips */}
        <div className="mt-8">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-primary">Saved into trips</p>
              <h2 className="font-display text-2xl font-bold tracking-tight">Your trips</h2>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/explore')}>
              Find more <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : trips.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 p-10 text-center">
              <Heart className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No saved trips yet. Tap the heart on any stay to start a trip like “Noosa”.</p>
              <Button size="sm" className="gap-2" onClick={() => navigate('/explore')}>
                <Search className="h-4 w-4" /> Find a stay
              </Button>
            </Card>
          ) : (
            <div className="space-y-5">
              {trips.map((t) => {
                const its = itemsByTrip(t.id);
                return (
                  <div key={t.id}>
                    <div className="mb-2 flex items-baseline gap-2">
                      <h3 className="font-display text-lg font-semibold">{t.name}</h3>
                      <span className="text-xs text-muted-foreground">{its.length} {its.length === 1 ? 'stay' : 'stays'}</span>
                    </div>
                    {its.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No stays saved here yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {its.map((it) => (
                          <Card key={it.id} className="overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_-14px_rgba(8,22,30,.45)]">
                            <div className="aspect-[4/3] bg-muted">
                              {it.image_url ? (
                                <img src={it.image_url} alt={it.name || 'Stay'} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground/40"><MapPin className="h-6 w-6" /></div>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="truncate text-sm font-semibold">{it.name || 'Stay'}</p>
                              <p className="truncate text-xs text-muted-foreground">{it.city}{it.country ? `, ${it.country}` : ''}</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
