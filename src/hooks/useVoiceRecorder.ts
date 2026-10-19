import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  error: string | null;
  isSupported: boolean;
  start: () => Promise<void>;
  stopAndTranscribe: () => Promise<string>;
  cancel: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || ''); // strip "data:...;base64,"
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Records mic audio and transcribes it via the `transcribe` edge function (OpenAI Whisper).
 * One recorder per component; no browser single-engine conflict like the Web Speech API.
 */
export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    setError(null);
    if (!isSupported) {
      setError('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (e: any) {
      cleanupStream();
      const name = e?.name || '';
      setError(name === 'NotAllowedError' ? 'not-allowed' : name === 'NotFoundError' ? 'no-mic' : 'mic-error');
    }
  }, [isSupported]);

  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    const recorder = recorderRef.current;
    if (!recorder) return '';
    setIsRecording(false);

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
      }
    });
    cleanupStream();
    recorderRef.current = null;

    if (!blob.size) return '';

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
      return String(data.text || '').trim();
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
    cleanupStream();
    recorderRef.current = null;
    setIsRecording(false);
    setIsTranscribing(false);
  }, []);

  return { isRecording, isTranscribing, error, isSupported, start, stopAndTranscribe, cancel };
}
