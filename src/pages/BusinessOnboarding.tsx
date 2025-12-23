import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Loader2, Building2, CheckCircle2, ChevronRight, ChevronLeft, Search } from 'lucide-react';
import { AddressAutocomplete, AddressData, normalizeCountryCode, SUPPORTED_COUNTRIES } from '@/components/AddressAutocomplete';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface Property {
  id: string;
  name: string;
  city: string;
  country: string;
  is_claimed: boolean;
  business_id: string | null;
}

export default function BusinessOnboarding() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Business details
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pay_at_property');
  const [addressData, setAddressData] = useState<AddressData>({
    addressLine1: '',
    city: '',
    region: '',
    postcode: '',
    country: '',
  });

  // Declarations
  const [authorised, setAuthorised] = useState(false);
  const [feeAcknowledged, setFeeAcknowledged] = useState(false);
  const [cancellationAccepted, setCancellationAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Modal states
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Step 2: Properties
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [propertySearch, setPropertySearch] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      localStorage.setItem('signup_intent', 'business');
      navigate('/auth');
      return;
    }

    if (user) {
      checkExistingBusiness();
    }
  }, [authLoading, user, navigate]);

  const checkExistingBusiness = async () => {
    if (!user) return;

    // Check if user already has a business
    const { data: existingBusiness } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingBusiness) {
      // Already has a business, redirect to dashboard
      navigate('/business/dashboard');
      return;
    }

    // Load available properties
    const { data: propertiesData } = await supabase
      .from('properties')
      .select('id, name, city, country, is_claimed, business_id')
      .eq('is_claimed', false)
      .order('name');

    setProperties(propertiesData || []);
    
    // Pre-fill email from user
    if (user.email) {
      setBusinessEmail(user.email);
      setBillingEmail(user.email);
    }

    setLoading(false);
  };

  const isStep1Valid = (): boolean => {
    return (
      businessName.trim() !== '' &&
      businessEmail.trim() !== '' &&
      billingEmail.trim() !== '' &&
      addressData.addressLine1.trim() !== '' &&
      authorised &&
      feeAcknowledged &&
      cancellationAccepted &&
      termsAccepted
    );
  };

  const handleNext = () => {
    if (step === 1 && isStep1Valid()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const togglePropertySelection = (propertyId: string) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const handleFinish = async () => {
    if (!user) return;

    setSubmitting(true);

    try {
      const normalizedCountry = normalizeCountryCode(addressData.country) || 'NZ';

      // Create business
      const { data: newBusiness, error: businessError } = await supabase
        .from('businesses')
        .insert({
          user_id: user.id,
          business_name: businessName,
          country: normalizedCountry,
          business_email: businessEmail,
          billing_email: billingEmail,
          business_phone: businessPhone || null,
          payment_collection_method: paymentMethod,
          physical_address: addressData.addressLine1 || 'Address pending',
          address_line1: addressData.addressLine1,
          city: addressData.city || null,
          region: addressData.region || null,
          postcode: addressData.postcode || null,
          lat: addressData.lat ?? null,
          lng: addressData.lng ?? null,
          contact_name: user.email || 'Business Contact',
          terms_accepted: termsAccepted,
          fee_acknowledged: feeAcknowledged,
          cancellation_policy_accepted: cancellationAccepted,
        })
        .select('id')
        .single();

      if (businessError) throw businessError;

      // Claim selected properties
      if (selectedPropertyIds.length > 0 && newBusiness) {
        const { error: claimError } = await supabase
          .from('properties')
          .update({
            business_id: newBusiness.id,
            is_claimed: true,
          })
          .in('id', selectedPropertyIds);

        if (claimError) {
          console.error('Error claiming properties:', claimError);
          // Don't throw - business was created, just properties failed
          toast({
            title: 'Business created',
            description: 'Some properties could not be claimed. You can try again from settings.',
          });
        }
      }

      toast({
        title: 'Welcome aboard!',
        description: 'Your business has been set up successfully.',
      });

      // Clear any signup intent
      localStorage.removeItem('signup_intent');

      navigate('/business/dashboard');
    } catch (error: any) {
      console.error('Error creating business:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create business. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProperties = properties.filter((p) =>
    p.name.toLowerCase().includes(propertySearch.toLowerCase()) ||
    p.city.toLowerCase().includes(propertySearch.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold text-foreground">Set up your business</h1>
          <p className="text-lg text-muted-foreground">
            Just a few details to get you started receiving offers.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`w-16 h-1 rounded ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        {/* Step 1: Business Details */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Business Details</CardTitle>
              <CardDescription>
                Enter your business information to get started.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Business Name */}
              <div className="space-y-2">
                <Label htmlFor="businessName">Business name *</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter your business name"
                />
              </div>

              {/* Business Phone */}
              <div className="space-y-2">
                <Label htmlFor="businessPhone">Phone (optional)</Label>
                <Input
                  id="businessPhone"
                  type="tel"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder="+64 21 123 4567"
                />
              </div>

              {/* Address Section */}
              <div className="pt-2 border-t border-border">
                <AddressAutocomplete
                  value={addressData}
                  onChange={setAddressData}
                  mapboxToken={MAPBOX_TOKEN}
                />
              </div>

              {/* Emails */}
              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border">
                <div className="space-y-2">
                  <Label htmlFor="businessEmail">Business email *</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    placeholder="contact@business.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingEmail">Billing email *</Label>
                  <Input
                    id="billingEmail"
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="billing@business.com"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Payment collection method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pay_at_property">Pay at Property</SelectItem>
                    <SelectItem value="pay_upfront">Pay Upfront</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Declarations */}
              <div className="space-y-4 pt-4 border-t border-border">
                <p className="text-sm font-medium text-foreground">Declarations</p>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="authorised"
                    checked={authorised}
                    onCheckedChange={(checked) => setAuthorised(checked === true)}
                  />
                  <Label htmlFor="authorised" className="cursor-pointer text-sm">
                    I confirm I am authorised to act for this business *
                  </Label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="feeAcknowledged"
                    checked={feeAcknowledged}
                    onCheckedChange={(checked) => setFeeAcknowledged(checked === true)}
                  />
                  <Label htmlFor="feeAcknowledged" className="cursor-pointer text-sm">
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

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="cancellationAccepted"
                    checked={cancellationAccepted}
                    onCheckedChange={(checked) => setCancellationAccepted(checked === true)}
                  />
                  <Label htmlFor="cancellationAccepted" className="cursor-pointer text-sm">
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

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="termsAccepted"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  />
                  <Label htmlFor="termsAccepted" className="cursor-pointer text-sm">
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

              {/* Next Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleNext}
                disabled={!isStep1Valid()}
              >
                Continue to Property Selection
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Property Selection */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Link Your Properties</CardTitle>
              <CardDescription>
                Select properties you manage. You can skip this and add properties later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  placeholder="Search properties by name or city..."
                  className="pl-10"
                />
              </div>

              {/* Properties list */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredProperties.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {propertySearch
                      ? 'No properties match your search.'
                      : 'No unclaimed properties available. You can add properties later from settings.'}
                  </p>
                ) : (
                  filteredProperties.map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      onClick={() => togglePropertySelection(property.id)}
                      className={`w-full p-4 rounded-lg border text-left transition-colors ${
                        selectedPropertyIds.includes(property.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{property.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {property.city}, {property.country}
                          </p>
                        </div>
                        {selectedPropertyIds.includes(property.id) && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {selectedPropertyIds.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedPropertyIds.length} propert{selectedPropertyIds.length === 1 ? 'y' : 'ies'} selected
                </p>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleFinish}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    'Finish Setup'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Policy Modals */}
      <Dialog open={activeModal === 'fee'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Fee Policy</DialogTitle>
            <DialogDescription>Our simple, transparent pricing model.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              A fee of <strong>$8.99 NZD</strong> (or <strong>$12.00 AUD</strong> for Australian
              properties) is charged per confirmed booking.
            </p>
            <p>
              Fees are billed monthly on the 20th and cover only bookings confirmed during that
              billing period.
            </p>
            <p>No setup fees, no monthly minimums, and no hidden charges.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === 'cancellation'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Non-Refundable Booking Policy</DialogTitle>
            <DialogDescription>Understanding our cancellation terms.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Bookings confirmed through findastay are <strong>non-refundable</strong> unless the
              property agrees otherwise.
            </p>
            <p>
              This policy helps protect both guests and properties by ensuring commitment from all
              parties.
            </p>
            <p>Properties may offer their own cancellation policies in addition to this baseline.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === 'terms'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terms & Conditions</DialogTitle>
            <DialogDescription>Key terms for using findastay.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              By registering your business, you agree to accurately represent your properties and
              respond to guest offers in a timely manner.
            </p>
            <p>
              You are responsible for ensuring all property information is current and accurate.
            </p>
            <p>
              findastay reserves the right to suspend accounts that violate these terms or engage in
              fraudulent activity.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
