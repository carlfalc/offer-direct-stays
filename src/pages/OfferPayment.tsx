import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, CreditCard, AlertCircle, Check } from 'lucide-react';
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
  properties: {
    name: string;
    city: string;
    country: string;
    image_url: string | null;
  };
}

export default function OfferPayment() {
  const [searchParams] = useSearchParams();
  const offerId = searchParams.get('offer_id');
  const cancelled = searchParams.get('cancelled');
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (cancelled === 'true') {
      toast({
        title: 'Payment Cancelled',
        description: 'Your payment was cancelled. You can try again when ready.',
        variant: 'destructive',
      });
    }
  }, [cancelled, toast]);

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
        toast({
          title: 'Error',
          description: 'Failed to load offer details',
          variant: 'destructive',
        });
      } else if (data) {
        setOffer(data as unknown as OfferDetails);
      }
      setLoading(false);
    };

    if (user) {
      loadOffer();
    }
  }, [offerId, user, toast]);

  const handlePayBCF = async () => {
    if (!offer) return;
    
    setProcessing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-bcf-payment', {
        body: { offer_id: offer.id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create payment session');
      }

      const { url } = response.data;
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment Error',
        description: error instanceof Error ? error.message : 'Failed to initiate payment',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Offer Not Found
            </CardTitle>
            <CardDescription>
              We couldn't find this offer. It may have expired or been removed.
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

  if (offer.status !== 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Offer Not Ready</CardTitle>
            <CardDescription>
              This offer hasn't been accepted yet. You'll receive a notification when the property responds.
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

  if (offer.bcf_payment_status === 'paid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              Already Paid
            </CardTitle>
            <CardDescription>
              The booking commitment fee has already been paid for this offer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(`/offer-confirmed?offer_id=${offer.id}`)} className="w-full">
              View Confirmation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const country = (offer.properties?.country || 'NZ') as keyof typeof BCF_PRICING;
  const pricing = BCF_PRICING[country] || BCF_PRICING.NZ;
  const remainingBalance = offer.offer_amount - pricing.amount;

  return (
    <div className="min-h-full bg-background">
      <main className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Booking</CardTitle>
            <CardDescription>
              Your offer has been accepted! Pay the booking commitment fee to confirm.
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

            {/* Payment Breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total booking amount</span>
                <span className="font-medium">{pricing.symbol}{offer.offer_amount.toFixed(2)} {pricing.currency}</span>
              </div>
              
              <div className="flex justify-between items-center text-primary">
                <span className="font-medium">Booking commitment fee (pay now)</span>
                <span className="font-bold">{pricing.symbol}{pricing.amount.toFixed(2)} {pricing.currency}</span>
              </div>
              
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-muted-foreground">Remaining balance (pay at property)</span>
                <span className="font-medium">{pricing.symbol}{remainingBalance.toFixed(2)} {pricing.currency}</span>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Important:</strong> The {pricing.symbol}{pricing.amount.toFixed(2)} booking commitment fee is non-refundable.
              </p>
              <p>
                findastay does not process the remaining payment. The balance of {pricing.symbol}{remainingBalance.toFixed(2)} is payable directly to the property upon arrival or as arranged with them.
              </p>
            </div>

            {/* Pay Button */}
            <Button 
              onClick={handlePayBCF} 
              disabled={processing}
              className="w-full"
              size="lg"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {processing ? 'Processing...' : `Pay ${pricing.symbol}${pricing.amount.toFixed(2)} ${pricing.currency}`}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
