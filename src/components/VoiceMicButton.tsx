import { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

const FIRST_USE_KEY = 'findastay_voice_first_use';

export default function VoiceMicButton({ onTranscript, disabled, className }: VoiceMicButtonProps) {
  const [showFirstUseTip, setShowFirstUseTip] = useState(false);
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    resetTranscript,
    isSupported,
    error 
  } = useSpeechRecognition();

  // Check first use
  useEffect(() => {
    const hasUsedBefore = localStorage.getItem(FIRST_USE_KEY);
    if (!hasUsedBefore) {
      setShowFirstUseTip(true);
    }
  }, []);

  // Update input when transcript changes
  useEffect(() => {
    if (transcript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      // Mark first use as complete
      if (showFirstUseTip) {
        localStorage.setItem(FIRST_USE_KEY, 'true');
        setShowFirstUseTip(false);
      }
      resetTranscript();
      startListening();
    }
  };

  if (!isSupported) {
    return null; // Don't show if not supported
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        size="icon"
        variant={isListening ? "default" : "outline"}
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "transition-all duration-200",
          isListening && "bg-primary text-primary-foreground animate-pulse-subtle"
        )}
        aria-label={isListening ? "Stop listening" : "Start voice input"}
      >
        {isListening ? (
          <Mic className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {/* Listening indicator */}
      {isListening && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-xs text-primary font-medium animate-pulse">
            Listening…
          </span>
        </div>
      )}

      {/* First use trust copy tooltip */}
      {showFirstUseTip && !isListening && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-card border border-border rounded-lg shadow-lg text-xs text-muted-foreground z-10">
          <p>We only listen while the mic is active. You can type anytime.</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-card" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-xs text-destructive">
            {error === 'not-allowed' ? 'Mic access denied' : 'Try again'}
          </span>
        </div>
      )}
    </div>
  );
}
