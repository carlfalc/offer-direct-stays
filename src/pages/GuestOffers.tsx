import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Calendar, Users, Home, ArrowLeft, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

interface GuestOffer {
  id: string;
  offer_amount: number;
  counter_amount: number | null;
  status: string;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  updated_at: string;
  room_id: string | null;
  property: {
    id: string;
    name: string;
    city: string;
    country: string;
  } | null;
  room: {
    id: string;
    name: string;
  } | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  submitted: { label: 'Offer Sent', variant: 'secondary' },
  pending: { label: 'Pending', variant: 'secondary' },
  countered: { label: 'Countered', variant: 'outline' },
  accepted: { label: 'Accepted', variant: 'default' },
  confirmed: { label: 'Confirmed', variant: 'default' },
  declined: { label: 'Declined', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export default function GuestOffers() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<GuestOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/offers');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function fetchOffers() {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('offers')
          .select(`
            id,
            offer_amount,
            counter_amount,
            status,
            check_in_date,
            check_out_date,
            adults,
            children,
            updated_at,
            room_id,
            property:properties(id, name, city, country),
            room:rooms(id, name)
          `)
          .eq('guest_user_id', user.id)
          .order('updated_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching offers:', fetchError);
          setError('Failed to load offers');
          return;
        }

        setOffers((data as unknown as GuestOffer[]) || []);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchOffers();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/explore')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Offers</h1>
              <p className="text-muted-foreground">Track and manage your accommodation offers</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/messages')}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-3 flex-1">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : offers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No offers yet</h3>
              <p className="text-muted-foreground mb-6">
                Start exploring properties and make your first offer!
              </p>
              <Button onClick={() => navigate('/explore')}>
                Explore Properties
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => {
              const status = statusConfig[offer.status] || statusConfig.submitted;
              const checkIn = new Date(offer.check_in_date);
              const checkOut = new Date(offer.check_out_date);

              return (
                <Card key={offer.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-lg text-foreground">
                            {offer.property?.name || 'Unknown Property'}
                          </h3>
                          <Badge variant={status.variant} className="sm:hidden">
                            {status.label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <MapPin className="h-4 w-4" />
                          <span>{offer.property?.city}, {offer.property?.country}</span>
                        </div>

                        {offer.room && (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Home className="h-4 w-4" />
                            <span>{offer.room.name}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Calendar className="h-4 w-4" />
                          <span>{format(checkIn, 'MMM d')} - {format(checkOut, 'MMM d, yyyy')}</span>
                        </div>

                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Users className="h-4 w-4" />
                          <span>
                            {offer.adults} adult{offer.adults !== 1 ? 's' : ''}
                            {offer.children > 0 && `, ${offer.children} child${offer.children !== 1 ? 'ren' : ''}`}
                          </span>
                        </div>

                        <div className="pt-2">
                          <span className="font-semibold text-foreground">
                            ${offer.offer_amount.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground text-sm"> / night</span>
                          {offer.counter_amount && (
                            <span className="ml-2 text-sm text-primary">
                              Counter: ${offer.counter_amount.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Last updated: {format(new Date(offer.updated_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <Badge variant={status.variant} className="hidden sm:inline-flex">
                          {status.label}
                        </Badge>

                        {offer.status === 'countered' && (
                          <Button size="sm" variant="outline" onClick={() => navigate(`/offer-payment?offer_id=${offer.id}`)}>
                            View Counter
                          </Button>
                        )}

                        {offer.status === 'accepted' && (
                          <Button size="sm" onClick={() => navigate(`/offer-payment?offer_id=${offer.id}`)}>
                            Pay to Confirm
                          </Button>
                        )}

                        {offer.status === 'confirmed' && (
                          <Button size="sm" variant="secondary" disabled>
                            View Booking
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
