import confetti from 'canvas-confetti';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// A small, deliberate palette (brand blues plus one warm and one calm accent)
// so the burst reads as celebratory rather than a generic rainbow.
const CELEBRATION_COLORS = ['#2563eb', '#60a5fa', '#1d4ed8', '#f59e0b', '#34d399'];

const SHARED = {
  colors: CELEBRATION_COLORS,
  disableForReducedMotion: true,
  scalar: 0.9,
} as const;

/** A brief, warm burst for finishing a lesson. No-op when motion is reduced. */
export function fireConfetti(): void {
  if (prefersReducedMotion()) {
    return;
  }
  void confetti({
    ...SHARED,
    particleCount: 70,
    spread: 72,
    startVelocity: 40,
    ticks: 160,
    gravity: 1.1,
    origin: { x: 0.5, y: 0.6 },
  });
}

/** A slightly fuller, two-sided burst reserved for streak milestones. */
export function fireMilestoneConfetti(): void {
  if (prefersReducedMotion()) {
    return;
  }
  const base = { ...SHARED, ticks: 200, gravity: 1.05, scalar: 1 };
  void confetti({ ...base, particleCount: 90, spread: 90, startVelocity: 42, origin: { x: 0.5, y: 0.5 } });
  void confetti({ ...base, particleCount: 40, spread: 60, angle: 60, startVelocity: 45, origin: { x: 0, y: 0.7 } });
  void confetti({ ...base, particleCount: 40, spread: 60, angle: 120, startVelocity: 45, origin: { x: 1, y: 0.7 } });
}
