import { useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { cn } from '@/lib/utils';

interface HeroMicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function HeroMicButton({ onTranscript, disabled }: HeroMicButtonProps) {
  const [showTip, setShowTip] = useState(true);
  const { isRecording, isTranscribing, error, isSupported, level, start, stopAndTranscribe } = useVoiceRecorder();

  const handleClick = async () => {
    if (isTranscribing) return;
    if (isRecording) {
      // Tap to stop → transcribe everything captured, then send once.
      const text = await stopAndTranscribe();
      if (text) onTranscript(text);
    } else {
      setShowTip(false);
      await start();
    }
  };

  if (!isSupported) {
    return (
      <div className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
        Voice input isn't available in this browser. Just type your request below.
      </div>
    );
  }

  const errorText =
    error === 'not-allowed'
      ? 'Microphone blocked — allow mic access for this site'
      : error === 'no-mic'
      ? 'No microphone found — check your device'
      : error === 'no-audio'
      ? "I didn't hear anything — check your mic isn't muted or used by another app (e.g. your dictation tool)"
      : error === 'transcribe'
      ? "Couldn't transcribe that — try again"
      : error
      ? 'Please try again'
      : null;

  return (
    <div className="relative flex flex-col items-center">
      {/* Glowing rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={cn('absolute w-32 h-32 rounded-full bg-primary/10 transition-all duration-500', isRecording && 'animate-ping')} />
        <div className={cn('absolute w-28 h-28 rounded-full bg-primary/15 transition-all duration-700', isRecording && 'animate-ping animation-delay-200')} />
        <div className={cn('absolute w-24 h-24 rounded-full bg-primary/20 transition-all duration-1000', isRecording && 'animate-ping animation-delay-400')} />
      </div>

      {/* Main button */}
      <button
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        className={cn(
          'relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300',
          'bg-gradient-to-br from-primary to-primary/80',
          'hover:scale-105 active:scale-95',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isRecording ? 'animate-glow-pulse shadow-glow-gold' : 'shadow-lg hover:shadow-glow-gold',
        )}
        aria-label={isRecording ? 'Tap to stop' : 'Tap to speak'}
      >
        {isTranscribing ? (
          <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
        ) : isRecording ? (
          <Square className="w-7 h-7 text-primary-foreground fill-primary-foreground" />
        ) : (
          <Mic className="w-8 h-8 text-primary-foreground" />
        )}
      </button>

      {/* Status + live level */}
      <div className="mt-4 min-h-[1.5rem] flex flex-col items-center gap-2 text-center">
        {isTranscribing ? (
          <span className="text-primary font-medium">Transcribing…</span>
        ) : isRecording ? (
          <span className="text-primary font-medium">Listening… tap to stop</span>
        ) : errorText ? (
          <span className="text-destructive text-sm max-w-xs">{errorText}</span>
        ) : showTip ? (
          <span className="text-muted-foreground text-sm">Tap to speak your request</span>
        ) : null}

        {isRecording && (
          <div className="w-40 h-1.5 rounded-full bg-muted/40 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-primary transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
