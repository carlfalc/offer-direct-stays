import { useState, useEffect, useRef } from 'react';
import { Mic, Square } from 'lucide-react';
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
    error,
  } = useSpeechRecognition();

  // Keep the latest transcript in a ref so "stop" can read it after final results flush.
  const transcriptRef = useRef('');
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const handleClick = () => {
    if (isListening) {
      // Tap to STOP → send everything captured this session, once.
      stopListening();
      setTimeout(() => {
        const t = transcriptRef.current.trim();
        if (t) onTranscript(t);
        resetTranscript();
      }, 350);
    } else {
      // Tap to START
      setShowTip(false);
      resetTranscript();
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <div className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
        Voice input isn't supported in this browser. Try Chrome or Safari, or just type below.
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* Glowing rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={cn('absolute w-32 h-32 rounded-full bg-primary/10 transition-all duration-500', isListening && 'animate-ping')} />
        <div className={cn('absolute w-28 h-28 rounded-full bg-primary/15 transition-all duration-700', isListening && 'animate-ping animation-delay-200')} />
        <div className={cn('absolute w-24 h-24 rounded-full bg-primary/20 transition-all duration-1000', isListening && 'animate-ping animation-delay-400')} />
      </div>

      {/* Main button */}
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300',
          'bg-gradient-to-br from-primary to-primary/80',
          'hover:scale-105 active:scale-95',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isListening ? 'animate-glow-pulse shadow-glow-gold' : 'shadow-lg hover:shadow-glow-gold',
        )}
        aria-label={isListening ? 'Tap to stop' : 'Tap to speak'}
      >
        {isListening ? (
          <Square className="w-7 h-7 text-primary-foreground fill-primary-foreground" />
        ) : (
          <Mic className="w-8 h-8 text-primary-foreground" />
        )}
      </button>

      {/* Status + live preview */}
      <div className="mt-4 min-h-[2.5rem] flex flex-col items-center gap-1 text-center">
        {isListening ? (
          <span className="text-primary font-medium">Listening… tap to stop</span>
        ) : error ? (
          <span className="text-destructive text-sm max-w-xs">
            {error === 'not-allowed'
              ? 'Microphone blocked — allow mic access for this site in your browser'
              : error === 'no-mic'
              ? 'No microphone found — check your device'
              : error === 'network'
              ? "Couldn't reach the voice service — check your connection and try again"
              : 'Please try again'}
          </span>
        ) : showTip ? (
          <span className="text-muted-foreground text-sm">Tap to speak your request</span>
        ) : null}

        {isListening && transcript && (
          <span className="text-xs text-muted-foreground max-w-xs line-clamp-2">"{transcript}"</span>
        )}
      </div>
    </div>
  );
}
