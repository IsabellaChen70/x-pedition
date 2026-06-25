import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type AlertVariant = 'info' | 'warning' | 'error';

const variants: Record<AlertVariant, string> = {
  info: 'border-brand-100 bg-brand-50 text-brand-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-800',
};

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
};

export function Alert({ variant = 'info', className, ...props }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border px-4 py-3 text-sm leading-relaxed',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
