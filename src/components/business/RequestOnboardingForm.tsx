import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

const ROLES = ['Owner / Operator', 'Manager', 'Director', 'Front desk / Reception', 'Booking agent', 'Other'];

interface Props {
  initialBusinessName?: string;
  onBack?: () => void;
}

export default function RequestOnboardingForm({ initialBusinessName = '', onBack }: Props) {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [roleOther, setRoleOther] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!name.trim()) return setError('Please add your name.');
    if (!email.trim()) return setError('Please add an email so we can reach you.');
    if (!businessName.trim()) return setError('Please add your business name.');
    setError(null);
    setSaving(true);
    const finalRole = role === 'Other' ? roleOther.trim() || 'Other' : role || null;
    const { error: insErr } = await supabase.from('fs_onboarding_requests').insert({
      user_id: user?.id ?? null,
      contact_name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      business_name: businessName.trim(),
      company: company.trim() || null,
      role: finalRole,
      message: message.trim() || null,
    } as any);
    setSaving(false);
    if (insErr) {
      setError(insErr.message || 'Could not send your request. Please try again.');
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Request sent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Thanks — our team will be in touch at {email} to get {businessName} listed on findastay.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {onBack && (
        <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </button>
      )}
      <h1 className="text-2xl font-semibold text-foreground">Can't find your business?</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        If your property isn't listed yet — or it's brand new — send us your details and we'll help get you onboarded.
      </p>

      <Card className="mt-5 space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Your name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+64 21 123 4567" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Your role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === 'Other' && (
            <div className="sm:col-span-2">
              <Label className="text-xs">Tell us your role</Label>
              <Input value={roleOther} onChange={(e) => setRoleOther(e.target.value)} className="mt-1" />
            </div>
          )}
          <div>
            <Label className="text-xs">Business name *</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Company (if any)</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Trading company / group" className="mt-1" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Anything else? (optional)</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="mt-1 resize-none" placeholder="Location, number of rooms, anything that helps us onboard you." />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button className="w-full" onClick={submit} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            'Send onboarding request'
          )}
        </Button>
      </Card>
    </div>
  );
}
