import { useState, useRef } from 'react';
import { Send, Mic, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

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
  const { isRecording, isTranscribing, isSupported, start, stopAndTranscribe } = useVoiceRecorder();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleVoiceClick = async () => {
    if (isTranscribing) return;
    if (isRecording) {
      const text = await stopAndTranscribe();
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
    } else {
      await start();
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
          disabled={isLoading || isTranscribing}
          aria-label={isRecording ? 'Tap to stop' : 'Tap to speak'}
          className={cn(
            "p-2 rounded-lg transition-all duration-200",
            isRecording
              ? "bg-primary text-primary-foreground animate-pulse"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {isTranscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
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
