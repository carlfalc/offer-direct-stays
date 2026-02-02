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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Building2, CheckCircle2, ChevronRight, ChevronLeft, Search, Sparkles, Mail, MapPin, FileText, Shield } from 'lucide-react';
import { AddressAutocomplete, AddressData, normalizeCountryCode } from '@/components/AddressAutocomplete';
import { PremiumProgressIndicator } from '@/components/onboarding/PremiumProgressIndicator';
import { OnboardingSummaryPanel } from '@/components/onboarding/OnboardingSummaryPanel';
import { PaymentMethodCard } from '@/components/onboarding/PaymentMethodCard';
import { SectionCard } from '@/components/onboarding/SectionCard';

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
  const [taxIdentifier, setTaxIdentifier] = useState('');
  const [nzbn, setNzbn] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'guest_admin_fee' | 'business_invoice'>('guest_admin_fee');
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
  const [paymentMethodConfirmed, setPaymentMethodConfirmed] = useState(false);
  const [feeTimingUnderstood, setFeeTimingUnderstood] = useState(false);
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

    const { data: existingBusiness } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingBusiness) {
      navigate('/business/dashboard');
      return;
    }

    const { data: propertiesData } = await supabase
      .from('properties')
      .select('id, name, city, country, is_claimed, business_id')
      .eq('is_claimed', false)
      .order('name');

    setProperties(propertiesData || []);
    
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
      paymentMethodConfirmed &&
      feeTimingUnderstood &&
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
          cancellation_policy_accepted: true,
          tax_identifier: taxIdentifier || null,
          nzbn: nzbn || null,
        })
        .select('id')
        .single();

      if (businessError) throw businessError;

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

  const countryCode = normalizeCountryCode(addressData.country) || 'NZ';
  const locationDisplay = [addressData.city, addressData.region, countryCode].filter(Boolean).join(', ');

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Setting up your experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      {/* Hero Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-glow-gold">
                <Building2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Business Setup</h1>
                <p className="text-xs text-muted-foreground">Step {step} of 2</p>
              </div>
            </div>
            <div className="hidden sm:block">
              <PremiumProgressIndicator currentStep={step} totalSteps={2} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Mobile Progress */}
        <div className="sm:hidden mb-8">
          <PremiumProgressIndicator currentStep={step} totalSteps={2} />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Step Header */}
            <div className="text-center lg:text-left space-y-2 mb-8">
              <h2 className="text-2xl lg:text-3xl font-bold text-foreground">
                {step === 1 ? 'Tell us about your business' : 'Link your properties'}
              </h2>
              <p className="text-muted-foreground max-w-xl">
                {step === 1
                  ? 'A few details and you\'ll be ready to receive offers from travelers.'
                  : 'Select properties you manage. You can always add more later.'}
              </p>
            </div>

            {/* Step 1: Business Details */}
            {step === 1 && (
              <div className="space-y-6">
                {/* Business Identity */}
                <SectionCard
                  title="Business Identity"
                  description="How guests will see your business"
                  icon={Building2}
                  tooltip="Your business name will appear on offers and communications with guests."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="businessName" className="text-sm font-medium">
                        Business Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="businessName"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Oceanview Lodge"
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="businessPhone" className="text-sm font-medium">
                        Phone <span className="text-muted-foreground text-xs">(optional)</span>
                      </Label>
                      <Input
                        id="businessPhone"
                        type="tel"
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                        placeholder="+64 21 123 4567"
                        className="h-11"
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* Location */}
                <SectionCard
                  title="Location"
                  description="Where your business is based"
                  icon={MapPin}
                  tooltip="We use this to determine your region and applicable fees."
                >
                  <AddressAutocomplete
                    value={addressData}
                    onChange={setAddressData}
                    mapboxToken={MAPBOX_TOKEN}
                  />
                </SectionCard>

                {/* Contact Details */}
                <SectionCard
                  title="Contact Details"
                  description="How we'll reach you about offers"
                  icon={Mail}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="businessEmail" className="text-sm font-medium">
                        Business Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="businessEmail"
                        type="email"
                        value={businessEmail}
                        onChange={(e) => setBusinessEmail(e.target.value)}
                        placeholder="contact@business.com"
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="billingEmail" className="text-sm font-medium">
                        Billing Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="billingEmail"
                        type="email"
                        value={billingEmail}
                        onChange={(e) => setBillingEmail(e.target.value)}
                        placeholder="billing@business.com"
                        className="h-11"
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* Tax Details */}
                <SectionCard
                  title="Tax Registration"
                  description="Optional, for tax-compliant invoices"
                  icon={FileText}
                  tooltip="Only required if you're registered for GST/ABN. Leave blank if not applicable."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="taxIdentifier" className="text-sm font-medium">
                        {countryCode === 'AU' ? 'ABN' : 'GST Number'}
                        <span className="text-muted-foreground text-xs ml-1">(optional)</span>
                      </Label>
                      <Input
                        id="taxIdentifier"
                        value={taxIdentifier}
                        onChange={(e) => setTaxIdentifier(e.target.value)}
                        placeholder={countryCode === 'AU' ? 'e.g. 12 345 678 901' : 'e.g. 123-456-789'}
                        className="h-11"
                      />
                    </div>

                    {countryCode !== 'AU' && (
                      <div className="space-y-2">
                        <Label htmlFor="nzbn" className="text-sm font-medium">
                          NZBN <span className="text-muted-foreground text-xs">(optional)</span>
                        </Label>
                        <Input
                          id="nzbn"
                          value={nzbn}
                          onChange={(e) => setNzbn(e.target.value)}
                          placeholder="e.g. 9429012345678"
                          className="h-11"
                        />
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Payment Method */}
                <SectionCard
                  title="Fee Collection Method"
                  description="Choose how booking admin fees are handled"
                  icon={Shield}
                  tooltip="This determines when and how the small booking fee is collected."
                >
                  <div className="grid gap-4 lg:grid-cols-2">
                    <PaymentMethodCard
                      type="guest_admin_fee"
                      selected={paymentMethod === 'guest_admin_fee'}
                      onClick={() => setPaymentMethod('guest_admin_fee')}
                      countryCode={countryCode}
                    />
                    <PaymentMethodCard
                      type="business_invoice"
                      selected={paymentMethod === 'business_invoice'}
                      onClick={() => setPaymentMethod('business_invoice')}
                      countryCode={countryCode}
                    />
                  </div>
                </SectionCard>

                {/* Declarations */}
                <SectionCard
                  title="Declarations"
                  description="Please confirm the following"
                  icon={CheckCircle2}
                >
                  <div className="space-y-4">
                    <DeclarationCheckbox
                      id="authorised"
                      checked={authorised}
                      onChange={setAuthorised}
                      label="I am authorised to act on behalf of this business"
                      required
                    />

                    <DeclarationCheckbox
                      id="feeAcknowledged"
                      checked={feeAcknowledged}
                      onChange={setFeeAcknowledged}
                      required
                    >
                      I understand{' '}
                      <button
                        type="button"
                        className="text-primary underline underline-offset-2 hover:text-primary/80"
                        onClick={() => setActiveModal('fee')}
                      >
                        how the booking admin fee works
                      </button>
                    </DeclarationCheckbox>

                    <DeclarationCheckbox
                      id="paymentMethodConfirmed"
                      checked={paymentMethodConfirmed}
                      onChange={setPaymentMethodConfirmed}
                      required
                    >
                      I confirm my selected fee method:{' '}
                      <strong className="text-foreground">
                        {paymentMethod === 'guest_admin_fee' ? 'Pay at Property' : 'Guest Pays Now'}
                      </strong>
                    </DeclarationCheckbox>

                    <DeclarationCheckbox
                      id="feeTimingUnderstood"
                      checked={feeTimingUnderstood}
                      onChange={setFeeTimingUnderstood}
                      label="I understand when and how booking fees are charged"
                      required
                    />

                    <DeclarationCheckbox
                      id="termsAccepted"
                      checked={termsAccepted}
                      onChange={setTermsAccepted}
                      required
                    >
                      I accept the{' '}
                      <button
                        type="button"
                        className="text-primary underline underline-offset-2 hover:text-primary/80"
                        onClick={() => setActiveModal('terms')}
                      >
                        Terms & Conditions
                      </button>
                    </DeclarationCheckbox>
                  </div>
                </SectionCard>

                {/* Next Button */}
                <Button
                  className="w-full h-12 text-base"
                  variant="premium"
                  onClick={handleNext}
                  disabled={!isStep1Valid()}
                >
                  Continue to Property Selection
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Step 2: Property Selection */}
            {step === 2 && (
              <div className="space-y-6">
                <SectionCard
                  title="Available Properties"
                  description="Select properties you'd like to manage"
                  icon={Building2}
                >
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={propertySearch}
                      onChange={(e) => setPropertySearch(e.target.value)}
                      placeholder="Search by name or city..."
                      className="pl-10 h-11"
                    />
                  </div>

                  {/* Properties list */}
                  <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-2">
                    {filteredProperties.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">
                          {propertySearch ? 'No properties match your search' : 'No unclaimed properties available'}
                        </p>
                        <p className="text-sm mt-1">You can add properties later from settings</p>
                      </div>
                    ) : (
                      filteredProperties.map((property) => {
                        const isSelected = selectedPropertyIds.includes(property.id);
                        return (
                          <button
                            key={property.id}
                            type="button"
                            onClick={() => togglePropertySelection(property.id)}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                              isSelected
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border/50 hover:border-primary/30 hover:bg-card'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-foreground">{property.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {property.city}, {property.country}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                  <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {selectedPropertyIds.length > 0 && (
                    <p className="text-sm text-primary font-medium">
                      {selectedPropertyIds.length} propert{selectedPropertyIds.length === 1 ? 'y' : 'ies'} selected
                    </p>
                  )}
                </SectionCard>

                {/* Navigation buttons */}
                <div className="flex gap-4">
                  <Button variant="outline" onClick={handleBack} className="flex-1 h-12">
                    <ChevronLeft className="mr-2 h-5 w-5" />
                    Back
                  </Button>
                  <Button
                    className="flex-1 h-12 text-base"
                    variant="premium"
                    onClick={handleFinish}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Complete Setup
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Summary (Desktop) */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-24">
              <OnboardingSummaryPanel
                businessName={businessName}
                location={locationDisplay}
                businessEmail={businessEmail}
                billingEmail={billingEmail}
                paymentMethod={paymentMethod}
                countryCode={countryCode}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Booking Fee Policy Modal */}
      <Dialog open={activeModal === 'fee'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Booking Fee Policy</DialogTitle>
            <DialogDescription>Simple, transparent pricing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              A small booking administration fee is charged for each confirmed booking:
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                <p className="text-2xl font-bold text-primary">NZ$8.99</p>
                <p className="text-xs text-muted-foreground mt-1">New Zealand</p>
              </div>
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 text-center">
                <p className="text-2xl font-bold text-accent">A$12.00</p>
                <p className="text-xs text-muted-foreground mt-1">Australia</p>
              </div>
            </div>
            
            <p>
              No setup fees, no monthly minimums, no hidden charges. The fee is non-refundable once a booking is confirmed.
            </p>
          </div>
          
          <div className="pt-4">
            <Button 
              className="w-full" 
              variant="premium"
              onClick={() => {
                setFeeAcknowledged(true);
                setFeeTimingUnderstood(true);
                setActiveModal(null);
              }}
            >
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === 'terms'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Terms & Conditions</DialogTitle>
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

// Declaration Checkbox Component
interface DeclarationCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  required?: boolean;
  children?: React.ReactNode;
}

function DeclarationCheckbox({
  id,
  checked,
  onChange,
  label,
  required,
  children,
}: DeclarationCheckboxProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="cursor-pointer text-sm text-muted-foreground leading-relaxed">
        {children || label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
    </div>
  );
}
