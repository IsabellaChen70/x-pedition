import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type CardPadding = 'sm' | 'md' | 'lg';
type CardTone = 'flat' | 'elevated';

const paddings: Record<CardPadding, string> = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

// Parchment surfaces; only a primary surface lifts with a soft shadow.
const tones: Record<CardTone, string> = {
  flat: 'border border-parchment-300 bg-parchment-50',
  elevated: 'border border-parchment-300 bg-parchment-50 shadow-sm',
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: CardPadding;
  tone?: CardTone;
};

export function Card({ padding = 'md', tone = 'flat', className, ...props }: CardProps) {
  return (
    <div className={cn('rounded-2xl', tones[tone], paddings[padding], className)} {...props} />
  );
}
