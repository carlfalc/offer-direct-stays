import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  error: string | null;
  isSupported: boolean;
  level: number; // live input level 0..1 (so the UI can prove it's hearing you)
  start: () => Promise<void>;
  stopAndTranscribe: () => Promise<string>;
  cancel: () => void;
}

// Whisper emits these on silence/empty audio — treat them as "no audio", never as a real request.
const HALLUCINATIONS = new Set([
  'thanks for watching', 'thank you for watching', 'thanks for watching everyone',
  'thank you', 'thanks', 'please subscribe', 'subscribe', 'you', 'bye', 'okay', 'ok',
]);

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxLevelRef = useRef(0);
  const startTimeRef = useRef(0);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevel(0);
  };

  const start = useCallback(async () => {
    setError(null);
    if (!isSupported) {
      setError('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      maxLevelRef.current = 0;
      startTimeRef.current = Date.now();

      // Live metering + silence detection
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new AC();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        let lastSet = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i++) {
            const d = Math.abs(buf[i] - 128);
            if (d > peak) peak = d;
          }
          if (peak > maxLevelRef.current) maxLevelRef.current = peak;
          const now = Date.now();
          if (now - lastSet > 80) {
            lastSet = now;
            setLevel(Math.min(1, peak / 60));
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        /* metering is optional */
      }

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start(1000); // collect chunks every second
      setIsRecording(true);
    } catch (e: any) {
      cleanup();
      const name = e?.name || '';
      setError(name === 'NotAllowedError' ? 'not-allowed' : name === 'NotFoundError' ? 'no-mic' : 'mic-error');
    }
  }, [isSupported]);

  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    const recorder = recorderRef.current;
    if (!recorder) return '';
    setIsRecording(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
      }
    });

    const duration = Date.now() - startTimeRef.current;
    const maxLevel = maxLevelRef.current;
    cleanup();
    recorderRef.current = null;

    // Guard: if nothing was actually heard, don't send silence to Whisper (it hallucinates).
    if (!blob.size || duration < 500 || maxLevel < 5) {
      setError('no-audio');
      return '';
    }

    setIsTranscribing(true);
    try {
      const base64 = await blobToBase64(blob);
      const { data, error: fnError } = await supabase.functions.invoke('transcribe', {
        body: { audio: base64, mime: blob.type },
      });
      if (fnError || !data) {
        setError('transcribe');
        return '';
      }
      const text = String(data.text || '').trim();
      const norm = text.toLowerCase().replace(/[.!?]+$/g, '').trim();
      if (!text || HALLUCINATIONS.has(norm)) {
        setError('no-audio');
        return '';
      }
      return text;
    } catch {
      setError('transcribe');
      return '';
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const cancel = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    cleanup();
    recorderRef.current = null;
    setIsRecording(false);
    setIsTranscribing(false);
  }, []);

  return { isRecording, isTranscribing, error, isSupported, level, start, stopAndTranscribe, cancel };
}
