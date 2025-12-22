import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, ArrowLeft, Loader2, Calendar, CreditCard, MessageCircle, Plane } from 'lucide-react';
import { format } from 'date-fns';

interface Trip {
  id: string;
  offer_amount: number;
  counter_amount: number | null;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  status: string;
  bcf_payment_status: string | null;
  bcf_paid_at: string | null;
  created_at: string;
  property: Property;
  conversation_id?: string;
}

export default function Trips() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadTrips();
    }
  }, [user]);

  const loadTrips = async () => {
    setLoading(true);
    try {
      // Get confirmed offers
      const { data: offers, error: offersError } = await supabase
        .from('offers')
        .select(`
          id,
          offer_amount,
          counter_amount,
          check_in_date,
          check_out_date,
          adults,
          children,
          status,
          bcf_payment_status,
          bcf_paid_at,
          created_at,
          properties:property_id (*)
        `)
        .eq('guest_user_id', user?.id)
        .eq('status', 'confirmed')
        .order('check_in_date', { ascending: true });

      if (offersError) throw offersError;

      // Get conversations to link to trips
      const { data: conversations, error: convoError } = await supabase
        .from('conversations')
        .select('id, offer_id')
        .eq('guest_user_id', user?.id);

      if (convoError) throw convoError;

      const convoMap = new Map(
        (conversations || []).map((c: any) => [c.offer_id, c.id])
      );

      const tripData = (offers || []).map((offer: any) => ({
        id: offer.id,
        offer_amount: offer.offer_amount,
        counter_amount: offer.counter_amount,
        check_in_date: offer.check_in_date,
        check_out_date: offer.check_out_date,
        adults: offer.adults,
        children: offer.children,
        status: offer.status,
        bcf_payment_status: offer.bcf_payment_status,
        bcf_paid_at: offer.bcf_paid_at,
        created_at: offer.created_at,
        property: offer.properties as Property,
        conversation_id: convoMap.get(offer.id),
      }));

      setTrips(tripData);
    } catch (err) {
      console.error('Error loading trips:', err);
      toast({
        title: 'Error',
        description: 'Failed to load trips',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDateRange = (checkIn: string, checkOut: string) => {
    return `${format(new Date(checkIn), 'MMM d')} – ${format(new Date(checkOut), 'MMM d, yyyy')}`;
  };

  const getAgreedRate = (trip: Trip) => {
    return trip.counter_amount || trip.offer_amount;
  };

  const getNights = (checkIn: string, checkOut: string) => {
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      {/* Content */}
      <main className="max-w-3xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Trips</h1>
          <p className="text-muted-foreground">Your confirmed bookings</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16">
            <Plane className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-medium mb-2">No confirmed trips yet</h2>
            <p className="text-muted-foreground mb-4">
              Once a property accepts your offer and you confirm, your trip will appear here.
            </p>
            <Button onClick={() => navigate('/explore')}>Start Exploring</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {trips.length} confirmed {trips.length === 1 ? 'trip' : 'trips'}
            </p>

            {trips.map((trip) => {
              const nights = getNights(trip.check_in_date, trip.check_out_date);
              const agreedRate = getAgreedRate(trip);
              const totalCost = agreedRate * nights;

              return (
                <Card key={trip.id} className="overflow-hidden">
                  <div className="flex gap-4 p-4">
                    {trip.property.image_url && (
                      <img
                        src={trip.property.image_url}
                        alt={trip.property.name}
                        className="w-28 h-28 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold truncate">{trip.property.name}</h3>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3" />
                            <span>{trip.property.city}, {trip.property.country}</span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                          Confirmed
                        </Badge>
                      </div>
                      
                      {/* Trip details */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDateRange(trip.check_in_date, trip.check_out_date)}</span>
                          <span className="text-muted-foreground">({nights} nights)</span>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-medium">
                            ${agreedRate.toFixed(0)} / night
                          </span>
                          <span className="text-muted-foreground">
                            Total: ${totalCost.toFixed(0)}
                          </span>
                        </div>

                        {/* Payment Status */}
                        <div className="flex items-center gap-2 text-sm">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <div className="flex items-center gap-2">
                            {trip.bcf_payment_status === 'paid' ? (
                              <Badge variant="outline" className="text-xs text-success border-success">
                                BCF Paid
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                BCF Pending
                              </Badge>
                            )}
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground text-xs">
                              Accommodation: Pay at property
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {trip.conversation_id && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/messages/${trip.conversation_id}`)}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Message property
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
