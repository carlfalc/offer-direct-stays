import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Building2 } from 'lucide-react';
import { z } from 'zod';
import BrandBackdrop from '@/components/brand/BrandBackdrop';
import '@/styles/findastay-brand.css';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupIntent, setSignupIntent] = useState<string | null>(null);
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [spin, setSpin] = useState(false);
  const triggerSpin = () => { setSpin(true); window.setTimeout(() => setSpin(false), 2600); };
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
    // try to sign in; if the account doesn't exist yet, create it then sign in
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
    let intent = localStorage.getItem('signup_intent');
    if (qIntent === 'business' || qIntent === 'traveller') {
      intent = qIntent === 'business' ? 'business' : 'guest';
      localStorage.setItem('signup_intent', intent);
    }
    setSignupIntent(intent);
    // Coming from a "Register" link → open the Sign Up tab.
    if (qIntent || qMode === 'signup') setTab('signup');
    else if (qMode === 'login') setTab('login');
  }, []);

  const getRedirectPath = async () => {
    const intent = localStorage.getItem('signup_intent');
    // Don't remove yet - let the destination page handle it
    if (intent === 'business') {
      return '/business/dashboard';
    }
    return '/explore';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: err.errors[0].message,
          variant: 'destructive',
        });
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
        toast({
          title: 'Validation Error',
          description: err.errors[0].message,
          variant: 'destructive',
        });
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
        toast({
          title: 'Signup Failed',
          description: error.message,
          variant: 'destructive',
        });
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

  return (
    <div className="fas-brand fas-stage">
      <BrandBackdrop />

      <div className={`fas-wm fas-wm-logo${spin ? ' gone' : ''}`} aria-label="findastay">
        <svg viewBox="0 0 1200 230" xmlns="http://www.w3.org/2000/svg">
          <text x="600" y="178" textAnchor="middle" textLength="1140" lengthAdjust="spacingAndGlyphs"
                fontFamily="Bricolage Grotesque, Georgia, serif" fontWeight="800" fontSize="210" letterSpacing="-5">
            <tspan className="w">find</tspan><tspan className="t">a</tspan><tspan className="w">stay</tspan>
          </text>
        </svg>
      </div>

      <div className="w-full max-w-md" style={{ position: 'relative', zIndex: 3 }}>

        {signupIntent === 'business' && (
          <div className="mb-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-primary" />
              <Badge variant="secondary" className="text-xs">Register your business</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Create your owner account, then claim your property, set prices and go live.
            </p>
          </div>
        )}
        {signupIntent === 'guest' && (
          <div className="mb-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-primary" />
              <Badge variant="secondary" className="text-xs">Register as a traveller</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Create your free account, then name your price on any stay.
            </p>
          </div>
        )}

        <Card className="fas-glass border-border">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="fas-title text-2xl text-center">
              {tab === 'signup' && signupIntent === 'business' ? 'Register your business'
                : tab === 'signup' && signupIntent === 'guest' ? 'Create your account'
                : 'Welcome'}
            </CardTitle>
            <CardDescription className="text-center">
              {signupIntent === 'business'
                ? 'List your property — pay only when you\'re booked'
                : signupIntent === 'guest'
                ? 'Browse and make offers for free'
                : 'Sign in or create an account to continue'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} className="w-full" onValueChange={(v) => { setTab(v as 'login' | 'signup'); triggerSpin(); }}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First Name</Label>
                      <Input
                        id="first-name"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last Name</Label>
                      <Input
                        id="last-name"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {showDevLogin && (
          <div className="mt-4 rounded-xl border border-primary/25 bg-black/30 backdrop-blur px-4 py-3">
            <p className="text-[11px] font-mono uppercase tracking-wider text-primary mb-2">Dev quick login · preview only</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" disabled={!!devBusy} onClick={() => quickLogin('guest')}>
                {devBusy === 'guest' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enter as Traveller'}
              </Button>
              <Button variant="outline" size="sm" disabled={!!devBusy} onClick={() => quickLogin('business')}>
                {devBusy === 'business' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enter as Business'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Creates a test account on first use. Hidden on the live domain.</p>
          </div>
        )}
      </div>

      <div className={`fas-wm fas-wm-newera${spin ? ' gone' : ''}`} aria-label="new era">
        <svg viewBox="0 0 1200 190" xmlns="http://www.w3.org/2000/svg">
          <text x="600" y="150" textAnchor="middle" textLength="1140" lengthAdjust="spacingAndGlyphs"
                fontFamily="Bricolage Grotesque, Georgia, serif" fontWeight="800" fontSize="180" letterSpacing="-4">
            <tspan className="w">n</tspan><tspan className="t">e</tspan><tspan className="w">w</tspan><tspan> </tspan><tspan className="t">e</tspan><tspan className="w">r</tspan><tspan className="t">a</tspan>
          </text>
        </svg>
      </div>
    </div>
  );
}
