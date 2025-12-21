import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Property, ChatMessage, ShortlistItem, GuestPreferences } from '@/types';
import ChatPanel from '@/components/explore/ChatPanel';
import MapPanel from '@/components/explore/MapPanel';
import ShortlistPanel from '@/components/explore/ShortlistPanel';
import OfferModal from '@/components/explore/OfferModal';
import { Button } from '@/components/ui/button';
import { MapPin, LogOut, Menu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function Explore() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);
  const [mapboxToken, setMapboxToken] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [preferences, setPreferences] = useState<GuestPreferences>({
    adults: 2,
    children: 0,
  });
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerProperty, setOfferProperty] = useState<Property | null>(null);
  const [sentOfferIds, setSentOfferIds] = useState<string[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Load properties on mount
  useEffect(() => {
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

    if (user) {
      loadProperties();
    }
  }, [user, toast]);

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

    // Check for destination keywords
    const nzCities = ['auckland', 'wellington', 'christchurch', 'queenstown', 'rotorua'];
    const auCities = ['sydney', 'melbourne', 'brisbane', 'gold coast', 'perth'];
    
    const mentionedNZCity = nzCities.find(city => lowerContent.includes(city));
    const mentionedAUCity = auCities.find(city => lowerContent.includes(city));

    if (mentionedNZCity || mentionedAUCity) {
      const city = mentionedNZCity || mentionedAUCity;
      const country = mentionedNZCity ? 'NZ' : 'AU';
      
      recommendedProperties = properties.filter(
        p => p.city.toLowerCase().includes(city!) || p.country === country
      ).slice(0, 5);

      if (recommendedProperties.length > 0) {
        response = `Great choice! I found ${recommendedProperties.length} properties in ${city?.charAt(0).toUpperCase()}${city?.slice(1)}. Here are my recommendations:\n\nClick on any property to add it to your shortlist, then you can make an offer.`;
      } else {
        response = `I couldn't find any properties in ${city} right now. Would you like to explore other destinations?`;
      }
    } else if (lowerContent.includes('new zealand') || lowerContent.includes('nz')) {
      recommendedProperties = properties.filter(p => p.country === 'NZ').slice(0, 5);
      response = `Here are some great options across New Zealand:\n\nClick on any property to add it to your shortlist.`;
    } else if (lowerContent.includes('australia') || lowerContent.includes('au')) {
      recommendedProperties = properties.filter(p => p.country === 'AU').slice(0, 5);
      response = `Here are some great options across Australia:\n\nClick on any property to add it to your shortlist.`;
    } else if (lowerContent.includes('room') || lowerContent.includes('recommend')) {
      if (shortlist.length > 0) {
        response = `Based on your party size of ${preferences.adults} adult${preferences.adults > 1 ? 's' : ''}${preferences.children > 0 ? ` and ${preferences.children} child${preferences.children > 1 ? 'ren' : ''}` : ''}, I'd recommend looking at the Deluxe or Family Suite options at your shortlisted properties.\n\nWould you like to proceed with making an offer?`;
      } else {
        response = `To recommend rooms, I'll need to know your preferences first. How many adults and children will be staying? And do you have any accessibility requirements or preferred amenities?`;
      }
    } else if (lowerContent.includes('offer') || lowerContent.includes('book')) {
      if (shortlist.length > 0) {
        response = `You have ${shortlist.length} ${shortlist.length === 1 ? 'property' : 'properties'} in your shortlist. Click "Make an Offer" below to proceed.\n\n💡 **Tip**: Guests typically start offers between NZ$180–$230 per night for similar stays. This is just a guide – providers may accept, counter, or decline your offer.`;
      } else {
        response = `You haven't shortlisted any properties yet. Tell me where you'd like to stay and I'll recommend some options!`;
      }
    } else if (lowerContent.includes('hello') || lowerContent.includes('hi') || lowerContent.includes('hey')) {
      response = `Hello! Welcome to findastay. I'm here to help you find the perfect accommodation.\n\nWhere would you like to stay? You can mention a city like Auckland, Sydney, Queenstown, or Melbourne – or just say "New Zealand" or "Australia" to browse options.`;
    } else {
      response = `I'd love to help you find accommodation! Could you tell me:\n\n• **Where** would you like to stay? (city or country)\n• **When** are you planning to travel?\n• **Who's** travelling? (number of guests)\n\nFor example, try saying "I'm looking for a hotel in Auckland for 2 adults"`;
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
      toast({
        description: `${property.name} removed from shortlist`,
      });
    } else {
      setShortlist(prev => [...prev, { property }]);
      toast({
        description: `${property.name} added to shortlist`,
      });
    }
    
    setSelectedPropertyId(property.id);
  };

  const handleRemoveFromShortlist = (propertyId: string) => {
    setShortlist(prev => prev.filter(item => item.property.id !== propertyId));
  };

  const handleMakeOffer = (property: Property) => {
    setOfferProperty(property);
    setOfferModalOpen(true);
  };

  const handleOfferSent = (propertyId: string) => {
    setSentOfferIds((prev) => [...prev, propertyId]);
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
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 flex-shrink-0 z-10">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">findastay</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mobile chat toggle */}
          <Sheet open={isMobileChatOpen} onOpenChange={setIsMobileChatOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:w-[400px] p-0">
              <div className="h-full flex flex-col">
                <ChatPanel
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  onPropertySelect={handlePropertySelect}
                  shortlistedIds={shortlistedIds}
                />
                <ShortlistPanel
                  items={shortlist}
                  onRemove={handleRemoveFromShortlist}
                  onMakeOffer={handleMakeOffer}
                  sentOfferIds={sentOfferIds}
                />
              </div>
            </SheetContent>
          </Sheet>
          
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main content - 2 column layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left column: Chat panel - desktop only */}
        <div className="hidden lg:flex lg:flex-col w-[400px] xl:w-[450px] flex-shrink-0 border-r border-border overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onPropertySelect={handlePropertySelect}
              shortlistedIds={shortlistedIds}
            />
          </div>
          <div className="flex-shrink-0">
            <ShortlistPanel
              items={shortlist}
              onRemove={handleRemoveFromShortlist}
              onMakeOffer={handleMakeOffer}
              sentOfferIds={sentOfferIds}
            />
          </div>
        </div>

        {/* Right column: Map panel */}
        <div className="flex-1 relative min-w-0">
          <MapPanel
            properties={properties}
            selectedPropertyId={selectedPropertyId}
            shortlistedIds={shortlistedIds}
            onPropertySelect={handlePropertySelect}
            mapboxToken={mapboxToken}
            onTokenChange={setMapboxToken}
          />
          
          {/* Mobile shortlist bar */}
          <div className="lg:hidden absolute bottom-0 left-0 right-0 z-10">
            <ShortlistPanel
              items={shortlist}
              onRemove={handleRemoveFromShortlist}
              onMakeOffer={handleMakeOffer}
              sentOfferIds={sentOfferIds}
            />
          </div>
        </div>
      </div>

      {/* Offer Modal */}
      <OfferModal
        open={offerModalOpen}
        onOpenChange={setOfferModalOpen}
        property={offerProperty}
        initialAdults={preferences.adults}
        initialChildren={preferences.children}
        onOfferSent={handleOfferSent}
      />
    </div>
  );
}
