import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import '@/styles/auth-brand.css';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#19C9B4" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [devBusy, setDevBusy] = useState<string | null>(null);

  // Dev quick-login: visible ONLY on vercel.app previews and localhost — never on
  // a real custom domain, so it is not exposed to real users in production.
  const showDevLogin = typeof window !== 'undefined' && (
    /(^|\.)vercel\.app$/.test(window.location.hostname) ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  const DEV_PASSWORD = 'findastay-test-1234';
  const quickLogin = async (role: 'guest' | 'business') => {
    const email = role === 'business' ? 'business.test@findastay.dev' : 'traveller.test@findastay.dev';
    setDevBusy(role);
    localStorage.setItem('signup_intent', role === 'business' ? 'business' : 'guest');
    let { error } = await signIn(email, DEV_PASSWORD);
    if (error) {
      const { error: signUpErr } = await signUp(email, DEV_PASSWORD, role === 'business' ? 'Test' : 'Travis', role === 'business' ? 'Business' : 'Traveller');
      if (!signUpErr) {
        ({ error } = await signIn(email, DEV_PASSWORD));
      } else {
        error = signUpErr;
      }
    }
    setDevBusy(null);
    if (error) {
      toast({
        title: 'Quick login unavailable',
        description: error.message.includes('confirm')
          ? 'Email confirmation is on for this backend — we\'d need to turn it off in Supabase to auto-provision test accounts.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }
    navigate(role === 'business' ? '/business/dashboard' : '/explore');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qIntent = params.get('intent');   // 'business' | 'traveller'
    const qMode = params.get('mode');        // 'signup' | 'login'
    if (qIntent === 'business' || qIntent === 'traveller') {
      localStorage.setItem('signup_intent', qIntent === 'business' ? 'business' : 'guest');
    }
    if (qIntent || qMode === 'signup') setTab('signup');
    else if (qMode === 'login') setTab('login');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Validation Error', description: err.errors[0].message, variant: 'destructive' });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      setIsLoading(false);
      toast({
        title: 'Login Failed',
        description: error.message === 'Invalid login credentials'
          ? 'Invalid email or password. Please try again.'
          : error.message,
        variant: 'destructive',
      });
    } else {
      setIsLoading(false);
      localStorage.removeItem('signup_intent');
      // Route by the ACTUAL account type: a business owner goes to the business
      // dashboard, everyone else to their traveller dashboard.
      let dest = '/dashboard';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('fs_listings').select('id').eq('owner_id', user.id).limit(1);
          if ((data?.length ?? 0) > 0) dest = '/business/dashboard';
        }
      } catch { /* fall back to traveller dashboard */ }
      navigate(dest);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Validation Error', description: err.errors[0].message, variant: 'destructive' });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, firstName, lastName);

    if (error) {
      setIsLoading(false);
      if (error.message.includes('already registered')) {
        let isBiz = false;
        try { const { data } = await supabase.rpc('fs_email_is_business', { p_email: signupEmail } as any); isBiz = data === true; } catch { /* ignore */ }
        toast({
          title: 'Account exists',
          description: isBiz
            ? 'This email is already registered as a business and can’t be used for a personal account. Please use a different email — or log in to reach your business dashboard.'
            : 'An account with this email already exists. Please log in instead.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Signup Failed', description: error.message, variant: 'destructive' });
      }
    } else {
      const intent = localStorage.getItem('signup_intent');
      const redirectPath = intent === 'business' ? '/business/claim' : '/explore';
      localStorage.removeItem('signup_intent');
      toast({
        title: 'Account Created',
        description: redirectPath === '/business/claim'
          ? 'Welcome! Let\'s claim your property and set it up.'
          : 'Welcome to findastay! You can now start exploring.',
      });
      setIsLoading(false);
      navigate(redirectPath);
    }
  };

  const handleForgot = async () => {
    try {
      emailSchema.parse(loginEmail);
    } catch {
      toast({
        title: 'Enter your email first',
        description: 'Type your email in the field above, then tap “Forgot password?” and we’ll send you a reset link.',
        variant: 'destructive',
      });
      return;
    }
    setResetBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setResetBusy(false);
    toast(error
      ? { title: 'Could not send reset', description: error.message, variant: 'destructive' }
      : { title: 'Check your email', description: `We’ve sent a password reset link to ${loginEmail}.` });
  };

  return (
    <div className="fa-auth">
      <div className="fa-wrap">
        {/* Brand panel */}
        <aside className="fa-brand">
          <img className="fa-brand-logo" src="/brand/findastay-tagline.svg" alt="findastay — name your price" />
          <div>
            <div className="fa-tagline">Make an offer on any stay.</div>
            <div className="fa-ticks">
              <div className="fa-tick"><Check />Free to browse and make offers</div>
              <div className="fa-tick"><Check />No commission — one small commitment fee</div>
              <div className="fa-tick"><Check />Deal direct with the property</div>
            </div>
          </div>
        </aside>

        {/* Form card */}
        <main className="fa-panel">
          <div className="fa-topbar">
            <img className="fa-logo" src="/brand/findastay-wordmark-navy.svg" alt="findastay" />
            <span className="fa-region"><i />NZ · AU</span>
          </div>

          {tab === 'login' ? (
            <section>
              <h1 className="fa-h1">Welcome back.</h1>
              <p className="fa-sub">Log in — we’ll take you to the right place.</p>
              <div className="fa-tabs" role="tablist">
                <button className="fa-tab" role="tab" aria-selected="true" onClick={() => setTab('login')}>Log in</button>
                <button className="fa-tab" role="tab" aria-selected="false" onClick={() => setTab('signup')}>Sign up</button>
              </div>
              <form className="fa-form" onSubmit={handleLogin}>
                <div className="fa-f">
                  <label htmlFor="login-email">Email</label>
                  <input id="login-email" type="email" placeholder="you@example.com" autoComplete="email"
                    value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                </div>
                <div className="fa-f">
                  <label htmlFor="login-password">Password</label>
                  <input id="login-password" type="password" placeholder="••••••••" autoComplete="current-password"
                    value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                </div>
                <button type="button" className="fa-forgot" onClick={handleForgot} disabled={resetBusy}>
                  {resetBusy ? 'Sending…' : 'Forgot password?'}
                </button>
                <button type="submit" className="fa-cta" disabled={isLoading}>
                  {isLoading ? <><span className="fa-spin" /> Signing in…</> : 'Sign in'}
                </button>
              </form>
              <p className="fa-hint">A business owner is taken to the business dashboard; everyone else to their trips.</p>
              <p className="fa-alt">New to findastay? <button className="fa-link" onClick={() => setTab('signup')}>Create an account</button></p>
              <p className="fa-biz">Listing a property? <button onClick={() => navigate('/business/register')}>Register your business →</button></p>
            </section>
          ) : (
            <section>
              <h1 className="fa-h1">Create your account.</h1>
              <p className="fa-sub">Browse and make offers for free — name your price on any stay.</p>
              <div className="fa-tabs" role="tablist">
                <button className="fa-tab" role="tab" aria-selected="false" onClick={() => setTab('login')}>Log in</button>
                <button className="fa-tab" role="tab" aria-selected="true" onClick={() => setTab('signup')}>Sign up</button>
              </div>
              <form className="fa-form" onSubmit={handleSignup}>
                <div className="fa-row">
                  <div className="fa-f">
                    <label htmlFor="first-name">First name</label>
                    <input id="first-name" placeholder="Carl" autoComplete="given-name"
                      value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="fa-f">
                    <label htmlFor="last-name">Last name</label>
                    <input id="last-name" placeholder="Falconer" autoComplete="family-name"
                      value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="fa-f">
                  <label htmlFor="signup-email">Email</label>
                  <input id="signup-email" type="email" placeholder="you@example.com" autoComplete="email"
                    value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                </div>
                <div className="fa-f">
                  <label htmlFor="signup-password">Password</label>
                  <input id="signup-password" type="password" placeholder="At least 6 characters" autoComplete="new-password"
                    value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                </div>
                <button type="submit" className="fa-cta" disabled={isLoading}>
                  {isLoading ? <><span className="fa-spin" /> Creating account…</> : 'Create account'}
                </button>
              </form>
              <p className="fa-alt">Already have an account? <button className="fa-link" onClick={() => setTab('login')}>Log in</button></p>
              <p className="fa-biz">Listing a property? <button onClick={() => navigate('/business/register')}>Register your business →</button></p>
            </section>
          )}

          {showDevLogin && (
            <div className="fa-dev">
              <p>Dev quick login · preview only</p>
              <div className="fa-dev-row">
                <button disabled={!!devBusy} onClick={() => quickLogin('guest')}>
                  {devBusy === 'guest' ? 'Loading…' : 'Enter as Traveller'}
                </button>
                <button disabled={!!devBusy} onClick={() => quickLogin('business')}>
                  {devBusy === 'business' ? 'Loading…' : 'Enter as Business'}
                </button>
              </div>
              <p className="fa-dev-note">Creates a test account on first use. Hidden on the live domain.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
