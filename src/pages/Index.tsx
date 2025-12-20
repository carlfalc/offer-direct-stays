import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MapPin, Search, Sparkles, Shield, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to explore
  useEffect(() => {
    if (!loading && user) {
      navigate('/explore');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold text-foreground">findastay</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/auth')}>
              Log In
            </Button>
            <Button onClick={() => navigate('/auth')} className="bg-primary hover:bg-primary/90">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Find Your Perfect Stay,{' '}
              <span className="text-primary">Your Way</span>
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Discover accommodation across New Zealand and Australia. Chat with AI to find your ideal property, then make an offer that works for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8"
              >
                Start Exploring
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/auth')}
                className="text-lg px-8"
              >
                I'm a Business
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Search className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Discover</h3>
              <p className="text-muted-foreground">
                Tell our AI assistant where you want to go, and get personalized property recommendations on an interactive map.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Make an Offer</h3>
              <p className="text-muted-foreground">
                Get AI-guided pricing suggestions and submit offers directly to accommodation providers. No middleman fees.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-success/20 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-7 w-7 text-success" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Book with Confidence</h3>
              <p className="text-muted-foreground">
                Once accepted, connect directly with the provider. Secure messaging keeps your details safe until confirmation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Find Your Stay?</h2>
            <p className="text-muted-foreground mb-8">
              Join thousands of travelers discovering better accommodation deals.
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="bg-primary hover:bg-primary/90 text-lg px-8"
            >
              Get Started for Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <span className="font-semibold">findastay</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} findastay. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
