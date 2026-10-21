import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ClaimableHotel } from '@/lib/listings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
  hotel: ClaimableHotel;
  onDone?: () => void;
}

export default function BusinessDetailsForm({ hotel, onDone }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState(hotel.name);
  const [contactName, setContactName] = useState('');
  const [businessEmail, setBusinessEmail] = useState(user?.email || '');
  const [billingEmail, setBillingEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState(hotel.address || '');
  const [nzbn, setNzbn] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'guest_admin_fee' | 'business_invoice'>('guest_admin_fee');
  const [terms, setTerms] = useState(false);
  const [feeAck, setFeeAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feeLabel = hotel.country === 'AU' ? 'A$12.00' : 'NZ$8.99';

  const save = async () => {
    if (!user) return;
    if (!contactName.trim()) return setError('Please add a contact name.');
    if (!businessEmail.trim()) return setError('Please add a business email.');
    if (!billingEmail.trim()) return setError('Please add a billing email.');
    if (!terms || !feeAck) return setError('Please accept the terms and acknowledge the booking fee.');
    setError(null);
    setSaving(true);

    const { error: insErr } = await supabase.from('businesses').insert({
      user_id: user.id,
      business_name: businessName.trim(),
      country: hotel.country,
      business_email: businessEmail.trim(),
      billing_email: billingEmail.trim(),
      business_phone: phone.trim() || null,
      contact_name: contactName.trim(),
      payment_collection_method: paymentMethod,
      physical_address: address.trim() || 'Address pending',
      address_line1: address.trim() || null,
      city: hotel.city,
      lat: hotel.latitude,
      lng: hotel.longitude,
      nzbn: nzbn.trim() || null,
      terms_accepted: terms,
      fee_acknowledged: feeAck,
      cancellation_policy_accepted: true,
    } as any);

    setSaving(false);
    const finish = () => {
      if (onDone) onDone();
      // Hard navigation so the layout re-checks the (now existing) business profile.
      else window.location.assign('/business/dashboard');
    };
    if (insErr) {
      // Unique violation = profile already exists; treat as done.
      if ((insErr as any).code === '23505') return finish();
      setError(insErr.message || 'Could not save your details. Please try again.');
      return;
    }
    toast({ title: 'Business profile saved', description: `${businessName} is all set up.` });
    finish();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-5 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Finish setting up {hotel.name}</h1>
          <p className="text-sm text-muted-foreground">A few details and you're ready to receive offers.</p>
        </div>
      </div>

      <Card className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Business name</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Contact name *</Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Who we reach about offers" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Business email *</Label>
            <Input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Billing email *</Label>
            <Input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Phone (optional)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+64 21 123 4567" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">NZBN / Tax ID (optional)</Label>
            <Input value={nzbn} onChange={(e) => setNzbn(e.target.value)} className="mt-1" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">
            {hotel.city ? `${hotel.city}, ` : ''}
            {hotel.country}
          </p>
        </div>

        {/* Fee option */}
        <div>
          <Label className="text-xs">How is the booking fee collected?</Label>
          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)} className="mt-2 space-y-2">
            <div className="flex items-start gap-2">
              <RadioGroupItem value="guest_admin_fee" id="guest_fee" className="mt-0.5" />
              <Label htmlFor="guest_fee" className="text-sm font-normal text-foreground">
                Guest pays the {feeLabel} booking fee (recommended) — nothing to invoice you.
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="business_invoice" id="biz_invoice" className="mt-0.5" />
              <Label htmlFor="biz_invoice" className="text-sm font-normal text-foreground">
                We invoice your business for the booking fee.
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Acknowledgements */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Checkbox id="terms" checked={terms} onCheckedChange={(v) => setTerms(!!v)} className="mt-0.5" />
            <Label htmlFor="terms" className="text-sm font-normal text-foreground">I accept the findastay terms and conditions.</Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="feeack" checked={feeAck} onCheckedChange={(v) => setFeeAck(!!v)} className="mt-0.5" />
            <Label htmlFor="feeack" className="text-sm font-normal text-foreground">I understand a {feeLabel} booking fee applies to confirmed offers.</Label>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            'Save & go to dashboard'
          )}
        </Button>
      </Card>
    </div>
  );
}
