import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MapPin, LogOut, Heart, Plane, MessageSquare, Send, LayoutDashboard, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface AuthenticatedLayoutProps {
  children: ReactNode;
  /** If true, content fills the full viewport without additional padding */
  fullHeight?: boolean;
}

export default function AuthenticatedLayout({ children, fullHeight = false }: AuthenticatedLayoutProps) {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Check if it's a business route
  const isBusinessRoute = location.pathname.startsWith('/business');

  const guestNavItems = [
    { label: 'My Offers', path: '/offers', icon: Send },
    { label: 'Watchlist', path: '/watchlist', icon: Heart },
    { label: 'Trips', path: '/trips', icon: Plane },
    { label: 'Messages', path: '/messages', icon: MessageSquare },
  ];

  const businessNavItems = [
    { label: 'Dashboard', path: '/business/dashboard', icon: LayoutDashboard },
    { label: 'Messages', path: '/messages', icon: MessageSquare },
  ];

  const navItems = isBusinessRoute ? businessNavItems : guestNavItems;

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
