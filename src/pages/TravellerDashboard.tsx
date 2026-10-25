import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFsCounts } from '@/hooks/useFsCounts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FsTrip, FsTripItem, listTrips, listTripItems } from '@/lib/trips';
import { Search, Send, MessageSquare, Heart, MapPin, Loader2, ArrowRight } from 'lucide-react';

export default function TravellerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toConfirm } = useFsCounts();

  const [trips, setTrips] = useState<FsTrip[]>([]);
  const [items, setItems] = useState<FsTripItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([listTrips(user.id), listTripItems(user.id)])
      .then(([t, i]) => {
        setTrips(t);
        setItems(i);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const itemsByTrip = (tripId: string) => items.filter((i) => i.trip_id === tripId);
  const firstName = (user?.email || 'there').split('@')[0];

  return (
    <div className="fas-brand-day min-h-screen bg-background text-foreground">
      {/* Villa hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/hero-traveller.jpg')" }} aria-hidden />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(6,22,28,.55),rgba(6,22,28,.15) 35%,rgba(6,22,28,.55))' }} aria-hidden />
        <div className="relative mx-auto w-full max-w-5xl px-4 py-12 md:py-16">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-primary">Welcome back</p>
          <h1 className="font-display text-3xl font-extrabold capitalize tracking-tight text-white md:text-5xl">
            Hi {firstName} — where to next?
          </h1>
          <p className="mt-3 max-w-[46ch] text-white/85">
            Name your price on stays across New Zealand &amp; Australia. Save the ones you love into trips, and track your offers all in one place.
          </p>
          <Button size="lg" className="mt-5 gap-2" onClick={() => navigate('/explore')}>
            <Search className="h-4 w-4" /> Find a stay
          </Button>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <QuickTile icon={<Send className="h-5 w-5" />} label="My offers" sub={toConfirm > 0 ? `${toConfirm} to confirm` : 'Track your offers'} badge={toConfirm} onClick={() => navigate('/offers')} />
          <QuickTile icon={<MessageSquare className="h-5 w-5" />} label="Messages" sub="Chat with hosts" onClick={() => navigate('/messages')} />
          <QuickTile icon={<Search className="h-5 w-5" />} label="Browse stays" sub="Name your price" onClick={() => navigate('/explore')} />
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
              <p className="text-sm text-muted-foreground">
                No saved trips yet. Tap the heart on any stay to start a trip like “Noosa”.
              </p>
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
                          <Card key={it.id} className="overflow-hidden">
                            <div className="aspect-[4/3] bg-muted">
                              {it.image_url ? (
                                <img src={it.image_url} alt={it.name || 'Stay'} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground/40">
                                  <MapPin className="h-6 w-6" />
                                </div>
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

function QuickTile({
  icon,
  label,
  sub,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40"
    >
      {badge && badge > 0 ? (
        <span className="absolute right-3 top-3 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
      <span className="text-primary">{icon}</span>
      <span className="font-semibold text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}
