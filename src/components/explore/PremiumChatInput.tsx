import { useState, useRef } from 'react';
import { Send, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useEffect } from 'react';

interface PremiumChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export default function PremiumChatInput({ 
  onSend, 
  isLoading, 
  placeholder = "Or type your request...",
  className 
}: PremiumChatInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    resetTranscript,
    isSupported 
  } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleVoiceClick = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={cn(
        "relative flex items-center gap-2 premium-input p-2",
        className
      )}
    >
      {isSupported && (
        <button
          type="button"
          onClick={handleVoiceClick}
          disabled={isLoading}
          className={cn(
            "p-2 rounded-lg transition-all duration-200",
            isListening 
              ? "bg-primary text-primary-foreground animate-pulse" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Mic className="w-5 h-5" />
        </button>
      )}
      
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
        className={cn(
          "flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground",
          "text-base py-2"
        )}
      />
      
      <button
        type="submit"
        disabled={!input.trim() || isLoading}
        className={cn(
          "p-2.5 rounded-lg transition-all duration-200",
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90 active:scale-95",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary"
        )}
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  );
}
