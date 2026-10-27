import { ReactNode, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, LogOut, Heart, Plane, MessageSquare, Send, LayoutDashboard, Settings, Building2, User, ChevronDown, Menu, SlidersHorizontal, Wallet, Image as ImageIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import { useFsCounts } from '@/hooks/useFsCounts';
import FsNotificationBell from './FsNotificationBell';
import '@/styles/findastay-brand.css';
import ResultsFooter from '@/components/explore/ResultsFooter';

interface AuthenticatedLayoutProps {
  children: ReactNode;
  fullHeight?: boolean;
}

export default function AuthenticatedLayout({ children, fullHeight = false }: AuthenticatedLayoutProps) {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { unreadCount } = useNotifications();
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);

  // small count badge shown on the Messages nav item
  const { businessPending, toConfirm } = useFsCounts();

  // How many items need attention on a given nav tile.
  const badgeFor = (label: string) =>
    label === 'Messages'
      ? unreadCount
      : label === 'Business' || label === 'Dashboard'
      ? businessPending
      : label === 'My Offers'
      ? toConfirm
      : 0;

  const CountBadge = ({ count, tone = 'default' }: { count: number; tone?: 'default' | 'alert' }) =>
    count > 0 ? (
      <span
        className={cn(
          'ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none',
          tone === 'alert' ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground',
        )}
      >
        {count > 99 ? '99+' : count}
      </span>
    ) : null;

  const checkBusiness = useCallback(async () => {
    if (!user) {
      setHasBusiness(null);
      return;
    }
    // Business identity = you own at least one findastay listing (fs_listings).
    const { data } = await supabase
      .from('fs_listings')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);
    setHasBusiness((data?.length ?? 0) > 0);
  }, [user]);

  useEffect(() => { checkBusiness(); }, [checkBusiness]);

  // When a claim/create succeeds elsewhere, flip ownership on immediately so
  // the route guard below doesn't bounce the fresh owner back to /business/claim.
  useEffect(() => {
    const onChanged = () => setHasBusiness(true);
    window.addEventListener('fs-business-changed', onChanged);
    return () => window.removeEventListener('fs-business-changed', onChanged);
  }, []);

  const isBusinessRoute = location.pathname.startsWith('/business');
  const isOnboardingRoute = location.pathname === '/business/onboarding';
  // Entry pages a business can be on BEFORE they own a listing.
  const businessEntry = ['/business/claim', '/business/register'];
  const isBusinessEntry = businessEntry.includes(location.pathname);

  useEffect(() => {
    if (hasBusiness === null || authLoading) return;
    // A business that hasn't claimed a property yet belongs on the claim page,
    // not a deep business page.
    if (isBusinessRoute && !isBusinessEntry && !isOnboardingRoute && hasBusiness === false) {
      navigate('/business/claim');
    }
  }, [hasBusiness, isBusinessRoute, isBusinessEntry, isOnboardingRoute, authLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const guestNavItems = [
    { label: 'Home', path: '/dashboard', icon: LayoutDashboard },
    { label: 'My Offers', path: '/offers', icon: Send },
    { label: 'Watchlist', path: '/watchlist', icon: Heart },
    { label: 'Trips', path: '/trips', icon: Plane },
    { label: 'Messages', path: '/messages', icon: MessageSquare },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  if (hasBusiness === true) {
    guestNavItems.push({ label: 'Business', path: '/business/dashboard', icon: Building2 });
  }

  const businessNavItems = [
    { label: 'Dashboard', path: '/business/dashboard', icon: LayoutDashboard },
    { label: 'Rooms & photos', path: '/business/content', icon: ImageIcon },
    { label: 'Pricing', path: '/business/pricing', icon: SlidersHorizontal },
    { label: 'Payment settings', path: '/business/payment', icon: Wallet },
    { label: 'Profile', path: '/business/settings', icon: User },
    { label: 'Messages', path: '/messages', icon: MessageSquare },
  ];

  // Operational business pages run in the light "day" theme; travellers and
  // the claim/onboarding flow keep the dark "night" theme.
  // Any business route (including the pre-claim claim/register pages) gets the
  // business chrome, so a new owner sees the business experience immediately.
  // A business owner stays in the business experience on shared routes too (e.g.
  // Messages), so they never drop into the traveller/personal nav ("Home" →
  // traveller dashboard) from the business flow.
  const sharedBusinessRoute = location.pathname.startsWith('/messages');
  const businessMode = !isOnboardingRoute && (isBusinessRoute || (hasBusiness === true && sharedBusinessRoute));
  const navItems = businessMode ? businessNavItems : guestNavItems;

  if (authLoading) {
    return (
      <div className="fas-brand flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const userEmail = user?.email || 'User';
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <div className={cn(businessMode ? 'fas-brand-day' : 'fas-brand', 'flex flex-col', fullHeight ? 'h-screen overflow-hidden' : 'min-h-screen')}>
      {/* Premium Header */}
      <header className="h-16 border-b border-white/5 bg-[#0C1A22] flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-20">
        {/* Logo + (business) section label */}
        <button
          onClick={() => navigate(businessMode ? '/business/dashboard' : '/explore')}
          aria-label="findastay"
          className="group flex items-center gap-3"
        >
          <img
            src="/findastay-logo.svg"
            alt="findastay"
            className={cn(
              'h-9 md:h-10 w-auto select-none',
              'origin-left transition-transform duration-300 ease-out',
              'group-hover:scale-110 group-hover:drop-shadow-[0_0_14px_rgba(46,211,192,0.55)]',
              'active:scale-95 motion-reduce:transition-none motion-reduce:group-hover:scale-100',
            )}
            draggable={false}
          />
          {businessMode && (
            <span className="hidden sm:inline font-mono text-[0.7rem] uppercase tracking-[0.14em] text-white/55 border-l border-white/15 pl-3">
              Business dashboard
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          {/* Desktop navigation - icon + label */}
          <nav className="hidden lg:flex items-center gap-1 mr-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {badgeFor(item.label) > 0 && (
                    <CountBadge count={badgeFor(item.label)} tone={item.label === 'Messages' ? 'default' : 'alert'} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Tablet navigation - icon only */}
          <nav className="hidden md:flex lg:hidden items-center gap-0.5 mr-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  title={item.label}
                  className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  <item.icon className="h-4.5 w-4.5" />
                  {badgeFor(item.label) > 0 && (
                    <span className={cn(
                      "absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center leading-none",
                      item.label === 'Messages' ? "bg-primary text-primary-foreground" : "bg-red-500 text-white"
                    )}>
                      {badgeFor(item.label) > 99 ? '99+' : badgeFor(item.label)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          
          {/* Offer notifications bell */}
          <FsNotificationBell />

          {/* Profile dropdown (desktop/tablet) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "hidden md:flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-300",
                "text-white/70 hover:text-white hover:bg-white/10",
                "focus:outline-none focus:ring-2 focus:ring-white/30"
              )}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 border border-white/20">
                  <span className="text-xs font-semibold text-white">{userInitial}</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-white/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-56 bg-card border-border/50 shadow-xl z-50"
              sideOffset={8}
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-foreground">Account</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem 
                onClick={() => navigate(businessMode ? '/business/settings' : '/profile')}
                className="cursor-pointer hover:bg-primary/5 focus:bg-primary/10 focus:text-foreground"
              >
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate(hasBusiness ? '/business/settings' : '/settings')}
                className="cursor-pointer hover:bg-primary/5 focus:bg-primary/10 focus:text-foreground"
              >
                <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem 
                onClick={handleSignOut} 
                className="cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/5 focus:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Mobile menu trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <button className={cn(
                "md:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300",
                "text-white/70 hover:text-white hover:bg-white/10"
              )}>
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-card border-border/30 p-0">
              <div className="flex flex-col h-full">
                {/* User info header */}
                <div className="p-5 border-b border-border/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      "bg-gradient-to-br from-primary/25 to-accent/15 border border-primary/30",
                      "shadow-[0_0_16px_rgba(199,167,108,0.2)]"
                    )}>
                      <span className="text-base font-semibold text-primary">{userInitial}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Account</p>
                      <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
                          isActive 
                            ? "bg-primary/15 text-primary shadow-[0_0_12px_rgba(199,167,108,0.15)]" 
                            : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                        )}
                      >
                        <item.icon className="h-4.5 w-4.5" />
                        <span>{item.label}</span>
                        {badgeFor(item.label) > 0 && (
                    <CountBadge count={badgeFor(item.label)} tone={item.label === 'Messages' ? 'default' : 'alert'} />
                  )}
                      </button>
                    );
                  })}

                  <div className="pt-2">
                    <div className="h-px bg-border/30 my-2" />
                  </div>

                  {/* Profile & Settings in mobile nav */}
                  <button
                    onClick={() => navigate(businessMode ? '/business/settings' : '/profile')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-all duration-300"
                  >
                    <User className="h-4.5 w-4.5" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => navigate(hasBusiness ? '/business/settings' : '/settings')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-all duration-300"
                  >
                    <Settings className="h-4.5 w-4.5" />
                    <span>Settings</span>
                  </button>
                </nav>

                {/* Sign out */}
                <div className="p-4 border-t border-border/30">
                  <button
                    onClick={handleSignOut}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                      "text-sm font-medium text-destructive",
                      "bg-destructive/5 hover:bg-destructive/10 transition-all duration-300"
                    )}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main content */}
      {fullHeight ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      ) : (
        <main className="flex-1">
          {children}
        </main>
      )}

      {!fullHeight && <ResultsFooter />}
    </div>
  );
}
