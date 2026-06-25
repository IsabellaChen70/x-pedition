import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type ProgressRingProps = {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  trackClassName?: string;
  indicatorClassName?: string;
  animate?: boolean;
  ariaLabel?: string;
  children?: ReactNode;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * An SVG ring that fills to value/max. The stroke animates from empty on mount
 * for an earned reveal; with reduced motion it renders filled immediately.
 */
export default function ProgressRing({
  value,
  max,
  size = 96,
  strokeWidth = 8,
  trackClassName = 'text-slate-200',
  indicatorClassName = 'text-brand-600',
  animate = true,
  ariaLabel,
  children,
}: ProgressRingProps) {
  const pct = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - pct);

  const [reduced] = useState(prefersReducedMotion);
  const [offset, setOffset] = useState(() =>
    animate && !prefersReducedMotion() ? circumference : targetOffset,
  );

  useEffect(() => {
    if (!animate || reduced) {
      setOffset(targetOffset);
      return;
    }
    const raf = requestAnimationFrame(() => setOffset(targetOffset));
    return () => cancelAnimationFrame(raf);
  }, [animate, reduced, targetOffset]);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          className={trackClassName}
          stroke="currentColor"
          fill="none"
          strokeWidth={strokeWidth}
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className={indicatorClassName}
          stroke="currentColor"
          fill="none"
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={reduced ? undefined : { transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
          {children}
        </div>
      )}
    </div>
  );
}
