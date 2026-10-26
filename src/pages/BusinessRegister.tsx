import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import BusinessOnboard from '@/components/business/BusinessOnboard';
import FsWordmark from '@/components/business/FsWordmark';
import ResultsFooter from '@/components/explore/ResultsFooter';
import '@/styles/findastay-onboard.css';

/** Tall skyline / skyscraper mark for the header. */
const Skyline = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="9" width="4" height="12" rx="1" /><rect x="9.5" y="2.5" width="5" height="18.5" rx="1" /><rect x="17" y="11" width="4" height="10" rx="1" />
  </svg>
);

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
      toast({ title: error.message?.includes('already') ? 'Account exists' : 'Could not register', description: error.message?.includes('already') ? 'That email is already registered — log in instead.' : error.message, variant: 'destructive' });
      return;
    }
    await signIn(email.trim(), password);
    setBusy(false);
  };

  return (
    <div className="fo-root">
      <div className="fo-bg"><div className="fo-blob a" /><div className="fo-blob b" /><div className="fo-blob c" /></div>

      <header className="fo-header">
        <div className="fo-navin">
          <button className="fo-logo" onClick={() => navigate('/')} aria-label="findastay home"><img src="/findastay-logo.svg" alt="findastay" /></button>
          <span className="fo-navtag"><Skyline /> For business</span>
        </div>
      </header>

      <main className="fo-main">
        <FsWordmark />

        {/* Welcome — magazine style */}
        <div className="fo-card">
          <span className="fo-eyebrow"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 5.6L20 9l-4 4 1 6-5-2.8L7 19l1-6-4-4 5.6-1.4z" /></svg> Welcome aboard</span>
          <h1 className="fo-h1 fo-disp">Let's get your place earning more.</h1>
          <p className="fo-lead">Thanks for joining findastay — a smarter way to fill rooms. Travellers make you offers, <span className="fo-mag fo-disp">you set the rules</span>, and you keep your full rate. No commission. No monthly debits. Ever.</p>

          {authLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !user ? (
            <form onSubmit={register}>
              <div className="fo-field"><label>Your name</label><input className="fo-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Owner" /></div>
              <div className="fo-field"><label>findastay account email</label><input className="fo-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourproperty.co.nz" required /></div>
              <div className="fo-field"><label>Password</label><input className="fo-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required /></div>
              <button type="submit" className="fo-btn teal" disabled={busy}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating your account…</> : 'Create account & continue →'}
              </button>
              <p className="mt-4 text-center text-[0.95rem]" style={{ color: 'var(--fo-muted)' }}>Already with us? <button type="button" className="fo-login fo-disp" onClick={() => navigate('/auth')}>Log in</button></p>
            </form>
          ) : null}
        </div>

        {/* Find your business / claim / create — BusinessOnboard carries the styling */}
        {!authLoading && user && (
          <div className="mt-8"><BusinessOnboard /></div>
        )}
      </main>

      <div style={{ position: 'relative', zIndex: 1 }}><ResultsFooter /></div>
    </div>
  );
}
