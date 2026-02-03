import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTrip } from '@/contexts/TripContext';
import { supabase } from '@/integrations/supabase/client';
import { Property, ChatMessage, ShortlistItem, Room } from '@/types';
import ChatPanel from '@/components/explore/ChatPanel';
import MapPanel from '@/components/explore/MapPanel';
import ShortlistPanel from '@/components/explore/ShortlistPanel';
import TripSummaryBar from '@/components/explore/TripSummaryBar';
import PropertyDetailSheet from '@/components/explore/PropertyDetailSheet';
import OfferModal from '@/components/explore/OfferModal';
import { PostStayReviewModal, ReviewPayload } from '@/components/review';
import { Button } from '@/components/ui/button';
import { MapPin, LogOut, Menu, Heart, Plane, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function Explore() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { trip, setDestination, setCheckIn, setCheckOut, getPropertyPriceEstimate } = useTrip();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);
  const [watchlistedIds, setWatchlistedIds] = useState<string[]>([]);
  const [mapboxToken, setMapboxToken] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // Property detail sheet
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Offer modal
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerProperty, setOfferProperty] = useState<Property | null>(null);
  const [offerRoom, setOfferRoom] = useState<Room | null>(null);
  const [sentOfferIds, setSentOfferIds] = useState<string[]>([]);

  // Post-stay review modal (demo trigger)
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Load properties and watchlist on mount
  useEffect(() => {
    if (user) {
      loadProperties();
      loadWatchlist();
    }
  }, [user]);

  const loadProperties = async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading properties:', error);
      toast({
        title: 'Error',
        description: 'Failed to load properties',
        variant: 'destructive',
      });
    } else if (data) {
      setProperties(data as Property[]);
    }
  };

  const loadWatchlist = async () => {
    const { data, error } = await supabase
      .from('watchlists')
      .select('property_id')
      .eq('user_id', user?.id);

    if (!error && data) {
      setWatchlistedIds(data.map((w: any) => w.property_id));
    }
  };

  const logPropertyEvent = async (propertyId: string, eventType: string, metadata?: Record<string, any>) => {
    if (!user) return;
    const { error } = await supabase.from('property_events').insert({
      property_id: propertyId,
      user_id: user.id,
      event_type: eventType,
      metadata: metadata || null,
    });
    if (error) console.warn('Event log failed', error.message);
  };

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Simple intent detection and response
    const lowerContent = content.toLowerCase();
    let response = '';
    let recommendedProperties: Property[] = [];

    // City destinations with coordinates
    const cityData: Record<string, { lat: number; lng: number; country: 'NZ' | 'AU' }> = {
      auckland: { lat: -36.8485, lng: 174.7633, country: 'NZ' },
      wellington: { lat: -41.2865, lng: 174.7762, country: 'NZ' },
      christchurch: { lat: -43.5321, lng: 172.6362, country: 'NZ' },
      queenstown: { lat: -45.0312, lng: 168.6626, country: 'NZ' },
      rotorua: { lat: -38.1368, lng: 176.2497, country: 'NZ' },
      sydney: { lat: -33.8688, lng: 151.2093, country: 'AU' },
      melbourne: { lat: -37.8136, lng: 144.9631, country: 'AU' },
      brisbane: { lat: -27.4698, lng: 153.0251, country: 'AU' },
      'gold coast': { lat: -28.0167, lng: 153.4000, country: 'AU' },
      perth: { lat: -31.9505, lng: 115.8605, country: 'AU' },
    };

    // Check for destination keywords
    const matchedCity = Object.keys(cityData).find(city => lowerContent.includes(city));

    if (matchedCity) {
      const cityInfo = cityData[matchedCity];
      
      // Update trip context
      setDestination({
        city: matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1),
        country: cityInfo.country,
        latitude: cityInfo.lat,
        longitude: cityInfo.lng,
        radius: 50,
      });

      recommendedProperties = properties.filter(
        p => p.city.toLowerCase().includes(matchedCity) || p.country === cityInfo.country
      ).slice(0, 5);

      if (recommendedProperties.length > 0) {
        response = `Great choice — I found ${recommendedProperties.length} properties in ${matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1)}.\n\nI’ll show them on the map. You can move it anytime to explore nearby options.\n\nIf you want, I can also suggest an average offer price you might consider.`;
      } else {
        response = `I couldn't find any properties in ${matchedCity} right now. Want to try another destination?`;
      }
    } else if (lowerContent.includes('new zealand') || lowerContent.includes('nz')) {
      setDestination({
        city: 'New Zealand',
        country: 'NZ',
        latitude: -41.5,
        longitude: 172.5,
        radius: 500,
      });
      recommendedProperties = properties.filter(p => p.country === 'NZ').slice(0, 5);
      response = `Here are some great options across New Zealand.\n\nYou can explore them on the map — it’s fully interactive.`;
    } else if (lowerContent.includes('australia') || lowerContent.includes('au')) {
      setDestination({
        city: 'Australia',
        country: 'AU',
        latitude: -25.2744,
        longitude: 133.7751,
        radius: 1000,
      });
      recommendedProperties = properties.filter(p => p.country === 'AU').slice(0, 5);
      response = `Here are some great options across Australia.\n\nYou can explore them on the map — it’s fully interactive.`;
    } else if (lowerContent.includes('hello') || lowerContent.includes('hi') || lowerContent.includes('hey')) {
      response = `Hey — I’m here to make this fast, easy, and smarter than regular booking sites.\n\nWhere are you thinking of going?`;
    } else {
      response = `Let’s hit the ground running.\n\nTell me:\n• **Where** are you heading?\n• **When** are you looking to travel?\n• **How many** guests?\n\nYou can say: “Gold Coast, March 22, two adults.”`;
    }

    // Simulate AI thinking delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      properties: recommendedProperties.length > 0 ? recommendedProperties : undefined,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const handlePropertySelect = (property: Property) => {
    const isAlreadyShortlisted = shortlist.some(item => item.property.id === property.id);
    
    if (isAlreadyShortlisted) {
      setShortlist(prev => prev.filter(item => item.property.id !== property.id));
      toast({ description: `${property.name} removed from shortlist` });
      logPropertyEvent(property.id, 'shortlist_remove');
    } else {
      setShortlist(prev => [...prev, { property }]);
      toast({ description: `${property.name} added to shortlist` });
      logPropertyEvent(property.id, 'shortlist_add');
    }
    
    setSelectedPropertyId(property.id);
    logPropertyEvent(property.id, 'property_select');
  };

  const handlePropertyPinClick = (property: Property) => {
    setDetailProperty(property);
    setDetailSheetOpen(true);
    setSelectedPropertyId(property.id);
    logPropertyEvent(property.id, 'property_view', { source: 'map_pin' });
  };

  const handleAddToWatchlist = async (property: Property) => {
    if (!user) return;

    const isWatchlisted = watchlistedIds.includes(property.id);

    if (isWatchlisted) {
      // Remove from watchlist
      const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('user_id', user.id)
        .eq('property_id', property.id);

      if (error) {
        toast({ title: 'Error', description: 'Failed to remove from watchlist', variant: 'destructive' });
      } else {
        setWatchlistedIds(prev => prev.filter(id => id !== property.id));
        toast({ description: `${property.name} removed from watchlist` });
        logPropertyEvent(property.id, 'watchlist_remove');
      }
    } else {
      // Add to watchlist
      const { error } = await supabase
        .from('watchlists')
        .insert({ user_id: user.id, property_id: property.id });

      if (error) {
        toast({ title: 'Error', description: 'Failed to add to watchlist', variant: 'destructive' });
      } else {
        setWatchlistedIds(prev => [...prev, property.id]);
        toast({ description: `${property.name} added to watchlist` });
        logPropertyEvent(property.id, 'watchlist_add');
      }
    }
  };

  const handleRemoveFromShortlist = (propertyId: string) => {
    setShortlist(prev => prev.filter(item => item.property.id !== propertyId));
  };

  const handleMakeOffer = (property: Property, room?: Room) => {
    setOfferProperty(property);
    setOfferRoom(room || null);
    setOfferModalOpen(true);
    setDetailSheetOpen(false);
  };

  const handleOfferSent = (propertyId: string) => {
    setSentOfferIds((prev) => [...prev, propertyId]);
  };

  const handleReviewSubmit = (review: ReviewPayload) => {
    console.log('Review submitted (business brain payload):', review);
    toast({
      title: 'Thank you!',
      description: 'Your feedback helps us improve recommendations.',
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const shortlistedIds = shortlist.map(item => item.property.id);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Demo: Post-stay review trigger button (floating) */}
      <button
        onClick={() => setReviewModalOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-gold to-gold/80 text-charcoal font-medium shadow-lg hover:shadow-xl hover:shadow-gold/20 transition-all duration-300"
      >
        <Star className="w-4 h-4" />
        <span className="hidden sm:inline">Demo Review</span>
      </button>

      {/* Trip Summary Bar */}
      <TripSummaryBar />

      {/* Main content - responsive layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left column: Chat/Hero panel */}
        <div className="flex-1 lg:flex-none lg:w-[480px] xl:w-[520px] flex flex-col overflow-hidden border-r border-border/50">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onPropertySelect={handlePropertySelect}
              onMakeOffer={handleMakeOffer}
              onAddToWatchlist={handleAddToWatchlist}
              shortlistedIds={shortlistedIds}
              watchlistedIds={watchlistedIds}
            />
          </div>
          <div className="flex-shrink-0">
            <ShortlistPanel
              items={shortlist}
              onRemove={handleRemoveFromShortlist}
              onMakeOffer={(p) => handleMakeOffer(p)}
              sentOfferIds={sentOfferIds}
            />
          </div>
        </div>

        {/* Right column: Map panel - hidden on mobile until messages exist */}
        <div className="hidden lg:block flex-1 relative min-w-0">
          <MapPanel
            properties={properties}
            selectedPropertyId={selectedPropertyId}
            shortlistedIds={shortlistedIds}
            watchlistedIds={watchlistedIds}
            onPropertySelect={handlePropertySelect}
            onPropertyClick={handlePropertyPinClick}
            mapboxToken={mapboxToken}
            onTokenChange={setMapboxToken}
          />
        </div>
      </div>

      {/* Property Detail Sheet (for pin clicks) */}
      <PropertyDetailSheet
        property={detailProperty}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onMakeOffer={handleMakeOffer}
        onAddToWatchlist={handleAddToWatchlist}
        isWatchlisted={detailProperty ? watchlistedIds.includes(detailProperty.id) : false}
      />

      {/* Offer Modal */}
      <OfferModal
        open={offerModalOpen}
        onOpenChange={setOfferModalOpen}
        property={offerProperty}
        initialAdults={trip.adults}
        initialChildren={trip.children}
        onOfferSent={handleOfferSent}
      />

      {/* Post-Stay Review Modal */}
      <PostStayReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        propertyName="The Grand Auckland"
        onSubmit={handleReviewSubmit}
      />
    </div>
  );
}
