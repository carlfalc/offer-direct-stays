import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Calendar, Users, Home, ArrowLeft, MessageSquare, FlaskConical } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
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
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

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

  // Demo Tool Functions (dev only)
  const createDemoOffer = async () => {
    if (!user) return;
    setDemoLoading('create');
    try {
      // Get first demo property + room
      const { data: property } = await supabase
        .from('properties')
        .select('id')
        .limit(1)
        .single();

      if (!property) {
        toast.error('No demo property found');
        return;
      }

      const { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('property_id', property.id)
        .limit(1)
        .single();

      const { data: offer, error } = await supabase
        .from('offers')
        .insert({
          guest_user_id: user.id,
          property_id: property.id,
          room_id: room?.id || null,
          offer_amount: 150,
          check_in_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
          check_out_date: format(addDays(new Date(), 10), 'yyyy-MM-dd'),
          adults: 2,
          children: 0,
          status: 'submitted',
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Demo offer created');
      setSelectedOfferId(offer.id);
      // Reload offers
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create demo offer');
    } finally {
      setDemoLoading(null);
    }
  };

  const simulateBusinessAccept = async () => {
    if (!selectedOfferId) {
      toast.error('Select an offer first (click on an offer card)');
      return;
    }
    setDemoLoading('accept');
    try {
      const { error } = await supabase
        .from('offers')
        .update({ status: 'accepted' })
        .eq('id', selectedOfferId);

      if (error) throw error;
      toast.success('Offer accepted');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept offer');
    } finally {
      setDemoLoading(null);
    }
  };

  const simulateConfirmed = async () => {
    if (!selectedOfferId) {
      toast.error('Select an offer first (click on an offer card)');
      return;
    }
    setDemoLoading('confirm');
    try {
      // Update offer to confirmed
      const { error: offerError } = await supabase
        .from('offers')
        .update({ 
          status: 'confirmed',
          bcf_payment_status: 'paid',
          bcf_paid_at: new Date().toISOString()
        })
        .eq('id', selectedOfferId);

      if (offerError) throw offerError;

      // Get offer details
      const { data: offer } = await supabase
        .from('offers')
        .select('guest_user_id, property_id')
        .eq('id', selectedOfferId)
        .single();

      if (!offer) throw new Error('Offer not found');

      // Get property business_id
      const { data: property } = await supabase
        .from('properties')
        .select('business_id')
        .eq('id', offer.property_id)
        .single();

      // Get business owner user_id
      let businessUserId: string | null = null;
      if (property?.business_id) {
        const { data: business } = await supabase
          .from('businesses')
          .select('user_id')
          .eq('id', property.business_id)
          .single();
        businessUserId = business?.user_id || null;
      }

      // Check for existing conversation
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('offer_id', selectedOfferId)
        .maybeSingle();

      let conversationId: string | null = null;
      const systemMessage = "Booking confirmed ✅ You can now message the property directly here.";

      if (existingConv) {
        conversationId = existingConv.id;
        await supabase
          .from('conversations')
          .update({
            is_unlocked: true,
            business_id: property?.business_id || null,
            business_user_id: businessUserId,
            last_message_at: new Date().toISOString()
          })
          .eq('id', conversationId);
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            offer_id: selectedOfferId,
            guest_user_id: offer.guest_user_id,
            business_id: property?.business_id || null,
            business_user_id: businessUserId,
            is_unlocked: true,
            last_message_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (convError) throw convError;
        conversationId = newConv?.id || null;
      }

      // Insert system message if conversation exists
      if (conversationId) {
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('content', systemMessage)
          .maybeSingle();

        if (!existingMsg) {
          await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              sender_user_id: offer.guest_user_id,
              content: systemMessage,
              is_read: false
            });
        }
      }

      toast.success('Offer confirmed + conversation unlocked');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm offer');
    } finally {
      setDemoLoading(null);
    }
  };

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

        {/* Demo Tools Panel (dev only) */}
        {import.meta.env.DEV && (
          <Card className="mb-6 border-dashed border-2 border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                <FlaskConical className="h-4 w-4" />
                Demo Tools (dev only)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={createDemoOffer}
                  disabled={demoLoading !== null}
                >
                  {demoLoading === 'create' ? 'Creating...' : 'A) Create Demo Offer'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={simulateBusinessAccept}
                  disabled={demoLoading !== null || !selectedOfferId}
                >
                  {demoLoading === 'accept' ? 'Accepting...' : 'B) Simulate Business Accept'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={simulateConfirmed}
                  disabled={demoLoading !== null || !selectedOfferId}
                >
                  {demoLoading === 'confirm' ? 'Confirming...' : 'C) Simulate Confirmed (unlock chat)'}
                </Button>
              </div>
              {selectedOfferId && (
                <p className="text-xs text-muted-foreground mt-2">
                  Selected offer: {selectedOfferId.slice(0, 8)}...
                </p>
              )}
              {!selectedOfferId && offers.length > 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  Click an offer card to select it for B & C actions
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
              const isSelected = selectedOfferId === offer.id;

              return (
                <Card 
                  key={offer.id} 
                  className={`hover:shadow-md transition-shadow cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedOfferId(offer.id)}
                >
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
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/offer-payment?offer_id=${offer.id}`); }}>
                            View Counter
                          </Button>
                        )}

                        {offer.status === 'accepted' && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/offer-payment?offer_id=${offer.id}`); }}>
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
