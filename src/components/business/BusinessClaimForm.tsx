import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import { PAYMENT_METHODS, PaymentMethodId } from '@/lib/paymentMethods';

const PROPERTY_TYPES = [
  { v: 'hotel', label: 'Hotel' }, { v: 'motel', label: 'Motel' }, { v: 'lodge', label: 'Lodge' },
  { v: 'resort', label: 'Resort' }, { v: 'bnb', label: 'Bed & Breakfast' }, { v: 'home', label: 'Home / House' },
  { v: 'apartment', label: 'Apartment' }, { v: 'holiday_park', label: 'Holiday park' },
];

const AGREEMENTS = [
  { id: 'terms', label: 'I have read and accept the findastay Terms & Conditions.' },
  { id: 'liability', label: 'I accept the Liability terms — findastay is a booking platform; the stay contract is between me and the guest.' },
  { id: 'security', label: 'I agree to the Security & data-handling policy and will keep guest details safe.' },
  { id: 'declaration', label: 'I declare this is my business and I am authorised to list and manage it.' },
] as const;

export interface ClaimPayload {
  name: string; address: string; city: string; country: 'NZ' | 'AU';
  paymentMethods: string[]; paymentNote: string;
  contactName: string; businessEmail: string; businessPhone: string; nzbn: string;
  propertyType: string; paymentTerms: 'on_arrival' | 'days_before' | 'upfront'; leadDays: number;
  agreements: Record<string, boolean>;
}

export default function BusinessClaimForm({ mode, hotel, busy, onBack, onSubmit }: {
  mode: 'claim' | 'create';
  hotel?: { name: string; city?: string | null; country?: string | null } | null;
  busy: boolean;
  onBack: () => void;
  onSubmit: (p: ClaimPayload) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(hotel?.name || '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(hotel?.city || '');
  const [country, setCountry] = useState<'NZ' | 'AU'>((hotel?.country === 'AU' ? 'AU' : 'NZ'));
  const [methods, setMethods] = useState<Set<string>>(new Set(['bank_transfer']));
  const [note, setNote] = useState('');
  const [contactName, setContactName] = useState('');
  const [businessEmail, setBusinessEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [nzbn, setNzbn] = useState('');
  const [propertyType, setPropertyType] = useState('hotel');
  const [paymentTerms, setPaymentTerms] = useState<'on_arrival' | 'days_before' | 'upfront'>('on_arrival');
  const [leadDays, setLeadDays] = useState(10);
  const [agree, setAgree] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const allAgreed = AGREEMENTS.every((a) => agree[a.id]);
  const toggleMethod = (id: PaymentMethodId) =>
    setMethods((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = () => {
    if (mode === 'create' && !name.trim()) return setError('Business name is required.');
    if (!contactName.trim()) return setError('Please add a contact name.');
    if (!businessEmail.trim()) return setError('Please add a business email.');
    if (!allAgreed) return setError('Please accept all four agreements below to continue.');
    setError(null);
    onSubmit({
      name: name.trim(), address: address.trim(), city: city.trim(), country,
      paymentMethods: Array.from(methods), paymentNote: note.trim(),
      contactName: contactName.trim(), businessEmail: businessEmail.trim(), businessPhone: phone.trim(), nzbn: nzbn.trim(),
      propertyType, paymentTerms, leadDays, agreements: { ...agree },
    });
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h2 className="font-display text-xl font-bold text-foreground">{mode === 'claim' ? `Confirm & claim ${hotel?.name || 'your business'}` : 'Create your business'}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Enter your business details and accept the agreements to {mode === 'claim' ? 'claim this property' : 'create your business'}. You’ll set rooms, photos and prices next.</p>
      </div>

      {/* Create-only identity fields */}
      {mode === 'create' && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <Label className="text-xs font-semibold">Business name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aotea Motor Lodge" />
          <Label className="text-xs font-semibold">Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" />
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs font-semibold">Town / city</Label><Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" placeholder="e.g. Whanganui" /></div>
            <div><Label className="text-xs font-semibold">Country</Label>
              <select value={country} onChange={(e) => setCountry(e.target.value as 'NZ' | 'AU')} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="NZ">New Zealand</option><option value="AU">Australia</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Shared business details */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label className="text-xs font-semibold">Contact name *</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="mt-1" placeholder="Who we reach about offers" /></div>
        <div><Label className="text-xs font-semibold">Business email *</Label><Input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} className="mt-1" /></div>
        <div><Label className="text-xs font-semibold">Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="+64 21 123 4567" /></div>
        <div><Label className="text-xs font-semibold">NZBN / ABN (optional)</Label><Input value={nzbn} onChange={(e) => setNzbn(e.target.value)} className="mt-1" /></div>
      </div>

      <div>
        <Label className="text-xs font-semibold">Property type</Label>
        <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          {PROPERTY_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
      </div>

      {/* When is the balance due */}
      <div>
        <Label className="text-xs font-semibold">When is the balance due? (after the commitment fee)</Label>
        <div className="mt-2 space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="pt" checked={paymentTerms === 'on_arrival'} onChange={() => setPaymentTerms('on_arrival')} /> On arrival</label>
          <label className="flex flex-wrap items-center gap-2"><input type="radio" name="pt" checked={paymentTerms === 'days_before'} onChange={() => setPaymentTerms('days_before')} /> A set number of days before arrival:
            <Input type="number" min={1} max={120} value={leadDays} onFocus={() => setPaymentTerms('days_before')} onChange={(e) => setLeadDays(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} className="h-8 w-20" /></label>
          <label className="flex items-center gap-2"><input type="radio" name="pt" checked={paymentTerms === 'upfront'} onChange={() => setPaymentTerms('upfront')} /> Upfront when the offer is accepted</label>
        </div>
      </div>

      {/* Payment methods */}
      <div>
        <Label className="text-xs font-semibold">How do you want to receive payment?</Label>
        <p className="mb-2 text-xs text-muted-foreground">Tick all you accept — change any time. findastay only ever takes the commitment fee.</p>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 hover:border-primary/40">
              <input type="checkbox" checked={methods.has(m.id)} onChange={() => toggleMethod(m.id)} className="mt-0.5 h-4 w-4 flex-none" />
              <span className="min-w-0"><span className="text-sm font-medium text-foreground">{m.label}</span><span className="block text-xs text-muted-foreground">{m.hint}</span></span>
            </label>
          ))}
        </div>
        {methods.has('payment_link') && <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paste your payment link or notes for guests" className="mt-2 min-h-[52px]" />}
      </div>

      {/* Agreements — all required */}
      <div className="rounded-xl border border-amber-300/50 bg-amber-50 p-3.5">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Agreements (all required)</p>
        <div className="space-y-2.5">
          {AGREEMENTS.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
              <input type="checkbox" checked={!!agree[a.id]} onChange={(e) => setAgree((s) => ({ ...s, [a.id]: e.target.checked }))} className="mt-0.5 h-4 w-4 flex-none" />
              <span>{a.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="h-4 w-4" /> {error}</p>}

      <Button className="w-full" onClick={submit} disabled={busy || !allAgreed}>
        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {mode === 'claim' ? 'Claiming…' : 'Creating…'}</> : (mode === 'claim' ? 'Claim this business' : 'Create business')}
      </Button>
    </div>
  );
}
