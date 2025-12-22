import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Check, MessageCircle, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Country-based pricing display
const BCF_PRICING = {
  NZ: { amount: 8.99, currency: 'NZD', symbol: '$' },
  AU: { amount: 12.00, currency: 'AUD', symbol: '$' },
};

interface OfferDetails {
  id: string;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  offer_amount: number;
  status: string;
  bcf_payment_status: string | null;
  bcf_amount: number | null;
  bcf_currency: string | null;
  properties: {
    name: string;
    city: string;
    country: string;
    image_url: string | null;
  };
}

export default function OfferConfirmed() {
  const [searchParams] = useSearchParams();
  const offerId = searchParams.get('offer_id');
  const sessionId = searchParams.get('session_id');
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Verify payment on mount if session_id is present
  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId || !offerId || !user) return;
      
      setVerifying(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await supabase.functions.invoke('verify-bcf-payment', {
          body: { session_id: sessionId, offer_id: offerId },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to verify payment');
        }

        toast({
          title: 'Booking Confirmed!',
          description: 'Your booking commitment fee has been paid successfully.',
        });
      } catch (error) {
        console.error('Verification error:', error);
        toast({
          title: 'Verification Issue',
          description: 'We had trouble verifying your payment. Please contact support if the issue persists.',
          variant: 'destructive',
        });
      } finally {
        setVerifying(false);
      }
    };

    if (user && sessionId) {
      verifyPayment();
    }
  }, [sessionId, offerId, user, toast]);

  useEffect(() => {
    const loadOffer = async () => {
      if (!offerId || !user) return;

      const { data, error } = await supabase
        .from('offers')
        .select(`
          id,
          check_in_date,
          check_out_date,
          adults,
          children,
          offer_amount,
          status,
          bcf_payment_status,
          bcf_amount,
          bcf_currency,
          properties:property_id (
            name,
            city,
            country,
            image_url
          )
        `)
        .eq('id', offerId)
        .eq('guest_user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading offer:', error);
      } else if (data) {
        setOffer(data as unknown as OfferDetails);
      }
      setLoading(false);
    };

    if (user && !verifying) {
      // Small delay to allow verification to complete first
      const timer = setTimeout(loadOffer, sessionId ? 1500 : 0);
      return () => clearTimeout(timer);
    }
  }, [offerId, user, verifying, sessionId]);

  if (authLoading || loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground mb-2">
            {verifying ? 'Verifying payment...' : 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Offer Not Found</CardTitle>
            <CardDescription>
              We couldn't find this offer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/explore')} className="w-full">
              Return to Explore
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const country = (offer.properties?.country || 'NZ') as keyof typeof BCF_PRICING;
  const pricing = BCF_PRICING[country] || BCF_PRICING.NZ;
  const bcfAmount = offer.bcf_amount || pricing.amount;
  const remainingBalance = offer.offer_amount - bcfAmount;

  return (
    <div className="min-h-full bg-background">
      <main className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Booking Confirmed!</CardTitle>
            <CardDescription>
              Your booking commitment fee has been paid. You can now message the property.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Property Summary */}
            <div className="flex gap-4 p-4 bg-muted rounded-lg">
              {offer.properties?.image_url && (
                <img 
                  src={offer.properties.image_url} 
                  alt={offer.properties.name}
                  className="w-20 h-20 object-cover rounded-md"
                />
              )}
              <div>
                <h3 className="font-semibold text-foreground">{offer.properties?.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {offer.properties?.city}, {offer.properties?.country}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(offer.check_in_date).toLocaleDateString()} - {new Date(offer.check_out_date).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {offer.adults} adult{offer.adults > 1 ? 's' : ''}{offer.children > 0 ? `, ${offer.children} child${offer.children > 1 ? 'ren' : ''}` : ''}
                </p>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="space-y-3 p-4 border border-border rounded-lg">
              <div className="flex justify-between items-center text-primary">
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Booking commitment fee paid
                </span>
                <span className="font-bold">{pricing.symbol}{bcfAmount.toFixed(2)} {offer.bcf_currency || pricing.currency}</span>
              </div>
              
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-muted-foreground">Remaining balance (pay at property)</span>
                <span className="font-medium">{pricing.symbol}{remainingBalance.toFixed(2)} {offer.bcf_currency || pricing.currency}</span>
              </div>
            </div>

            {/* What's Next */}
            <div className="p-4 bg-primary/5 rounded-lg space-y-3">
              <h4 className="font-semibold text-foreground">What's Next?</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <MessageCircle className="h-4 w-4 mt-0.5 text-primary" />
                  <span>You can now chat directly with the property to arrange check-in details</span>
                </li>
                <li className="flex items-start gap-2">
                  <Home className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Pay the remaining {pricing.symbol}{remainingBalance.toFixed(2)} directly to the property upon arrival</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => navigate('/messages')}
                className="w-full"
                size="lg"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Message Property
              </Button>
              
              <Button 
                onClick={() => navigate('/explore')}
                variant="outline"
                className="w-full"
              >
                Continue Exploring
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
