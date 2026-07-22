/**
 * Subtle celebration sounds via the Web Audio API (no asset files). Off by
 * default and gated by the persisted sound preference, so nothing ever plays
 * unless the learner turns it on in Settings. Kept tiny and forgiving: if audio
 * isn't available it silently does nothing, and it never throws into the UI.
 */
import { isSoundEnabled } from './settings';

type WindowWithAudio = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const Ctor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return audioContext;
}

type Note = { freq: number; start: number; duration: number };

function playNotes(notes: Note[], peakGain: number): void {
  const ctx = getContext();
  if (!ctx) {
    return;
  }
  try {
    // Celebrations follow a tap (submit / continue), so resuming here is allowed.
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    for (const note of notes) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = note.freq;
      const startAt = now + note.start;
      const endAt = startAt + note.duration;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.03);
    }
  } catch {
    // Sound is a nicety; a failure here must never disrupt the lesson.
  }
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

/** A short, warm three-note rise for a win. No-op unless sound is enabled. */
export function playCelebration(): void {
  if (!isSoundEnabled()) {
    return;
  }
  playNotes(
    [
      { freq: C5, start: 0, duration: 0.16 },
      { freq: E5, start: 0.08, duration: 0.16 },
      { freq: G5, start: 0.16, duration: 0.26 },
    ],
    0.06,
  );
}

/** A slightly brighter four-note flourish reserved for a level-up. */
export function playLevelUp(): void {
  if (!isSoundEnabled()) {
    return;
  }
  playNotes(
    [
      { freq: C5, start: 0, duration: 0.14 },
      { freq: E5, start: 0.07, duration: 0.14 },
      { freq: G5, start: 0.14, duration: 0.14 },
      { freq: C6, start: 0.22, duration: 0.3 },
    ],
    0.07,
  );
}
