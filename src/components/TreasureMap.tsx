import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import mapBg from '../assets/map-bg.jpg';
import Chest from './Chest';

type MapStopStatus = 'completed' | 'current' | 'unlocked' | 'locked';

type Point = { x: number; y: number };

export type MapStop = {
  id: string;
  label: string;
  status: MapStopStatus;
  to?: string;
  lockedReason?: string;
  progressLabel?: string | null;
};

export type MapSection = {
  id: string;
  topic: string;
  stops: MapStop[];
  treasureUnlocked: boolean;
  onOpenTreasure?: () => void;
};

type TreasureMapProps = {
  sections: MapSection[];
};

// A single trail that weaves gently down the center, one stop per row, with
// each section's treasure centered as a clear cap at its end.
const ROW_GAP = 110;
const ROW_GAP_MOBILE = 150;
const TOP_PAD = 110;
const BOTTOM_PAD = 80;
const WEAVE = 18; // gentle horizontal weave, in % of width
const WEAVE_FREQ = 0.9;

type Item =
  | { kind: 'stop'; key: string; stop: MapStop; number: number }
  | { kind: 'treasure'; key: string; sectionIndex: number };

/** One continuous, scrollable trail that snakes top-to-bottom through every
 *  lesson, dropping a treasure at the end of each section. Section names ride
 *  down the left edge as ribbon banners. */
