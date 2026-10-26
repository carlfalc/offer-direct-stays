import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Building2, Sparkles } from 'lucide-react';
import BusinessOnboard from '@/components/business/BusinessOnboard';
import '@/styles/findastay-brand.css';

export default function BusinessRegister() {
  const { user, loading: authLoading, signUp, signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { try { localStorage.setItem('signup_intent', 'business'); } catch { /* ignore */ } }, []);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast({ title: 'Check your details', description: 'Enter an email and a password of at least 6 characters.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const first = name.trim().split(' ')[0] || 'Owner';
    const last = name.trim().split(' ').slice(1).join(' ');
    const { error } = await signUp(email.trim(), password, first, last);
    if (error) {
      setBusy(false);
      toast({ title: error.message?.includes('already') ? 'Account exists' : 'Could not register', description: error.message?.includes('already') ? 'That email is already registered — sign in instead.' : error.message, variant: 'destructive' });
      return;
    }
    await signIn(email.trim(), password); // auto sign-in so they go straight through
    setBusy(false);
  };

  return (
    <div className="fas-brand-day min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-[#0C1A22]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/')} className="font-display text-lg font-extrabold tracking-tight text-white">find<span className="text-[#0C9C8E]">a</span>stay</button>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70"><Building2 className="h-3.5 w-3.5" /> For business</span>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-8">
        {/* Welcome */}
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <p className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-primary"><Sparkles className="h-3.5 w-3.5" /> Welcome</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Thanks for considering registering with findastay</h1>
          <p className="mt-2 text-sm text-muted-foreground">We’re really happy to provide you a new way of saving money and increasing your revenue — travellers make you offers, you set the rules, and you only ever pay a small commitment fee when a booking is confirmed. No commission.</p>
        </div>

        {authLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !user ? (
          <form onSubmit={register} className="space-y-4">
            <h2 className="font-display text-lg font-bold">Create your findastay account</h2>
            <div className="space-y-1.5">
              <Label htmlFor="br-name">Your name</Label>
              <Input id="br-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Owner" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="br-email">findastay account email</Label>
              <Input id="br-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourproperty.co.nz" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="br-pass">Password</Label>
              <Input id="br-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required />
            </div>
            <Button type="submit" className="w-full bg-[#0C1A22] text-white hover:bg-[#0C1A22]/90" disabled={busy}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating your account…</> : 'Create account & continue'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">Already have an account? <button type="button" onClick={() => navigate('/auth')} className="font-medium text-primary hover:underline">Log in</button></p>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold">To start, let’s find your business</h2>
              <p className="mt-1 text-sm text-muted-foreground">Search your business below and check it’s available. If you can’t find it, you can create it.</p>
            </div>
            <BusinessOnboard />
          </div>
        )}
      </div>
    </div>
  );
}
