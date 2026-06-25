import { useEffect, useState } from 'react';
import type { ScaleItem, ScaleVisualConfig, ShapeKind } from '../types/lesson';
import { SHAPE_COLORS, shapeLabel } from '../lib/scale';

type BalanceScaleProps = {
  config: ScaleVisualConfig;
  /** When true (default), the beam stays level; equations in lessons are balanced. */
  balanced?: boolean;
  /** Show the running total under each pan (default true). */
  showTotals?: boolean;
  /** Bump this number to make the beam wobble (e.g. after weights are removed). */
  wobbleSignal?: number;
  /** While set, float a "-N lb" chip up off each pan to show weight leaving. */
  removingValue?: number;
  /** Reserve extra space above the beam for a dramatic topple (interactive step only). */
  headroom?: boolean;
};

const PAN_WIDTH = 140;
const PAN_HEIGHT = 12;

export default function BalanceScale({
  config,
  balanced = true,
  showTotals = true,
  wobbleSignal,
  removingValue,
  headroom = false,
}: BalanceScaleProps) {
  const [wobbling, setWobbling] = useState(false);

  useEffect(() => {
    if (wobbleSignal === undefined || wobbleSignal === 0) {
      return;
    }
    setWobbling(true);
    const timer = window.setTimeout(() => setWobbling(false), 700);
    return () => window.clearTimeout(timer);
  }, [wobbleSignal]);

  const leftLb = sumWeightBlocks(config.left);
  const rightLb = sumWeightBlocks(config.right);
  const diff = rightLb - leftLb;
  // When unbalanced, tip dramatically toward the heavier side so it clearly topples.
  const tilt =
    balanced || diff === 0
      ? 0
      : Math.sign(diff) * Math.min(26, Math.max(16, Math.abs(diff) * 2.2));

  const showChips = removingValue !== undefined && removingValue > 0;
  // Crop the empty space above the beam. The interactive scale can topple, so it
  // keeps extra headroom; every other use is compact.
  const viewBox = headroom ? '0 48 360 172' : '0 100 360 120';

  return (
    <div className="w-full">
      <div className="relative mx-auto w-full max-w-[360px] sm:max-w-[500px]">
        {showChips && (
          <>
            <RemovalChip value={removingValue} left="19%" />
            <RemovalChip value={removingValue} left="81%" />
          </>
        )}
      <svg
        viewBox={viewBox}
        className="h-auto w-full"
        role="img"
        aria-label="Balance scale"
      >
        {/* Stand */}
        <rect x="172" y="150" width="16" height="60" rx="4" fill="#8a5a34" />
        <ellipse cx="180" cy="212" rx="48" ry="8" fill="#c8a06e" />

        {/* Beam */}
        <g
          className={`scale-beam${wobbling ? ' scale-wobble' : ''}`}
          style={{ transform: `rotate(${tilt}deg)` }}
        >
          <rect x="40" y="126" width="280" height="8" rx="4" fill="#6f4a2a" />
          <circle cx="180" cy="130" r="10" fill="#4a3018" />

          {/* Left pan */}
          <g transform="translate(70 130)">
            <line x1="0" y1="0" x2="0" y2="36" stroke="#8a5a34" strokeWidth="3" />
            <rect
              x={-PAN_WIDTH / 2}
              y="36"
              width={PAN_WIDTH}
              height={PAN_HEIGHT}
              rx="4"
              fill="#e3c79c"
              stroke="#8a5a34"
            />
            <PanItems items={config.left} x={0} y={28} />
          </g>

          {/* Right pan */}
          <g transform="translate(290 130)">
            <line x1="0" y1="0" x2="0" y2="36" stroke="#8a5a34" strokeWidth="3" />
            <rect
              x={-PAN_WIDTH / 2}
              y="36"
              width={PAN_WIDTH}
              height={PAN_HEIGHT}
              rx="4"
              fill="#e3c79c"
              stroke="#8a5a34"
            />
            <PanItems items={config.right} x={0} y={28} />
          </g>
        </g>
      </svg>
      </div>
      {showTotals && (
        <div className="mx-auto flex w-full max-w-[360px] justify-between gap-2 px-2 sm:max-w-[500px]">
          <SideTotal label={describeSide(config.left)} />
          <SideTotal label={describeSide(config.right)} />
        </div>
      )}
    </div>
  );
}

