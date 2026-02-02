import { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';

interface HeroMicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function HeroMicButton({ onTranscript, disabled }: HeroMicButtonProps) {
  const [showTip, setShowTip] = useState(true);
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    resetTranscript,
    isSupported,
    error 
  } = useSpeechRecognition();

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
      setShowTip(false);
      resetTranscript();
      startListening();
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* Glowing rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={cn(
          "absolute w-32 h-32 rounded-full bg-primary/10 transition-all duration-500",
          isListening && "animate-ping"
        )} />
        <div className={cn(
          "absolute w-28 h-28 rounded-full bg-primary/15 transition-all duration-700",
          isListening && "animate-ping animation-delay-200"
        )} />
        <div className={cn(
          "absolute w-24 h-24 rounded-full bg-primary/20 transition-all duration-1000",
          isListening && "animate-ping animation-delay-400"
        )} />
      </div>

      {/* Main button */}
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
          "bg-gradient-to-br from-primary to-primary/80",
          "hover:scale-105 active:scale-95",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isListening ? "animate-glow-pulse shadow-glow-gold" : "shadow-lg hover:shadow-glow-gold"
        )}
        aria-label={isListening ? "Stop listening" : "Start voice search"}
      >
        <Mic className={cn(
          "w-8 h-8 text-primary-foreground transition-transform",
          isListening && "scale-110"
        )} />
      </button>

      {/* Status text */}
      <div className="mt-4 h-6 flex items-center">
        {isListening ? (
          <span className="text-primary font-medium animate-pulse">
            Listening...
          </span>
        ) : error ? (
          <span className="text-destructive text-sm">
            {error === 'not-allowed' ? 'Microphone access denied' : 'Please try again'}
          </span>
        ) : showTip ? (
          <span className="text-muted-foreground text-sm">
            Tap to speak your request
          </span>
        ) : null}
      </div>
    </div>
  );
}
