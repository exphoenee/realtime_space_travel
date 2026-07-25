import { useRef, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import useShopStore from "../../state/useShopStore";
import styles from "./ShopScreen.module.css";

interface MusicPreviewButtonProps {
  file: string;
  title: string;
}

/**
 * Generates a simple melodic loop using the Web Audio API.
 * Each track gets a unique melody derived from its title hash.
 */
const generateMelody = (
  ctx: AudioContext,
  title: string,
): { nodes: AudioNode[]; stop: () => void } => {
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.15;
  masterGain.connect(ctx.destination);

  let seed = 0;
  for (let i = 0; i < title.length; i++) {
    seed = ((seed << 5) - seed + title.charCodeAt(i)) | 0;
  }
  const nextNote = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 12) / 12;
  };

  const baseFreq = 220 + (Math.abs(seed) % 220);
  const bpm = 120;
  const beatDuration = 60 / bpm;
  const noteLength = beatDuration / 2;
  const startTime = ctx.currentTime;
  const endTime = startTime + 6;

  const oscillators: OscillatorNode[] = [];

  for (let i = 0; i < 8; i++) {
    const noteOffset = nextNote();
    const freq = baseFreq * Math.pow(2, noteOffset);
    const t = startTime + i * noteLength * 2;
    if (t >= endTime) break;

    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    osc.type = i % 3 === 0 ? "triangle" : i % 3 === 1 ? "sine" : "square";
    osc.frequency.value = freq;
    noteGain.gain.setValueAtTime(0, t);
    noteGain.gain.linearRampToValueAtTime(0.8, t + 0.02);
    noteGain.gain.linearRampToValueAtTime(0.6, t + noteLength * 0.5);
    noteGain.gain.linearRampToValueAtTime(0, t + noteLength);
    osc.connect(noteGain);
    noteGain.connect(masterGain);
    osc.start(t);
    osc.stop(t + noteLength + 0.05);
    oscillators.push(osc);
  }

  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = "sawtooth";
  bass.frequency.value = baseFreq / 4;
  bassGain.gain.setValueAtTime(0, startTime);
  bassGain.gain.linearRampToValueAtTime(0.04, startTime + 0.3);
  bassGain.gain.linearRampToValueAtTime(0.04, endTime - 0.3);
  bassGain.gain.linearRampToValueAtTime(0, endTime);
  bass.connect(bassGain);
  bassGain.connect(masterGain);
  bass.start(startTime);
  bass.stop(endTime + 0.1);
  oscillators.push(bass);

  return {
    nodes: [masterGain, ...oscillators],
    stop: () => {
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.1);
      setTimeout(() => {
        oscillators.forEach((o) => {
          try { o.stop(); } catch { /* already stopped */ }
        });
      }, 150);
    },
  };
};

// Module-level: only one music preview at a time across all buttons
let globalStopPreview: (() => void) | null = null;

const stopGlobalPreview = () => {
  globalStopPreview?.();
  globalStopPreview = null;
};

const MusicPreviewButton = ({ file, title }: MusicPreviewButtonProps) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const melodyRef = useRef<{ stop: () => void } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const setPreviewing = useShopStore((s) => s.setPreviewing);
  const setActivePreviewId = useShopStore((s) => s.setActivePreviewId);
  const activePreviewId = useShopStore((s) => s.activePreviewId);

  // Define stop callback FIRST so effects below can reference it cleanly
  const stopLocalPlayback = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    melodyRef.current?.stop();
    melodyRef.current = null;
    setIsPlaying(false);
    setPreviewing(false);
    setActivePreviewId(null);
    if (globalStopPreview === stopLocalPlayback) {
      globalStopPreview = null;
    }
  }, [setPreviewing, setActivePreviewId]);

  // If another button started playing, force-stop this one
  useEffect(() => {
    if (isPlaying && activePreviewId !== title) {
      stopLocalPlayback();
    }
  }, [activePreviewId, isPlaying, title, stopLocalPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      melodyRef.current?.stop();
      ctxRef.current?.close();
      ctxRef.current = null;
      // Always clear the global ref so no dangling references remain
      globalStopPreview = null;
    };
  }, []);

  const startPlayback = useCallback(async () => {
    // Stop any existing preview first (synchronous — no race window)
    stopGlobalPreview();

    // Try loading the audio file first
    if (file) {
      const url = `${import.meta.env.BASE_URL}music/${file}`;
      try {
        const response = await fetch(url, { method: "HEAD" });
        if (response.ok) {
          const audio = new Audio(url);
          audio.loop = false;
          audio.volume = 0.5;

          audio.onended = () => {
            setIsPlaying(false);
            setPreviewing(false);
            setActivePreviewId(null);
            audioRef.current = null;
            if (globalStopPreview === stopLocalPlayback) {
              globalStopPreview = null;
            }
          };

          await audio.play();
          // Guard: if another preview started while we were awaiting, bail
          if (globalStopPreview !== null) return;
          audioRef.current = audio;
          globalStopPreview = stopLocalPlayback;
          setIsPlaying(true);
          setPreviewing(true);
          setActivePreviewId(title);
          return;
        }
      } catch {
        // File not available — fall through to Web Audio
      }
    }

    // Fallback: generate a melody with the Web Audio API
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Guard: if another preview started while we were awaiting, bail
      if (globalStopPreview !== null) return;

      const melody = generateMelody(ctx, title);
      melodyRef.current = melody;
      globalStopPreview = stopLocalPlayback;
      setIsPlaying(true);
      setPreviewing(true);
      setActivePreviewId(title);

      // Auto-stop after 6 seconds
      setTimeout(() => {
        if (melodyRef.current === melody) {
          stopLocalPlayback();
        }
      }, 6000);
    } catch {
      console.warn(`Music preview unavailable for: ${title}`);
    }
  }, [file, title, setPreviewing, setActivePreviewId, stopLocalPlayback]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      stopLocalPlayback();
    } else {
      startPlayback();
    }
  };

  return (
    <button
      type="button"
      className={`${styles.previewBtn} ${isPlaying ? styles.previewBtnPlaying : ""}`}
      onClick={handleToggle}
      title={title}
      aria-label={isPlaying ? t("shop.preview.stop") : t("shop.preview.play")}
    >
      {isPlaying ? "⏹" : "▶️"}{" "}
      {isPlaying ? t("shop.preview.stop") : t("shop.preview.play")}
    </button>
  );
};

export default MusicPreviewButton;
