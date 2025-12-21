import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Building2, CheckCircle2 } from 'lucide-react';

interface FormData {
  businessName: string;
  country: 'NZ' | 'AU';
  businessNumber: string;
  physicalAddress: string;
  contactName: string;
  contactRole: string;
  businessEmail: string;
  businessPhone: string;
  billingEmail: string;
}

export default function BusinessClaim() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const token = searchParams.get('token');
  const propertyId = searchParams.get('property_id');
  const offerId = searchParams.get('offer_id');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [property, setProperty] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    country: 'NZ',
    businessNumber: '',
    physicalAddress: '',
    contactName: '',
    contactRole: '',
    businessEmail: '',
    businessPhone: '',
    billingEmail: '',
  });

  // Checkbox states
  const [authorised, setAuthorised] = useState(false);
  const [feeAcknowledged, setFeeAcknowledged] = useState(false);
  const [cancellationAccepted, setCancellationAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Modal states
  const [activeModal, setActiveModal] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    if (propertyId) {
      loadProperty();
    } else {
      setLoading(false);
    }
  }, [authLoading, user, propertyId]);

  const loadProperty = async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('id, name')
      .eq('id', propertyId)
      .single();

    if (error) {
      console.error('Error loading property:', error);
      toast({
        title: 'Error',
        description: 'Could not load property details.',
        variant: 'destructive',
      });
    } else if (data) {
      setProperty(data);
      setFormData((prev) => ({ ...prev, businessName: data.name }));
    }
    setLoading(false);
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid = (): boolean => {
    return (
      formData.businessName.trim() !== '' &&
      formData.businessNumber.trim() !== '' &&
      formData.physicalAddress.trim() !== '' &&
      formData.contactName.trim() !== '' &&
      formData.businessEmail.trim() !== '' &&
      formData.billingEmail.trim() !== '' &&
      authorised &&
      feeAcknowledged &&
      cancellationAccepted &&
      termsAccepted
    );
  };

  const handleSubmit = async () => {
    if (!user || !isFormValid()) return;

    setSubmitting(true);

    try {
      // Check if user already has a business
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .single();

      let businessId: string;

      if (existingBusiness) {
        // Update existing business
        const { error: updateError } = await supabase
          .from('businesses')
          .update({
            business_name: formData.businessName,
            country: formData.country,
            business_number: formData.businessNumber,
            physical_address: formData.physicalAddress,
            contact_name: formData.contactName,
            contact_role: formData.contactRole || null,
            business_email: formData.businessEmail,
            business_phone: formData.businessPhone || null,
            billing_email: formData.billingEmail,
            terms_accepted: termsAccepted,
            fee_acknowledged: feeAcknowledged,
            cancellation_policy_accepted: cancellationAccepted,
          })
          .eq('id', existingBusiness.id);

        if (updateError) throw updateError;
        businessId = existingBusiness.id;
      } else {
        // Create new business
        const { data: newBusiness, error: insertError } = await supabase
          .from('businesses')
          .insert({
            user_id: user.id,
            business_name: formData.businessName,
            country: formData.country,
            business_number: formData.businessNumber,
            physical_address: formData.physicalAddress,
            contact_name: formData.contactName,
            contact_role: formData.contactRole || null,
            business_email: formData.businessEmail,
            business_phone: formData.businessPhone || null,
            billing_email: formData.billingEmail,
            terms_accepted: termsAccepted,
            fee_acknowledged: feeAcknowledged,
            cancellation_policy_accepted: cancellationAccepted,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        businessId = newBusiness.id;
      }

      // Update property to claim it
      if (propertyId) {
        const { error: propertyError } = await supabase
          .from('properties')
          .update({
            business_id: businessId,
            is_claimed: true,
          })
          .eq('id', propertyId);

        if (propertyError) throw propertyError;
      }

      toast({
        title: 'Business claimed',
        description: 'Your business has been registered successfully.',
      });

      // Redirect to offer response page
      if (offerId && token) {
        navigate(`/business/offers/${offerId}?token=${token}`);
      } else if (offerId) {
        navigate(`/business/offers/${offerId}`);
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error claiming business:', error);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Save thousands in commission — just $8.99 per confirmed booking.
          </h1>
          <p className="text-lg text-muted-foreground">
            Claim your business to respond to offers and reduce platform commissions.
          </p>
        </div>

        {property && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Claiming: {property.name}</p>
                  <p className="text-sm text-muted-foreground">
                    You'll be able to respond to offers for this property.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
            <CardDescription>
              Enter your business information to claim this property.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name *</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => handleInputChange('businessName', e.target.value)}
                placeholder="Enter your business name"
              />
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label>Country *</Label>
              <Select
                value={formData.country}
                onValueChange={(v) => handleInputChange('country', v as 'NZ' | 'AU')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NZ">New Zealand</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Business Number */}
            <div className="space-y-2">
              <Label htmlFor="businessNumber">
                {formData.country === 'NZ' ? 'NZBN' : 'ABN'} *
              </Label>
              <Input
                id="businessNumber"
                value={formData.businessNumber}
                onChange={(e) => handleInputChange('businessNumber', e.target.value)}
                placeholder={formData.country === 'NZ' ? 'Enter your NZBN' : 'Enter your ABN'}
              />
            </div>

            {/* Physical Address */}
            <div className="space-y-2">
              <Label htmlFor="physicalAddress">Physical address *</Label>
              <Textarea
                id="physicalAddress"
                value={formData.physicalAddress}
                onChange={(e) => handleInputChange('physicalAddress', e.target.value)}
                placeholder="Enter your business address"
                rows={2}
              />
            </div>

            {/* Contact Name */}
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact name *</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => handleInputChange('contactName', e.target.value)}
                placeholder="Full name of primary contact"
              />
            </div>

            {/* Contact Role */}
            <div className="space-y-2">
              <Label htmlFor="contactRole">Role (optional)</Label>
              <Input
                id="contactRole"
                value={formData.contactRole}
                onChange={(e) => handleInputChange('contactRole', e.target.value)}
                placeholder="e.g. Owner, Manager"
              />
            </div>

            {/* Business Email */}
            <div className="space-y-2">
              <Label htmlFor="businessEmail">Business email *</Label>
              <Input
                id="businessEmail"
                type="email"
                value={formData.businessEmail}
                onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                placeholder="contact@yourbusiness.com"
              />
            </div>

            {/* Business Phone */}
            <div className="space-y-2">
              <Label htmlFor="businessPhone">Phone (optional)</Label>
              <Input
                id="businessPhone"
                type="tel"
                value={formData.businessPhone}
                onChange={(e) => handleInputChange('businessPhone', e.target.value)}
                placeholder="+64 21 123 4567"
              />
            </div>

            {/* Billing Email */}
            <div className="space-y-2">
              <Label htmlFor="billingEmail">Billing email *</Label>
              <Input
                id="billingEmail"
                type="email"
                value={formData.billingEmail}
                onChange={(e) => handleInputChange('billingEmail', e.target.value)}
                placeholder="accounts@yourbusiness.com"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="authorised"
                  checked={authorised}
                  onCheckedChange={(checked) => setAuthorised(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="authorised" className="cursor-pointer">
                    I confirm I am authorised to act for this business *
                  </Label>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="feeAcknowledged"
                  checked={feeAcknowledged}
                  onCheckedChange={(checked) => setFeeAcknowledged(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="feeAcknowledged" className="cursor-pointer">
                    I agree to{' '}
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2"
                      onClick={() => setActiveModal('fee')}
                    >
                      $8.99 per confirmed booking billed monthly on the 20th
                    </button>{' '}
                    *
                  </Label>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="cancellationAccepted"
                  checked={cancellationAccepted}
                  onCheckedChange={(checked) => setCancellationAccepted(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="cancellationAccepted" className="cursor-pointer">
                    I accept the{' '}
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2"
                      onClick={() => setActiveModal('cancellation')}
                    >
                      non-refundable booking policy
                    </button>{' '}
                    *
                  </Label>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="termsAccepted"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="termsAccepted" className="cursor-pointer">
                    I accept the{' '}
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2"
                      onClick={() => setActiveModal('terms')}
                    >
                      Terms & Conditions
                    </button>{' '}
                    *
                  </Label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={!isFormValid() || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming business…
                </>
              ) : (
                'Claim business'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Policy Modals */}
      <Dialog open={activeModal === 'fee'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Fee Policy</DialogTitle>
            <DialogDescription>
              Our simple, transparent pricing model.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              A fee of <strong>$8.99 NZD</strong> (or <strong>$12.00 AUD</strong> for Australian properties) 
              is charged per confirmed booking.
            </p>
            <p>
              Fees are calculated monthly and invoiced on the 20th of each month for all confirmed 
              bookings in the previous billing period.
            </p>
            <p>
              Payment is due within 14 days of invoice date. We accept bank transfer and major credit cards.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === 'cancellation'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Non-Refundable Booking Policy</DialogTitle>
            <DialogDescription>
              Understanding the booking commitment fee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              When a guest's offer is accepted, they pay a non-refundable booking commitment fee 
              to confirm their reservation.
            </p>
            <p>
              This fee is deducted from the total amount the guest pays at your property. 
              It protects you from no-shows and ensures guest commitment.
            </p>
            <p>
              As the booking commitment fee is non-refundable, guests are incentivised to honour 
              their reservations.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === 'terms'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terms & Conditions</DialogTitle>
            <DialogDescription>
              Please review our terms of service.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              By claiming your business and using this platform, you agree to:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Provide accurate business information</li>
              <li>Respond to offers in a timely manner</li>
              <li>Honour accepted bookings at the agreed rate</li>
              <li>Maintain appropriate insurance and licenses</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>
            <p>
              Full terms and conditions are available on our website. 
              We reserve the right to suspend accounts that violate these terms.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
