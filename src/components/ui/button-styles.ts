import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'md' | 'sm';

const base =
  'inline-flex items-center justify-center font-medium transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'rounded-xl bg-gold-500 text-ink hover:bg-gold-400',
  secondary: 'rounded-xl border-2 border-parchment-300 bg-parchment-50 text-ink hover:border-gold-400',
  outline: 'rounded-xl border-2 border-brand-200 bg-parchment-50 text-brand-700 hover:border-brand-400',
  ghost: 'rounded-lg text-slate-600 hover:bg-slate-100 hover:text-ink',
};

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-12 px-6 text-base',
  sm: 'min-h-11 px-5 text-sm',
};

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

/**
 * Returns the class string for a button-styled element. Exposed separately so
 * non-button elements (e.g. react-router `<Link>`) can share the same styling.
 * The `ghost` variant opts out of fixed sizing so callers control its padding.
 */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    base,
    variants[variant],
    variant !== 'ghost' && sizes[size],
    fullWidth && 'w-full',
    className,
  );
}
