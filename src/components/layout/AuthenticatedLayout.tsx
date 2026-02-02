import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  MapPin, LogOut, Heart, Plane, MessageSquare, Send, 
  LayoutDashboard, Settings, Building2, User, ChevronDown 
} from 'lucide-react';
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
  ];

  if (hasBusiness === true) {
    guestNavItems.push({ label: 'Business', path: '/business/dashboard', icon: Building2 });
  }

  const businessNavItems = [
    { label: 'Dashboard', path: '/business/dashboard', icon: LayoutDashboard },
    { label: 'Settings', path: '/business/settings', icon: Settings },
    { label: 'Messages', path: '/messages', icon: MessageSquare },
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
      <header className="h-16 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between px-6 flex-shrink-0 z-20">
        {/* Logo */}
        <button 
          onClick={() => navigate('/explore')}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-lg text-foreground tracking-tight">findastay</span>
        </button>
        
        <div className="flex items-center gap-1">
          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-1 mr-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          
          {/* Profile dropdown (desktop) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">{userInitial}</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Account</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">{userInitial}</span>
                </div>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-card">
              <div className="flex flex-col h-full">
                {/* User info */}
                <div className="py-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">{userInitial}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Account</p>
                      <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 space-y-1">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                          isActive 
                            ? "bg-primary/10 text-primary" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                {/* Sign out */}
                <div className="border-t border-border/50 pt-4">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
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
