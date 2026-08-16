"use client";

import { useCallback, useRef, useState } from "react";

export interface VoiceRecorderState {
  isRecording: boolean;
  duration: number;
  amplitudes: number[];
}

export interface UseVoiceRecorderReturn extends VoiceRecorderState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ blob: Blob; duration: number; amplitudes: number[] } | null>;
}

const SAMPLE_INTERVAL_MS = 100;
const MAX_SAMPLES = 300;

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [amplitudes, setAmplitudes] = useState<number[]>([]);
  const amplitudesRef = useRef<number[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100);
      setIsRecording(true);
      setDuration(0);
      setAmplitudes([]);
      amplitudesRef.current = [];
      startTimeRef.current = Date.now();

      /* Timer */
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      /* Amplitude sampler */
      sampleTimerRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAmplitudes((prev) => {
          const next = [...prev, avg / 255];
          const clamped = next.length > MAX_SAMPLES ? next.slice(-MAX_SAMPLES) : next;
          amplitudesRef.current = clamped;
          return clamped;
        });
      }, SAMPLE_INTERVAL_MS);
    } catch (err) {
      console.error("[useVoiceRecorder] startRecording error:", err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    return new Promise<{ blob: Blob; duration: number; amplitudes: number[] } | null>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const dur = Math.floor((Date.now() - startTimeRef.current) / 1000);

        /* Stop all tracks */
        recorder.stream.getTracks().forEach((t) => t.stop());

        /* Cleanup refs */
        if (timerRef.current) clearInterval(timerRef.current);
        if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        analyserRef.current = null;
        mediaRecorderRef.current = null;

        setIsRecording(false);
        setDuration(0);

        const amps = [...amplitudesRef.current];
        resolve({ blob, duration: dur, amplitudes: amps });
      };
      recorder.stop();
    });
  }, []);

  return { isRecording, duration, amplitudes, startRecording, stopRecording };
}