export default function TreasureMap({ sections }: TreasureMapProps) {
  // Wider vertical spacing on phones, where the trail is a narrow single column.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const apply = () => setIsMobile(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  const rowGap = isMobile ? ROW_GAP_MOBILE : ROW_GAP;

  const items: Item[] = [];
  const sectionStart: number[] = [];
  sections.forEach((section, si) => {
    sectionStart.push(items.length);
    section.stops.forEach((stop, idx) =>
      items.push({ kind: 'stop', key: stop.id, stop, number: idx + 1 }),
    );
    items.push({ kind: 'treasure', key: `${section.id}-treasure`, sectionIndex: si });
  });

  const height = TOP_PAD + Math.max(0, items.length - 1) * rowGap + BOTTOM_PAD;
  const points: Point[] = items.map((item, i) => ({
    x: item.kind === 'treasure' ? 50 : 50 + WEAVE * Math.sin(i * WEAVE_FREQ),
    y: TOP_PAD + i * rowGap,
  }));

  const curveTo = (point: Point, prev: Point): string => {
    const midY = (prev.y + point.y) / 2;
    return `C${prev.x} ${midY} ${point.x} ${midY} ${point.x} ${point.y}`;
  };
  const toPath = (pts: Point[]): string =>
    pts.map((point, i) => (i === 0 ? `M${point.x} ${point.y}` : curveTo(point, pts[i - 1]))).join(' ');

  // Solid trail covers everything up to the furthest progressed stop, plus any
  // section treasure that has been unlocked.
  let traveledTo = -1;
  items.forEach((item, i) => {
    if (item.kind === 'stop' && (item.stop.status === 'completed' || item.stop.status === 'current')) {
      traveledTo = i;
    }
  });
  items.forEach((item, i) => {
    if (item.kind === 'treasure' && sections[item.sectionIndex].treasureUnlocked) {
      traveledTo = Math.max(traveledTo, i);
    }
  });
  const traveledPath = traveledTo >= 1 ? toPath(points.slice(0, traveledTo + 1)) : null;

  return (
    <div
      className="relative w-full"
      style={{
        height: `${height}px`,
        backgroundImage: `url(${mapBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-parchment-100/45" />
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path
          d={toPath(points)}
          fill="none"
          stroke="#43280f"
          strokeOpacity="0.45"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="6 9"
          vectorEffect="non-scaling-stroke"
        />
        {traveledPath && (
          <path
            d={traveledPath}
            fill="none"
            stroke="#a94c22"
            strokeOpacity="0.95"
            strokeWidth="4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {sections.map((section, si) => (
        <SectionBanner
          key={section.id}
          number={si + 1}
          topic={section.topic}
          top={TOP_PAD + sectionStart[si] * rowGap - 56}
        />
      ))}

      {items.map((item, i) => (
        <div
          key={item.key}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${points[i].x}%`, top: `${points[i].y}px` }}
        >
          {item.kind === 'stop' ? (
            <StopNode stop={item.stop} number={item.number} />
          ) : (
            <Treasure
              unlocked={sections[item.sectionIndex].treasureUnlocked}
              onOpen={sections[item.sectionIndex].onOpenTreasure}
              lockedLabel={
                sections[item.sectionIndex].onOpenTreasure ? 'Clear every stop to open the treasure.' : undefined
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SectionBanner({ number, topic, top }: { number: number; topic: string; top: number }) {
  return (
    <div className="absolute left-2 z-20 w-24 sm:left-5 sm:w-28" style={{ top: `${Math.max(8, top)}px` }}>
      <div className="rounded-t-xl bg-brand-600 px-2 pb-7 pt-3 text-center shadow-lg ring-1 ring-brand-800/40 [clip-path:polygon(0_0,100%_0,100%_85%,50%_100%,0_85%)]">
        <div className="font-display text-3xl font-extrabold leading-none text-gold-300">{number}</div>
        <div className="mt-1 text-[11px] font-bold uppercase leading-tight tracking-wide text-parchment-50">
          {topic}
        </div>
      </div>
    </div>
  );
}

function StopNode({ stop, number }: { stop: MapStop; number: number }) {
  const isCompleted = stop.status === 'completed';
  const isCurrent = stop.status === 'current';
  const isLocked = stop.status === 'locked';

  const circleColor = isCompleted
    ? 'border-brand-700 bg-brand-600 text-white'
    : isCurrent
      ? 'border-gold-600 bg-gold-400 text-ink ring-4 ring-gold-200'
      : isLocked
        ? 'border-parchment-300 bg-parchment-100 text-ink/40'
        : 'border-brand-300 bg-brand-100 text-brand-800';

  const inner = isCompleted ? (
    <CheckIcon />
  ) : isLocked ? (
    <LockIcon />
  ) : (
    <span className="nums font-display font-bold">{number}</span>
  );

  const body = (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full border-2 shadow-md transition duration-200 ${circleColor} ${
        isCurrent ? 'h-16 w-16 text-2xl' : 'h-14 w-14 text-xl'
      } ${stop.to ? 'cursor-pointer hover:shadow-xl motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-110' : ''}`}
    >
      {inner}

      {isCurrent && (
        <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2">
          <span className="block origin-bottom motion-safe:animate-flag-bob">
            <FlagIcon />
          </span>
        </span>
      )}

      {stop.label && (
        <span className="absolute left-1/2 top-full mt-2.5 -translate-x-1/2 text-center">
          <span className="inline-block whitespace-nowrap rounded-lg bg-parchment-50/90 px-3 py-1 text-sm font-semibold text-ink shadow-sm">
            {stop.label}
          </span>
          {stop.progressLabel && (
            <span className="mt-1 block">
              <span className="nums inline-block rounded bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                {stop.progressLabel}
              </span>
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (stop.to) {
    return (
      <Link
        to={stop.to}
        aria-label={`${stop.label}, ${stop.status}`}
        className="block shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      className={`shrink-0 ${isLocked ? 'opacity-75 saturate-50' : ''}`}
      title={stop.lockedReason}
      aria-label={stop.label ? `${stop.label}, ${stop.status}` : 'Upcoming stop'}
    >
      {body}
    </div>
  );
}

function Treasure({
  unlocked,
  onOpen,
  lockedLabel,
}: {
  unlocked: boolean;
  onOpen?: () => void;
  lockedLabel?: string;
}) {
  const inner = (
    <span className="relative flex items-center justify-center">
      <ChestIcon unlocked={unlocked} />
      <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 text-center">
        <span className="inline-block whitespace-nowrap rounded-full bg-gold-400 px-3 py-0.5 font-display text-sm font-bold text-ink shadow-sm ring-1 ring-gold-600/40">
          Treasure
        </span>
      </span>
    </span>
  );

  return (
    <div>
      {unlocked && onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open the treasure"
          className="rounded-full transition duration-200 hover:drop-shadow-[0_4px_10px_rgba(231,165,42,0.55)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-300"
        >
          {inner}
        </button>
      ) : (
        <div title={unlocked ? undefined : lockedLabel}>{inner}</div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path d="M6 3v18" stroke="#a06713" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M6 4h11l-3 3.5L17 11H6z" fill="#e7a52a" stroke="#a06713" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function ChestIcon({ unlocked }: { unlocked: boolean }) {
  return (
    <Chest
      variant={unlocked ? 'open' : 'closed'}
      className={`h-20 w-auto drop-shadow-md ${unlocked ? 'motion-safe:animate-chest-bob' : ''}`}
    />
  );
}
