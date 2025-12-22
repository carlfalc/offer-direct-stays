import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MapPin, LogOut, Heart, Plane, MessageSquare, Send, LayoutDashboard, Menu, Settings, Building2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthenticatedLayoutProps {
  children: ReactNode;
  /** If true, content fills the full viewport without additional padding */
  fullHeight?: boolean;
}

export default function AuthenticatedLayout({ children, fullHeight = false }: AuthenticatedLayoutProps) {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);

  // Check if user has a business record
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

  // Route guard for /business/* pages
  const isBusinessRoute = location.pathname.startsWith('/business');
  
  useEffect(() => {
    // Only run guard after we know hasBusiness status and user is loaded
    if (hasBusiness === null || authLoading) return;
    
    // If on business route but no business record, redirect to settings
    if (isBusinessRoute && hasBusiness === false && location.pathname !== '/business/settings') {
      toast({
        title: 'Business Profile Required',
        description: 'Create your business profile to access the Business Portal.',
      });
      navigate('/business/settings');
    }
  }, [hasBusiness, isBusinessRoute, location.pathname, authLoading, navigate, toast]);

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

  // Add Business Portal link if user has a business
  if (hasBusiness === true) {
    guestNavItems.push({ label: 'Business Portal', path: '/business/dashboard', icon: Building2 });
  }

  const businessNavItems = [
    { label: 'Dashboard', path: '/business/dashboard', icon: LayoutDashboard },
    { label: 'Settings', path: '/business/settings', icon: Settings },
    { label: 'Messages', path: '/messages', icon: MessageSquare },
  ];

  // Show business nav only if on business route AND has business record
  const navItems = (isBusinessRoute && hasBusiness === true) ? businessNavItems : guestNavItems;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-background ${fullHeight ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 flex-shrink-0 z-20">
        <button 
          onClick={() => navigate('/explore')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">findastay</span>
        </button>
        
        <div className="flex items-center gap-2">
          {/* Desktop navigation links */}
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant={location.pathname === item.path ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate(item.path)}
              className="hidden sm:flex"
            >
              <item.icon className="h-4 w-4 mr-1" />
              {item.label}
            </Button>
          ))}
          
          {/* Mobile navigation */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav className="flex flex-col gap-2 mt-6">
                {navItems.map((item) => (
                  <Button
                    key={item.path}
                    variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                    className="justify-start"
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                ))}
                <hr className="my-2 border-border" />
                <Button variant="ghost" className="justify-start text-destructive" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
          
          {/* Desktop sign out */}
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="hidden sm:flex">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
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
