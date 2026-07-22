import { useEffect, useState } from 'react';
import Chest from './Chest';
import { cn } from '../lib/cn';
import { useReducedMotion } from '../lib/useReducedMotion';

type ChestRevealProps = {
  className?: string;
  /** Delay before the lid springs open, in ms. */
  delay?: number;
};

/**
 * A treasure chest that opens: it shows closed, then swaps to the open, spilling
 * variant with a spring. Respecting reduced-motion, it starts open with no
 * animation. Confetti stays the caller's job so beats never double-fire.
 */
export default function ChestReveal({ className, delay = 280 }: ChestRevealProps) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setOpen(true);
      return;
    }
    setOpen(false);
    const timer = setTimeout(() => setOpen(true), delay);
    return () => clearTimeout(timer);
  }, [reduced, delay]);

  return (
    <Chest
      variant={open ? 'open' : 'closed'}
      className={cn(className, open && !reduced && 'motion-safe:animate-chest-open')}
    />
  );
}
