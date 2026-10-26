import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { PAYMENT_METHODS, PaymentMethodId } from '@/lib/paymentMethods';
import '@/styles/findastay-onboard.css';

const PROPERTY_TYPES = [
  { v: 'hotel', label: 'Hotel' }, { v: 'motel', label: 'Motel' }, { v: 'lodge', label: 'Lodge' },
  { v: 'resort', label: 'Resort' }, { v: 'bnb', label: 'Bed & Breakfast' }, { v: 'apartment', label: 'Apartment' },
  { v: 'house', label: 'House' }, { v: 'holiday_home', label: 'Holiday home' }, { v: 'small_holiday_home', label: 'Small holiday home' },
  { v: 'beach_bach', label: 'Beach bach' }, { v: 'cabin', label: 'Cabin' }, { v: 'cottage', label: 'Cottage' },
  { v: 'villa', label: 'Villa' }, { v: 'unit', label: 'Unit / studio' }, { v: 'room', label: 'Room' },
  { v: 'caravan', label: 'Caravan' }, { v: 'holiday_park', label: 'Holiday park' }, { v: 'hostel', label: 'Hostel' },
  { v: 'farmstay', label: 'Farmstay' }, { v: 'glamping', label: 'Glamping' }, { v: 'other', label: 'Other' },
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
  const [propertyType, setPropertyType] = useState('motel');
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
    <div>
      <button className="fo-backlink" onClick={onBack}>← Back</button>
      <div className="fo-mark2 fo-disp">Great — you're just about signed up!</div>
      <p className="fo-lead2">You're nearly live{mode === 'claim' && hotel?.name ? ` with ${hotel.name}` : ''}. Confirm your details and tick the agreements, and we'll fire up your dashboard.</p>

      <div className="fo-card">
        {/* Create-only identity fields */}
        {mode === 'create' && (
          <div className="fo-field"><label>Business name *</label><input className="fo-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aotea Motor Lodge" /></div>
        )}
        {mode === 'create' && (
          <>
            <div className="fo-field"><label>Address</label><input className="fo-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" /></div>
            <div className="fo-row2 fo-field">
              <div><label>Town / city</label><input className="fo-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Whanganui" /></div>
              <div><label>Country</label>
                <select className="fo-select" value={country} onChange={(e) => setCountry(e.target.value as 'NZ' | 'AU')}><option value="NZ">New Zealand</option><option value="AU">Australia</option></select>
              </div>
            </div>
          </>
        )}

        <div className="fo-row2 fo-field">
          <div><label>Contact name *</label><input className="fo-input" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Who we reach about offers" /></div>
          <div><label>Business email *</label><input className="fo-input" type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} /></div>
          <div><label>Phone</label><input className="fo-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+64 21 123 4567" /></div>
          <div><label>NZBN / ABN (optional)</label><input className="fo-input" value={nzbn} onChange={(e) => setNzbn(e.target.value)} /></div>
        </div>

        <div className="fo-field">
          <label className="fo-ptlabel">Property type</label>
          <select className="fo-select" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
            {PROPERTY_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </div>

        {/* When is the balance due */}
        <div className="fo-sech">When is the balance due? <span>(after the commitment fee)</span></div>
        <label className="fo-radio"><input type="radio" name="pt" checked={paymentTerms === 'on_arrival'} onChange={() => setPaymentTerms('on_arrival')} /> On arrival</label>
        <label className="fo-radio"><input type="radio" name="pt" checked={paymentTerms === 'days_before'} onChange={() => setPaymentTerms('days_before')} /> A set number of days before arrival:
          <input className="fo-mini" type="number" min={1} max={120} value={leadDays} onFocus={() => setPaymentTerms('days_before')} onChange={(e) => setLeadDays(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} /></label>
        <label className="fo-radio"><input type="radio" name="pt" checked={paymentTerms === 'upfront'} onChange={() => setPaymentTerms('upfront')} /> Upfront when the offer is accepted</label>

        {/* Payment methods */}
        <div className="fo-sech">How do you want to receive payment?</div>
        <p className="fo-sechsub">Tick all you accept — change any time. findastay only ever takes the commitment fee.</p>
        {PAYMENT_METHODS.map((m) => (
          <label key={m.id} className="fo-pm">
            <input type="checkbox" checked={methods.has(m.id)} onChange={() => toggleMethod(m.id)} />
            <span><b>{m.label}</b><i>{m.hint}</i></span>
          </label>
        ))}
        {methods.has('payment_link') && <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paste your payment link or notes for guests" className="fo-input" style={{ marginTop: 10, minHeight: 56 }} />}

        {/* Agreements — brand green box */}
        <div className="fo-agbox">
          <div className="fo-agtitle"><ShieldCheck className="h-5 w-5" /> Agreements <span className="req">(all required)</span></div>
          {AGREEMENTS.map((a) => (
            <label key={a.id} className="fo-agcheck">
              <input type="checkbox" checked={!!agree[a.id]} onChange={(e) => setAgree((s) => ({ ...s, [a.id]: e.target.checked }))} />
              <span>{a.label}</span>
            </label>
          ))}
        </div>

        {error && <p className="fo-err"><AlertCircle className="h-4 w-4" /> {error}</p>}

        <button className="fo-btn teal big" onClick={submit} disabled={busy || !allAgreed}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {mode === 'claim' ? 'Claiming…' : 'Creating…'}</> : (mode === 'claim' ? 'Claim this business 🎉' : 'Create business 🎉')}
        </button>
      </div>
    </div>
  );
}
