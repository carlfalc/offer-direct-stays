import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Heart, ArrowLeft, Loader2 } from 'lucide-react';
import OfferModal from '@/components/explore/OfferModal';

interface WatchlistItem {
  id: string;
  property_id: string;
  created_at: string;
  property: Property;
}

export default function Watchlist() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerProperty, setOfferProperty] = useState<Property | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadWatchlist();
    }
  }, [user]);

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('watchlists')
        .select(`
          id,
          property_id,
          created_at,
          properties:property_id (*)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data
      const watchlistItems = (data || []).map((item: any) => ({
        id: item.id,
        property_id: item.property_id,
        created_at: item.created_at,
        property: item.properties as Property,
      }));

      setItems(watchlistItems);
    } catch (err) {
      console.error('Error loading watchlist:', err);
      toast({
        title: 'Error',
        description: 'Failed to load watchlist',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== itemId));
      toast({ description: 'Removed from watchlist' });
    } catch (err) {
      console.error('Error removing from watchlist:', err);
      toast({
        title: 'Error',
        description: 'Failed to remove from watchlist',
        variant: 'destructive',
      });
    }
  };

  const handleMakeOffer = (property: Property) => {
    setOfferProperty(property);
    setOfferModalOpen(true);
  };

  const propertyTypeLabels: Record<string, string> = {
    hotel: 'Hotel',
    motel: 'Motel',
    hostel: 'Hostel',
    apartment: 'Apartment',
    house: 'House',
    cabin: 'Cabin',
    resort: 'Resort',
    bnb: 'B&B',
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-destructive" />
            <span className="font-semibold">My Watchlist</span>
          </div>
        </div>
        
        <Button variant="ghost" size="sm" onClick={() => navigate('/explore')}>
          Explore
        </Button>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-medium mb-2">No saved properties</h2>
            <p className="text-muted-foreground mb-4">
              Add properties to your watchlist while exploring to keep track of your favourites.
            </p>
            <Button onClick={() => navigate('/explore')}>Start Exploring</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {items.length} saved {items.length === 1 ? 'property' : 'properties'}
            </p>

            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="flex gap-4 p-4">
                  {item.property.image_url && (
                    <img
                      src={item.property.image_url}
                      alt={item.property.name}
                      className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{item.property.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      <span>{item.property.city}, {item.property.country}</span>
                    </div>
                    
                    <div className="flex gap-1 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {propertyTypeLabels[item.property.property_type] || item.property.property_type}
                      </Badge>
                      {item.property.registration_status === 'registered' && (
                        <Badge variant="outline" className="text-xs text-success border-success">
                          Registered
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => handleMakeOffer(item.property)}>
                        Make an offer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemove(item.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <OfferModal
        open={offerModalOpen}
        onOpenChange={setOfferModalOpen}
        property={offerProperty}
        initialAdults={2}
        initialChildren={0}
        onOfferSent={() => {}}
      />
    </div>
  );
}
