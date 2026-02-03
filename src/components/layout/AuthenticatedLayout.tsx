import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, LogOut, Heart, Plane, MessageSquare, Send, LayoutDashboard, Settings, Building2, User, ChevronDown, Menu } from 'lucide-react';
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

interface AuthenticatedLayoutProps {
  children: ReactNode;
  fullHeight?: boolean;
}

export default function AuthenticatedLayout({ children, fullHeight = false }: AuthenticatedLayoutProps) {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);

  useEffect(() => {
    const checkBusiness = async () => {
      if (!user) {
        setHasBusiness(null);
        return;
      }
      
      const { data } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setHasBusiness(!!data);
    };
    
    checkBusiness();
  }, [user]);

  const isBusinessRoute = location.pathname.startsWith('/business');
  const isOnboardingRoute = location.pathname === '/business/onboarding';
  
  useEffect(() => {
    if (hasBusiness === null || authLoading) return;
    
    if (isBusinessRoute && !isOnboardingRoute && hasBusiness === false) {
      toast({
        title: 'Complete Your Setup',
        description: 'Let\'s finish setting up your business profile.',
      });
      navigate('/business/onboarding');
    }
  }, [hasBusiness, isBusinessRoute, isOnboardingRoute, location.pathname, authLoading, navigate, toast]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const guestNavItems = [
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
    { label: 'Settings', path: '/business/settings', icon: Settings },
    { label: 'Messages', path: '/messages', icon: MessageSquare },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  const navItems = (isBusinessRoute && !isOnboardingRoute && hasBusiness === true) ? businessNavItems : guestNavItems;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const userEmail = user?.email || 'User';
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <div className={`flex flex-col bg-background ${fullHeight ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Premium Header */}
      <header className="h-16 border-b border-border/30 bg-card/90 backdrop-blur-md flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-20">
        {/* Logo */}
        <button 
          onClick={() => navigate('/explore')}
          className="flex items-center gap-2.5 group"
        >
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300",
            "bg-gradient-to-br from-gold/20 to-teal/10 border border-gold/20",
            "group-hover:shadow-[0_0_16px_rgba(199,167,108,0.3)] group-hover:border-gold/40"
          )}>
            <MapPin className="h-4.5 w-4.5 text-gold" />
          </div>
          <span className="font-display font-semibold text-lg text-foreground tracking-tight hidden sm:block">
            findastay
          </span>
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
                      ? "bg-gold/15 text-gold shadow-[0_0_12px_rgba(199,167,108,0.15)]" 
                      : "text-muted-foreground hover:text-foreground hover:bg-gold/5 hover:shadow-[0_0_8px_rgba(199,167,108,0.1)]"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
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
                    "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300",
                    isActive 
                      ? "bg-gold/15 text-gold shadow-[0_0_12px_rgba(199,167,108,0.15)]" 
                      : "text-muted-foreground hover:text-foreground hover:bg-gold/5 hover:shadow-[0_0_8px_rgba(199,167,108,0.1)]"
                  )}
                >
                  <item.icon className="h-4.5 w-4.5" />
                </button>
              );
            })}
          </nav>
          
          {/* Profile dropdown (desktop/tablet) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "hidden md:flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-300",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-gold/5 hover:shadow-[0_0_12px_rgba(199,167,108,0.1)]",
                "focus:outline-none focus:ring-2 focus:ring-gold/30 focus:ring-offset-2 focus:ring-offset-background"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                  "bg-gradient-to-br from-gold/25 to-teal/15 border border-gold/30"
                )}>
                  <span className="text-xs font-semibold text-gold">{userInitial}</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
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
                onClick={() => navigate('/profile')}
                className="cursor-pointer hover:bg-gold/5 focus:bg-gold/10 focus:text-foreground"
              >
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate(hasBusiness ? '/business/settings' : '/settings')}
                className="cursor-pointer hover:bg-gold/5 focus:bg-gold/10 focus:text-foreground"
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
                "text-muted-foreground hover:text-foreground",
                "hover:bg-gold/5 hover:shadow-[0_0_8px_rgba(199,167,108,0.1)]"
              )}>
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-card border-border/30 p-0">
              <div className="flex flex-col h-full">
                {/* User info header */}
                <div className="p-5 border-b border-border/30 bg-gradient-to-br from-gold/5 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      "bg-gradient-to-br from-gold/25 to-teal/15 border border-gold/30",
                      "shadow-[0_0_16px_rgba(199,167,108,0.2)]"
                    )}>
                      <span className="text-base font-semibold text-gold">{userInitial}</span>
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
                            ? "bg-gold/15 text-gold shadow-[0_0_12px_rgba(199,167,108,0.15)]" 
                            : "text-muted-foreground hover:text-foreground hover:bg-gold/5"
                        )}
                      >
                        <item.icon className="h-4.5 w-4.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}

                  <div className="pt-2">
                    <div className="h-px bg-border/30 my-2" />
                  </div>

                  {/* Profile & Settings in mobile nav */}
                  <button
                    onClick={() => navigate('/profile')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gold/5 transition-all duration-300"
                  >
                    <User className="h-4.5 w-4.5" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => navigate(hasBusiness ? '/business/settings' : '/settings')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gold/5 transition-all duration-300"
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
    </div>
  );
}
