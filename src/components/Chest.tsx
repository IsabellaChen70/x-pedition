import { useId } from 'react';

type ChestProps = {
  variant: 'open' | 'closed';
  className?: string;
};

const OUTLINE = '#43280f';
const GOLD_EDGE = '#a8701a';

/** A chunky, treasure-game chest. Closed locks the route; open spills the loot. */
export default function Chest({ variant, className }: ChestProps) {
  const uid = useId();
  const wood = `wood-${uid}`;
  const woodLid = `woodlid-${uid}`;
  const gold = `gold-${uid}`;
  const glow = `glow-${uid}`;

  return (
    <svg viewBox="0 0 64 58" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={wood} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9c6633" />
          <stop offset="1" stopColor="#6d421f" />
        </linearGradient>
        <linearGradient id={woodLid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b27c41" />
          <stop offset="1" stopColor="#8a5328" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe699" />
          <stop offset="0.5" stopColor="#f5c34c" />
          <stop offset="1" stopColor="#d4922a" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffeaa6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffeaa6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {variant === 'open' && <ellipse cx="32" cy="22" rx="27" ry="17" fill={`url(#${glow})`} />}

      {/* Lid: domed and shut, or flipped up to reveal the loot. */}
      {variant === 'closed' ? (
        <>
          <path
            d="M7 29 V20 C7 10 15 6 32 6 C49 6 57 10 57 20 V29 Z"
            fill={`url(#${woodLid})`}
            stroke={OUTLINE}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M14 13 C20 9.5 27 8.5 33 9"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.3"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <rect
            x="9"
            y="3.5"
            width="46"
            height="14"
            rx="6"
            fill={`url(#${woodLid})`}
            stroke={OUTLINE}
            strokeWidth="2.5"
          />
          <rect
            x="12"
            y="6"
            width="40"
            height="5"
            rx="2.5"
            fill={`url(#${gold})`}
            stroke={GOLD_EDGE}
            strokeWidth="1.1"
          />
        </>
      )}

      {/* Body */}
      <rect x="7" y="28" width="50" height="25" rx="6" fill={`url(#${wood})`} stroke={OUTLINE} strokeWidth="2.5" />
      {/* Seam band */}
      <rect x="5" y="26" width="54" height="7.5" rx="3.7" fill={`url(#${gold})`} stroke={GOLD_EDGE} strokeWidth="1.6" />
      {/* Body straps */}
      <rect x="14.5" y="33" width="6" height="20" rx="1.6" fill={`url(#${gold})`} stroke={GOLD_EDGE} strokeWidth="1.3" />
      <rect x="43.5" y="33" width="6" height="20" rx="1.6" fill={`url(#${gold})`} stroke={GOLD_EDGE} strokeWidth="1.3" />
      {/* Corner studs */}
      <circle cx="11" cy="50" r="1.7" fill={`url(#${gold})`} stroke={GOLD_EDGE} strokeWidth="0.8" />
      <circle cx="53" cy="50" r="1.7" fill={`url(#${gold})`} stroke={GOLD_EDGE} strokeWidth="0.8" />

      {variant === 'closed' ? (
        <>
          {/* Lock */}
          <rect x="26" y="27.5" width="12" height="13" rx="3.2" fill={`url(#${gold})`} stroke={GOLD_EDGE} strokeWidth="1.6" />
          <circle cx="32" cy="33" r="1.9" fill={OUTLINE} />
          <rect x="31" y="33.4" width="2" height="4.4" rx="1" fill={OUTLINE} />
          <Sparkle x={50} y={11} />
        </>
      ) : (
        <>
          {/* Loot spilling over the rim */}
          <g stroke={GOLD_EDGE} strokeWidth="1">
            <ellipse cx="19" cy="29" rx="6" ry="5" fill={`url(#${gold})`} />
            <ellipse cx="45" cy="29" rx="6" ry="5" fill={`url(#${gold})`} />
            <ellipse cx="32" cy="26.5" rx="7" ry="5.6" fill={`url(#${gold})`} />
            <ellipse cx="25.5" cy="31.5" rx="5.4" ry="4.5" fill={`url(#${gold})`} />
            <ellipse cx="39" cy="31.5" rx="5.4" ry="4.5" fill={`url(#${gold})`} />
          </g>
          <g fill="none" stroke={GOLD_EDGE} strokeWidth="0.8" opacity="0.55">
            <ellipse cx="32" cy="26.5" rx="3" ry="2.4" />
            <ellipse cx="19" cy="29" rx="2.4" ry="1.9" />
            <ellipse cx="45" cy="29" rx="2.4" ry="1.9" />
          </g>
          {/* Gems */}
          <path d="M31 19.5l3.2 2.2-3.2 3.3-3.2-3.3z" fill="#e84a3d" stroke="#a8281d" strokeWidth="0.9" strokeLinejoin="round" />
          <path d="M44 24l2.6 1.8-2.6 2.7-2.6-2.7z" fill="#3f8ae8" stroke="#1f57a8" strokeWidth="0.9" strokeLinejoin="round" />
          <Sparkle x={51} y={14} />
          <Sparkle x={13} y={18} small />
        </>
      )}
    </svg>
  );
}

function Sparkle({ x, y, small }: { x: number; y: number; small?: boolean }) {
  const r = small ? 2.2 : 3.2;
  const m = r * 0.32;
  return (
    <path
      className="motion-safe:animate-sparkle-twinkle"
      d={`M${x} ${y - r}L${x + m} ${y - m}L${x + r} ${y}L${x + m} ${y + m}L${x} ${y + r}L${x - m} ${y + m}L${x - r} ${y}L${x - m} ${y - m}Z`}
      fill="#fff8e1"
    />
  );
}