function SideTotal({ label }: { label: string }) {
  return (
    <span className="nums flex-1 rounded-lg bg-parchment-100 px-2 py-1 text-center text-sm font-semibold text-ink">
      {label}
    </span>
  );
}

function RemovalChip({ value, left }: { value: number; left: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-[58%] z-10 -translate-x-1/2 rounded-lg border border-amber-400 bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-800 shadow-sm motion-safe:animate-lift-off"
      style={{ left }}
    >
      −{value} lb
    </span>
  );
}

function describeSide(items: ScaleItem[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (item.kind === 'weight') {
      parts.push(`${item.value} lb`);
    } else if (item.kind === 'unknown') {
      parts.push(item.label ?? '?');
    } else {
      const name = shapeLabel(item.shape).toLowerCase();
      parts.push(`${item.count} ${pluralize(name, item.count)}`);
    }
  }
  return parts.length > 0 ? parts.join(' + ') : 'empty';
}

function pluralize(noun: string, count: number): string {
  if (count === 1) {
    return noun;
  }
  // "box" -> "boxes"; words ending in s/x/ch/sh take "es".
  return /(?:s|x|ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`;
}

function PanItems({ items, x, y }: { items: ScaleItem[]; x: number; y: number }) {
  const expanded = expandItems(items);
  const spacing = Math.min(26, (PAN_WIDTH - 16) / Math.max(expanded.length, 1));
  const startX = x - ((expanded.length - 1) * spacing) / 2;

  return (
    <g>
      {expanded.map((item, index) => (
        <ItemGlyph
          key={`${item.key}-${index}`}
          item={item}
          x={startX + index * spacing}
          y={y}
        />
      ))}
    </g>
  );
}

type ExpandedItem =
  | { key: string; kind: 'shape'; shape: ShapeKind }
  | { key: string; kind: 'weight'; value: number }
  | { key: string; kind: 'unknown'; label: string };

function expandItems(items: ScaleItem[]): ExpandedItem[] {
  const result: ExpandedItem[] = [];
  for (const item of items) {
    if (item.kind === 'shape') {
      for (let i = 0; i < item.count; i++) {
        result.push({ key: `${item.shape}-${i}`, kind: 'shape', shape: item.shape });
      }
    } else if (item.kind === 'weight') {
      result.push({ key: `w-${item.value}`, kind: 'weight', value: item.value });
    } else {
      result.push({ key: 'unknown', kind: 'unknown', label: item.label ?? '?' });
    }
  }
  return result;
}

function ItemGlyph({ item, x, y }: { item: ExpandedItem; x: number; y: number }) {
  if (item.kind === 'unknown') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect x="-18" y="-22" width="36" height="36" rx="6" fill="#f7ddcb" stroke="#a94c22" strokeWidth="2" />
        <text textAnchor="middle" y="4" fontSize="18" fontWeight="700" fill="#8a3e1f">
          {item.label}
        </text>
      </g>
    );
  }

  if (item.kind === 'weight') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect x="-16" y="-18" width="32" height="28" rx="4" fill="#ffda7a" stroke="#a06713" strokeWidth="2" />
        <text textAnchor="middle" y="2" fontSize="11" fontWeight="600" fill="#7a4d12">
          {item.value} lb
        </text>
      </g>
    );
  }

  const color = SHAPE_COLORS[item.shape];
  const label = shapeLabel(item.shape)[0];

  if (item.shape === 'triangle') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <polygon points="0,-20 18,14 -18,14" fill={color} stroke="#78350f" strokeWidth="1.5" />
        <text textAnchor="middle" y="6" fontSize="10" fontWeight="700" fill="white">
          {label}
        </text>
      </g>
    );
  }

  if (item.shape === 'circle') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r="16" fill={color} stroke="#5b21b6" strokeWidth="1.5" />
        <text textAnchor="middle" y="5" fontSize="10" fontWeight="700" fill="white">
          {label}
        </text>
      </g>
    );
  }

  if (item.shape === 'square' || item.shape === 'box') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect
          x="-16"
          y="-16"
          width="32"
          height="32"
          rx={item.shape === 'box' ? 4 : 2}
          fill={color}
          stroke="#334155"
          strokeWidth="1.5"
        />
        <text textAnchor="middle" y="5" fontSize="10" fontWeight="700" fill="white">
          {label}
        </text>
      </g>
    );
  }

  return null;
}

function sumWeightBlocks(items: ScaleItem[]): number {
  return items.reduce((sum, item) => (item.kind === 'weight' ? sum + item.value : sum), 0);
}
