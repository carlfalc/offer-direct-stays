import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  isSupported: boolean;
  error: string | null;
}

// SpeechRecognition types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldListenRef = useRef(false); // true while the user wants the mic open
  const finalRef = useRef(''); // committed (final) text so far

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition!;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-NZ';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript((finalRef.current + ' ' + interim).replace(/\s+/g, ' ').trim());
    };

    recognition.onerror = (event) => {
      const e = event.error;
      // Benign: a pause in speech, or our own stop/abort. Keep going — don't nag.
      if (e === 'no-speech' || e === 'aborted') return;
      // Real, fatal problems — surface these and stop.
      if (e === 'not-allowed' || e === 'service-not-allowed') {
        shouldListenRef.current = false;
        setError('not-allowed');
        setIsListening(false);
        return;
      }
      if (e === 'audio-capture') {
        shouldListenRef.current = false;
        setError('no-mic');
        setIsListening(false);
        return;
      }
      if (e === 'network') {
        // Surface this rather than silently retrying forever with no result.
        shouldListenRef.current = false;
        setError('network');
        setIsListening(false);
        return;
      }
      console.warn('Speech recognition:', e);
    };

    recognition.onend = () => {
      // Chrome ends the session on silence even in continuous mode — resume if the
      // user still has the mic open, so a pause never looks like a failure.
      if (shouldListenRef.current) {
        setTimeout(() => {
          if (shouldListenRef.current) {
            try {
              recognition.start();
            } catch {
              /* already starting — ignore */
            }
          }
        }, 150);
        return;
      }
      setIsListening(false);
    };

    return () => {
      shouldListenRef.current = false;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;
    setError(null);
    setTranscript('');
    finalRef.current = '';
    shouldListenRef.current = true;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // start() throws if it is already running — that's fine, we're listening.
      setIsListening(true);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    if (!recognitionRef.current) return;
    try {
      // abort() stops immediately (stop() can linger); the current transcript is already captured.
      recognitionRef.current.abort();
    } catch {
      /* ignore */
    }
  }, []);

  const resetTranscript = useCallback(() => {
    finalRef.current = '';
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
  };
}
