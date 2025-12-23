import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Building2, Settings, Link2, Check, AlertTriangle } from 'lucide-react';
import { AddressAutocomplete, AddressData, normalizeCountryCode, SUPPORTED_COUNTRIES } from '@/components/AddressAutocomplete';

// Mapbox public token - can be stored in code as it's publishable
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface BusinessProfile {
  id: string;
  business_name: string;
  country: string;
  business_email: string;
  billing_email: string;
  business_phone: string | null;
  payment_collection_method: string;
  address_line1?: string | null;
  city?: string | null;
  region?: string | null;
  postcode?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface Property {
  id: string;
  name: string;
  city: string;
  country: string;
  is_claimed: boolean;
  business_id: string | null;
}

export default function BusinessSettings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [claimingPropertyId, setClaimingPropertyId] = useState<string | null>(null);

  // Form state for creating/editing business
  const [formData, setFormData] = useState({
    businessName: '',
    country: 'NZ',
    businessEmail: '',
    billingEmail: '',
    businessPhone: '',
    paymentMethod: 'pay_at_property',
  });

  // Address state
  const [addressData, setAddressData] = useState<AddressData>({
    addressLine1: '',
    city: '',
    region: '',
    postcode: '',
    country: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/business/settings');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkAdminAndLoadData();
    }
  }, [user]);

  const checkAdminAndLoadData = async () => {
    if (!user) return;

    try {
      // Check if user has admin or moderator role
      const { data: roleData } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'business' });
      
      // For testing mode, we allow any authenticated user but could restrict to admin/moderator
      // For now, we'll allow business role or check for a dev flag
      // In production, you'd check for 'admin' or 'moderator' role
      setIsAdmin(true); // For testing purposes, allow all authenticated users

      // Load existing business profile
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, business_name, country, business_email, billing_email, business_phone, payment_collection_method, address_line1, city, region, postcode, lat, lng')
        .eq('user_id', user.id)
        .maybeSingle();

      if (businessError) {
        console.error('Error loading business:', businessError);
      } else if (businessData) {
        setBusiness(businessData);
        // Normalize country to NZ/AU
        const normalizedCountry = normalizeCountryCode(businessData.country) || 'NZ';
        setFormData({
          businessName: businessData.business_name,
          country: normalizedCountry,
          businessEmail: businessData.business_email,
          billingEmail: businessData.billing_email,
          businessPhone: businessData.business_phone || '',
          paymentMethod: businessData.payment_collection_method,
        });
        // Load saved address data with normalized country
        setAddressData({
          addressLine1: businessData.address_line1 || '',
          city: businessData.city || '',
          region: businessData.region || '',
          postcode: businessData.postcode || '',
          country: normalizedCountry,
          lat: businessData.lat ?? undefined,
          lng: businessData.lng ?? undefined,
        });
      }

      // Load all properties for claiming
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('id, name, city, country, is_claimed, business_id')
        .order('name');

      if (propertiesError) {
        console.error('Error loading properties:', propertiesError);
      } else {
        setProperties(propertiesData || []);
      }
    } catch (err) {
      console.error('Error in checkAdminAndLoadData:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveBusiness = async () => {
    if (!user) return;

    const { businessName, businessEmail, billingEmail, paymentMethod } = formData;
    
    // Validate required fields including address
    if (!businessName.trim() || !businessEmail.trim() || !billingEmail.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (!addressData.addressLine1.trim()) {
      toast({
        title: 'Address required',
        description: 'Please enter your business address.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      // Normalize and validate country - must be NZ or AU
      const normalizedCountry = normalizeCountryCode(addressData.country || formData.country);
      if (!normalizedCountry) {
        toast({
          title: 'Invalid country',
          description: 'Please select New Zealand or Australia as your country.',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }

      if (business) {
        // Update existing business
        const { error } = await supabase
          .from('businesses')
          .update({
            business_name: businessName,
            country: normalizedCountry,
            business_email: businessEmail,
            billing_email: billingEmail,
            business_phone: formData.businessPhone || null,
            payment_collection_method: paymentMethod,
            address_line1: addressData.addressLine1,
            city: addressData.city || null,
            region: addressData.region || null,
            postcode: addressData.postcode || null,
            physical_address: addressData.addressLine1, // Keep legacy field in sync
            lat: addressData.lat ?? null,
            lng: addressData.lng ?? null,
          })
          .eq('id', business.id);

        if (error) throw error;


        setBusiness((prev) => prev ? {
          ...prev,
          business_name: businessName,
          country: normalizedCountry,
          business_email: businessEmail,
          billing_email: billingEmail,
          business_phone: formData.businessPhone || null,
          payment_collection_method: paymentMethod,
          address_line1: addressData.addressLine1,
          city: addressData.city,
          region: addressData.region,
          postcode: addressData.postcode,
          lat: addressData.lat,
          lng: addressData.lng,
        } : null);

        toast({
          title: 'Business updated',
          description: 'Your business profile has been updated.',
        });
      } else {
        // Create new business
        const { data, error } = await supabase
          .from('businesses')
          .insert({
            user_id: user.id,
            business_name: businessName,
            country: normalizedCountry,
            business_email: businessEmail,
            billing_email: billingEmail,
            business_phone: formData.businessPhone || null,
            payment_collection_method: paymentMethod,
            physical_address: addressData.addressLine1 || 'Address pending',
            address_line1: addressData.addressLine1,
            city: addressData.city || null,
            region: addressData.region || null,
            postcode: addressData.postcode || null,
            lat: addressData.lat ?? null,
            lng: addressData.lng ?? null,
            contact_name: user.email || 'Business Contact',
            terms_accepted: true,
            fee_acknowledged: true,
            cancellation_policy_accepted: true,
          })
          .select('id, business_name, country, business_email, billing_email, business_phone, payment_collection_method, address_line1, city, region, postcode, lat, lng')
          .single();

        if (error) throw error;

        setBusiness(data);
        toast({
          title: 'Business created',
          description: 'Your business profile has been created.',
        });
      }
    } catch (err: any) {
      console.error('Error saving business:', err);
      console.error('Error details:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      });
      toast({
        title: 'Error',
        description: err?.message || 'Failed to save business profile.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClaimProperty = async (propertyId: string) => {
    if (!business) {
      toast({
        title: 'Create business first',
        description: 'Please create a business profile before claiming properties.',
        variant: 'destructive',
      });
      return;
    }

    setClaimingPropertyId(propertyId);

    try {
      const { error } = await supabase
        .from('properties')
        .update({
          business_id: business.id,
          is_claimed: true,
        })
        .eq('id', propertyId);

      if (error) throw error;

      // Update local state
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId
            ? { ...p, business_id: business.id, is_claimed: true }
            : p
        )
      );

      toast({
        title: 'Property claimed',
        description: 'The property has been linked to your business.',
      });
    } catch (err) {
      console.error('Error claiming property:', err);
      toast({
        title: 'Error',
        description: 'Failed to claim property.',
        variant: 'destructive',
      });
    } finally {
      setClaimingPropertyId(null);
    }
  };

  const handleUnclaimProperty = async (propertyId: string) => {
    setClaimingPropertyId(propertyId);

    try {
      const { error } = await supabase
        .from('properties')
        .update({
          business_id: null,
          is_claimed: false,
        })
        .eq('id', propertyId);

      if (error) throw error;

      // Update local state
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId
            ? { ...p, business_id: null, is_claimed: false }
            : p
        )
      );

      toast({
        title: 'Property unclaimed',
        description: 'The property has been unlinked from your business.',
      });
    } catch (err) {
      console.error('Error unclaiming property:', err);
      toast({
        title: 'Error',
        description: 'Failed to unclaim property.',
        variant: 'destructive',
      });
    } finally {
      setClaimingPropertyId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const myProperties = properties.filter((p) => p.business_id === business?.id);
  const availableProperties = properties.filter((p) => !p.is_claimed);

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Business Settings</h1>
            <p className="text-muted-foreground">Testing Mode — Manage your business and claim properties</p>
          </div>
          <Badge variant="outline" className="ml-auto border-warning text-warning">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Dev Mode
          </Badge>
        </div>

        {/* Business Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Profile
            </CardTitle>
            <CardDescription>
              {business ? 'Update your business details' : 'Create a business profile to start receiving offers'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  placeholder="Enter business name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessPhone">Phone</Label>
                <Input
                  id="businessPhone"
                  type="tel"
                  value={formData.businessPhone}
                  onChange={(e) => handleInputChange('businessPhone', e.target.value)}
                  placeholder="+64 21 123 4567"
                />
              </div>
            </div>

            {/* Address Section */}
            <div className="pt-2 border-t border-border">
              <AddressAutocomplete
                value={addressData}
                onChange={setAddressData}
                mapboxToken={MAPBOX_TOKEN}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border">

              <div className="space-y-2">
                <Label htmlFor="businessEmail">Business Email *</Label>
                <Input
                  id="businessEmail"
                  type="email"
                  value={formData.businessEmail}
                  onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                  placeholder="contact@business.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingEmail">Billing Email *</Label>
                <Input
                  id="billingEmail"
                  type="email"
                  value={formData.billingEmail}
                  onChange={(e) => handleInputChange('billingEmail', e.target.value)}
                  placeholder="billing@business.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Collection Method *</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(v) => handleInputChange('paymentMethod', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pay_at_property">Pay at Property</SelectItem>
                    <SelectItem value="pay_upfront">Pay Upfront</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSaveBusiness} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : business ? (
                'Update Business'
              ) : (
                'Create Business'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* My Claimed Properties */}
        {business && myProperties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                My Properties ({myProperties.length})
              </CardTitle>
              <CardDescription>
                Properties linked to your business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {myProperties.map((property) => (
                  <div
                    key={property.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div>
                      <p className="font-medium text-foreground">{property.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {property.city}, {property.country}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnclaimProperty(property.id)}
                      disabled={claimingPropertyId === property.id}
                    >
                      {claimingPropertyId === property.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Unclaim'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Properties to Claim */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Claim Properties
            </CardTitle>
            <CardDescription>
              {business
                ? 'Select properties to link to your business for testing'
                : 'Create a business profile first to claim properties'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {availableProperties.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No unclaimed properties available.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableProperties.map((property) => (
                  <div
                    key={property.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">{property.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {property.city}, {property.country}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleClaimProperty(property.id)}
                      disabled={!business || claimingPropertyId === property.id}
                    >
                      {claimingPropertyId === property.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Claim'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        {business && (
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
              <CardDescription>Navigate to other business features</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate('/business/dashboard')}>
                View Offer Inbox
              </Button>
              <Button variant="outline" onClick={() => navigate('/explore')}>
                Browse as Guest
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
