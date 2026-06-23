import { useRef, useCallback, useEffect, useState } from "react";
import {
  AUDIO_FADE_INTERVAL_MS,
  AUDIO_FADE_STEP,
  MUSIC_ACTIVE_VOLUME,
} from "../constants/constants";

export const useAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeIntervalRef = useRef<number | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio(`${import.meta.env.BASE_URL}main_theme.mp3`);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;
    setIsAudioReady(true);

    return () => {
      if (volumeIntervalRef.current !== null) {
        window.clearInterval(volumeIntervalRef.current);
        volumeIntervalRef.current = null;
      }
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const fadeAudio = useCallback((targetVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clampedTarget = Math.max(0, Math.min(1, targetVolume));

    if (volumeIntervalRef.current !== null) {
      window.clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }

    const step = AUDIO_FADE_STEP;
    const intervalDuration = AUDIO_FADE_INTERVAL_MS;

    volumeIntervalRef.current = window.setInterval(() => {
      if (!audioRef.current) {
        if (volumeIntervalRef.current !== null) {
          window.clearInterval(volumeIntervalRef.current);
          volumeIntervalRef.current = null;
        }
        return;
      }

      const currentVolume = audio.volume;
      const diff = clampedTarget - currentVolume;

      if (Math.abs(diff) <= step) {
        audio.volume = clampedTarget;
        if (volumeIntervalRef.current !== null) {
          window.clearInterval(volumeIntervalRef.current);
          volumeIntervalRef.current = null;
        }
        if (clampedTarget === 0) {
          audio.pause();
        }
        return;
      }

      audio.volume = currentVolume + Math.sign(diff) * step;
    }, intervalDuration);
  }, []);

  const playMusic = useCallback(
    (shouldPlay: boolean, isMuted: boolean) => {
      const audio = audioRef.current;
      if (!audio || !isAudioReady) return;

      const targetVolume =
        shouldPlay && !isMuted ? MUSIC_ACTIVE_VOLUME : 0;

      if (shouldPlay && !isMuted) {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Autoplay might be blocked; ignore errors.
          });
        }
      }

      fadeAudio(targetVolume);
    },
    [fadeAudio, isAudioReady],
  );

  return { playMusic, isAudioReady };
};
