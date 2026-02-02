import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage, Property, Room } from '@/types';
import PropertyResultCard from './PropertyResultCard';
import HeroMicButton from './HeroMicButton';
import QuickChips from './QuickChips';
import PremiumChatInput from './PremiumChatInput';
import { useTrip } from '@/contexts/TripContext';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onPropertySelect: (property: Property) => void;
  onMakeOffer: (property: Property, room?: Room) => void;
  onAddToWatchlist: (property: Property) => void;
  shortlistedIds: string[];
  watchlistedIds: string[];
}

export default function ChatPanel({ 
  messages, 
  onSendMessage, 
  isLoading,
  onPropertySelect,
  onMakeOffer,
  onAddToWatchlist,
  shortlistedIds,
  watchlistedIds
}: ChatPanelProps) {
  const [pendingVoiceText, setPendingVoiceText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { getPropertyPriceEstimate } = useTrip();
  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleVoiceTranscript = useCallback((text: string) => {
    setPendingVoiceText(text);
    // Auto-send after a brief pause for voice input
    if (text.trim()) {
      setTimeout(() => {
        onSendMessage(text.trim());
        setPendingVoiceText('');
      }, 500);
    }
  }, [onSendMessage]);

  const handleQuickChipSelect = (prompt: string) => {
    onSendMessage(prompt);
  };

  // Hero view (no messages yet)
  if (!hasMessages) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
          {/* Hero Header */}
          <div className="space-y-3 mb-10 animate-fade-in-up">
            <h1 className="text-4xl md:text-5xl font-semibold text-foreground tracking-tight">
              Find your <span className="text-gradient-gold">perfect stay</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Your AI-powered travel concierge. Speak or type to discover accommodation across Australia & New Zealand.
            </p>
          </div>

          {/* Glowing Mic CTA */}
          <div className="mb-10 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <HeroMicButton 
              onTranscript={handleVoiceTranscript}
              disabled={isLoading}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 w-full max-w-sm mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">or try a suggestion</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Quick Chips */}
          <QuickChips 
            onSelect={handleQuickChipSelect} 
            className="max-w-lg animate-fade-in"
          />

          {/* Secondary chat input */}
          <div className="w-full max-w-md mt-8 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <PremiumChatInput
              onSend={onSendMessage}
              isLoading={isLoading}
            />
          </div>

          {/* Trust copy */}
          <p className="mt-6 text-xs text-muted-foreground/70 max-w-sm">
            We only listen while the mic is active. Your searches are private and secure.
          </p>
        </div>
      </div>
    );
  }

  // Conversation view (has messages)
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <h2 className="font-semibold text-foreground">Your Concierge</h2>
        <p className="text-sm text-muted-foreground">
          Finding the perfect accommodation for you
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`animate-fade-in ${
                message.role === 'user' ? 'flex justify-end' : ''
              }`}
            >
              <div
                className={
                  message.role === 'user'
                    ? 'chat-bubble-user max-w-[85%]'
                    : 'chat-bubble-assistant max-w-full'
                }
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                
                {/* Property recommendations */}
                {message.properties && message.properties.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {message.properties.map((property) => (
                      <PropertyResultCard
                        key={property.id}
                        property={property}
                        onMakeOffer={() => onMakeOffer(property)}
                        onAddToWatchlist={() => onAddToWatchlist(property)}
                        isWatchlisted={watchlistedIds.includes(property.id)}
                        priceEstimate={getPropertyPriceEstimate(property.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="chat-bubble-assistant animate-fade-in">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-muted-foreground">Finding options for you...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border/50 bg-card/30 backdrop-blur-sm">
        <PremiumChatInput
          onSend={onSendMessage}
          isLoading={isLoading}
          placeholder="Continue the conversation..."
        />
      </div>
    </div>
  );
}
