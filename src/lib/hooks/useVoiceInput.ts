'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface UseVoiceInputOptions {
  onFinalTranscript: (text: string) => void;
  onInterimTranscript: (text: string) => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export function useVoiceInput({ onFinalTranscript, onInterimTranscript }: UseVoiceInputOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setIsSupported(false);
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || isRecording) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (e: any) => {
      let interim = '';
      let final_ = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final_ += t;
        else interim += t;
      }
      if (interim) onInterimTranscript(interim);
      if (final_) onFinalTranscript(final_);
    };
    recognition.onend = () => { setIsRecording(false); recognitionRef.current = null; };
    recognition.onerror = () => { setIsRecording(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording, onFinalTranscript, onInterimTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { isRecording, isSupported, start, stop };
}
