import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Users, Calendar, Bed, FileText, DollarSign, CheckCircle2, XCircle, ArrowRight, Copy } from 'lucide-react';

interface OfferDetails {
  id: string;
  status: string;
  offer_amount: number;
  counter_amount: number | null;
  adults: number;
  children: number;
  check_in_date: string;
  check_out_date: string;
  guest_notes: string | null;
  response_token: string | null;
  response_token_expires_at: string | null;
  property: {
    id: string;
    name: string;
    country: string;
  };
  room: {
    id: string;
    name: string;
  } | null;
  guest_profile: {
    first_name: string | null;
  } | null;
}

export default function BusinessOfferResponse() {
  const { offerId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Counter offer state
  const [showCounterDialog, setShowCounterDialog] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');

  // Success state
  const [actionCompleted, setActionCompleted] = useState<'accepted' | 'countered' | 'declined' | null>(null);

  useEffect(() => {
    loadOffer();
  }, [offerId, token, user]);

  const loadOffer = async () => {
    if (!offerId) {
      setError('No offer ID provided');
      setLoading(false);
      return;
    }

    // Build query
    let query = supabase
      .from('offers')
      .select(`
        id,
        status,
        offer_amount,
        counter_amount,
        adults,
        children,
        check_in_date,
        check_out_date,
        guest_notes,
        response_token,
        response_token_expires_at,
        guest_user_id,
        property:properties!inner(id, name, country),
        room:rooms(id, name)
      `)
      .eq('id', offerId)
      .single();

    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error loading offer:', fetchError);
      setError('Could not load offer details. Please check the link.');
      setLoading(false);
      return;
    }

    if (!data) {
      setError('Offer not found');
      setLoading(false);
      return;
    }

    // Validate token access
    if (token) {
      if (data.response_token !== token) {
        setError('Invalid access token');
        setLoading(false);
        return;
      }
      
      if (data.response_token_expires_at && new Date(data.response_token_expires_at) < new Date()) {
        setError('This link has expired');
        setLoading(false);
        return;
      }
    } else if (!user) {
      // No token and not logged in
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    // Fetch guest profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('user_id', data.guest_user_id)
      .single();

    setOffer({
      ...data,
      property: data.property as OfferDetails['property'],
      room: data.room as OfferDetails['room'],
      guest_profile: profileData,
    });
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!offer) return;
    setSubmitting(true);

    const { error: updateError } = await supabase
      .from('offers')
      .update({ status: 'accepted' })
      .eq('id', offer.id);

    setSubmitting(false);

    if (updateError) {
      console.error('Error accepting offer:', updateError);
      toast({
        title: 'Error',
        description: 'Could not accept offer. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setActionCompleted('accepted');
    setOffer((prev) => prev ? { ...prev, status: 'accepted' } : null);
    toast({
      title: 'Offer accepted',
      description: 'The guest will be notified to pay their booking commitment fee.',
    });
  };

  const handleCounter = async () => {
    if (!offer) return;

    const amount = parseFloat(counterAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid counter offer amount.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase
      .from('offers')
      .update({
        status: 'countered',
        counter_amount: amount,
      })
      .eq('id', offer.id);

    setSubmitting(false);

    if (updateError) {
      console.error('Error countering offer:', updateError);
      toast({
        title: 'Error',
        description: 'Could not submit counter offer. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setShowCounterDialog(false);
    setActionCompleted('countered');
    setOffer((prev) => prev ? { ...prev, status: 'countered', counter_amount: amount } : null);
    toast({
      title: 'Counter offer sent',
      description: `Your counter offer of $${amount.toFixed(2)} has been sent to the guest.`,
    });
  };

  const handleDecline = async () => {
    if (!offer) return;
    setSubmitting(true);

    const { error: updateError } = await supabase
      .from('offers')
      .update({ status: 'declined' })
      .eq('id', offer.id);

    setSubmitting(false);

    if (updateError) {
      console.error('Error declining offer:', updateError);
      toast({
        title: 'Error',
        description: 'Could not decline offer. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setActionCompleted('declined');
    setOffer((prev) => prev ? { ...prev, status: 'declined' } : null);
    toast({
      title: 'Offer declined',
      description: 'The guest will be notified.',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="secondary">Offer sent</Badge>;
      case 'accepted':
        return <Badge className="bg-success text-success-foreground">Accepted</Badge>;
      case 'countered':
        return <Badge variant="outline" className="border-warning text-warning">Countered</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      case 'confirmed':
        return <Badge className="bg-success text-success-foreground">Confirmed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const currency = offer?.property?.country === 'AU' ? 'AUD' : 'NZD';
  const paymentLink = offer ? `${window.location.origin}/offer-payment?offer_id=${offer.id}` : '';

  const copyPaymentLink = () => {
    navigator.clipboard.writeText(paymentLink);
    toast({
      title: 'Copied',
      description: 'Payment link copied to clipboard.',
    });
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Error</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!offer) return null;

  const canRespond = offer.status === 'submitted';

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Offer Details</h1>
          <p className="text-muted-foreground">
            {offer.property.name}
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Status</CardTitle>
              {getStatusBadge(offer.status)}
            </div>
          </CardHeader>
        </Card>

        {/* Offer Details */}
        <Card>
          <CardHeader>
            <CardTitle>Guest Offer</CardTitle>
            <CardDescription>
              From {offer.guest_profile?.first_name || 'Guest'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Guests */}
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  {offer.adults} adult{offer.adults !== 1 ? 's' : ''}
                  {offer.children > 0 && `, ${offer.children} child${offer.children !== 1 ? 'ren' : ''}`}
                </p>
              </div>
            </div>

            {/* Dates */}
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  {new Date(offer.check_in_date).toLocaleDateString('en-NZ', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  {' → '}
                  {new Date(offer.check_out_date).toLocaleDateString('en-NZ', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
            </div>

            {/* Room */}
            {offer.room && (
              <div className="flex items-center gap-3">
                <Bed className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">{offer.room.name}</p>
                </div>
              </div>
            )}

            {/* Requirements */}
            {offer.guest_notes && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Requirements</p>
                  <p className="font-medium text-foreground">{offer.guest_notes}</p>
                </div>
              </div>
            )}

            {/* Offer Amount */}
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Offer per night</p>
                <p className="text-xl font-bold text-foreground">
                  {currency} ${offer.offer_amount.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Counter Amount (if countered) */}
            {offer.counter_amount && (
              <div className="flex items-center gap-3">
                <ArrowRight className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Your counter offer</p>
                  <p className="text-xl font-bold text-warning">
                    {currency} ${offer.counter_amount.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {canRespond && (
          <Card>
            <CardHeader>
              <CardTitle>Respond to Offer</CardTitle>
              <CardDescription>
                Choose how you'd like to respond to this offer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={handleAccept}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Accept offer
              </Button>
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => setShowCounterDialog(true)}
                disabled={submitting}
              >
                Counter with different price
              </Button>
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                size="lg"
                onClick={handleDecline}
                disabled={submitting}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Decline offer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Next Steps Panel (after accept) */}
        {actionCompleted === 'accepted' && (
          <Card className="border-success/30 bg-success/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <CardTitle className="text-success">Offer Accepted</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground">
                <strong>Next:</strong> the guest must pay the booking commitment fee to confirm.
              </p>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Guest payment link</Label>
                <div className="flex gap-2">
                  <Input
                    value={paymentLink}
                    readOnly
                    className="bg-muted font-mono text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={copyPaymentLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with the guest, or they will receive it via email.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmation for counter/decline */}
        {(actionCompleted === 'countered' || actionCompleted === 'declined') && (
          <Card className="border-border">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {actionCompleted === 'countered' ? 'Counter Offer Sent' : 'Offer Declined'}
              </h3>
              <p className="text-muted-foreground">
                {actionCompleted === 'countered'
                  ? 'The guest will be notified of your counter offer.'
                  : 'The guest has been notified.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Counter Offer Dialog */}
      <Dialog open={showCounterDialog} onOpenChange={setShowCounterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make a Counter Offer</DialogTitle>
            <DialogDescription>
              Enter your proposed nightly rate. The guest offered {currency} ${offer.offer_amount.toFixed(2)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="counterAmount">Your counter offer per night</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  {currency}
                </span>
                <Input
                  id="counterAmount"
                  type="number"
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  className="pl-12"
                  placeholder="e.g. 250"
                  min={1}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCounterDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCounter} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send counter offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
