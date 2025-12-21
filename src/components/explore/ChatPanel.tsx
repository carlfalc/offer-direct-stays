import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage, Property, GuestPreferences } from '@/types';
import PropertyCard from './PropertyCard';
import VoiceMicButton from '@/components/VoiceMicButton';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onPropertySelect: (property: Property) => void;
  shortlistedIds: string[];
}

export default function ChatPanel({ 
  messages, 
  onSendMessage, 
  isLoading,
  onPropertySelect,
  shortlistedIds
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showVoiceHint, setShowVoiceHint] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Hide voice hint after first message
  useEffect(() => {
    if (messages.length > 0) {
      setShowVoiceHint(false);
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
      setShowVoiceHint(false);
    }
  };

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(text);
    setShowVoiceHint(false);
  }, []);

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Find your perfect stay</h2>
        <p className="text-sm text-muted-foreground">
          Tell me where you'd like to go and I'll help you find accommodation
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="chat-bubble-assistant animate-fade-in">
              <p>
                Hello! I'm here to help you find the perfect accommodation in New Zealand or Australia. 
              </p>
              <p className="mt-2">
                Where would you like to stay? You can tell me about:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Your destination (city or region)</li>
                <li>• Travel dates</li>
                <li>• Number of guests</li>
                <li>• Any special requirements</li>
              </ul>
            </div>
          )}
          
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
                    : 'chat-bubble-assistant'
                }
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                
                {/* Property recommendations */}
                {message.properties && message.properties.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {message.properties.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        onSelect={() => onPropertySelect(property)}
                        isShortlisted={shortlistedIds.includes(property.id)}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="chat-bubble-assistant animate-fade-in">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border space-y-2">
        {/* Voice hint */}
        {showVoiceHint && (
          <p className="text-xs text-muted-foreground text-center">
            Prefer to talk? Tap the mic and tell us what you need.
          </p>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <VoiceMicButton 
            onTranscript={handleVoiceTranscript}
            disabled={isLoading}
          />
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!input.trim() || isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
