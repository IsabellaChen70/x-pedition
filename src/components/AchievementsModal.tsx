import type { ComponentType } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Badge } from '../lib/badges';
import { BADGE_CATEGORIES } from '../lib/badges';
import { Button } from './ui';

type AchievementsModalProps = {
  badges: Badge[];
  onClose: () => void;
};

export default function AchievementsModal({ badges, onClose }: AchievementsModalProps) {
  const earnedCount = badges.filter((badge) => badge.earned).length;
  const allEarned = badges.length > 0 && earnedCount === badges.length;
  const pct = badges.length > 0 ? Math.round((earnedCount / badges.length) * 100) : 0;

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/50 motion-safe:animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 focus:outline-none">
          <div className="max-h-[85vh] overflow-y-auto rounded-2xl border border-parchment-300 bg-parchment-50 p-6 shadow-xl motion-safe:animate-dialog-in">
            <Dialog.Title className="font-display text-xl font-bold text-ink">Badges</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">
              {allEarned ? 'Every badge earned, legendary explorer!' : `${earnedCount} of ${badges.length} earned`}
            </Dialog.Description>

            <div
              className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-parchment-200"
              role="progressbar"
              aria-valuenow={earnedCount}
              aria-valuemin={0}
              aria-valuemax={badges.length}
              aria-label="Badges earned"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-5 space-y-5">
              {BADGE_CATEGORIES.map((category) => {
                const group = badges.filter((badge) => badge.category === category.id);
                if (group.length === 0) return null;
                const groupEarned = group.filter((badge) => badge.earned).length;
                return (
                  <section key={category.id}>
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-700">
                        {category.title}
                      </h3>
                      <span className="text-xs font-semibold text-muted">
                        {groupEarned}/{group.length}
                      </span>
                    </div>
                    <ul className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {group.map((badge) => (
                        <BadgeCard key={badge.id} badge={badge} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            <Dialog.Close asChild>
              <Button fullWidth className="mt-5">
                Close
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  const Icon = iconForBadge(badge.id);
  return (
    <li
      className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
        badge.earned
          ? 'border-gold-400 bg-gradient-to-b from-gold-300/45 to-gold-400/15 shadow-sm'
          : 'border-parchment-300 bg-parchment-100 opacity-80'
      }`}
    >
      <span
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
          badge.earned
            ? 'bg-gradient-to-b from-gold-300 to-gold-500 text-ink shadow ring-2 ring-gold-200'
            : 'bg-parchment-200 text-ink/25 ring-1 ring-parchment-300'
        }`}
      >
        <Icon className="h-6 w-6" />
        {badge.earned ? (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-parchment-50">
            <CheckIcon className="h-3 w-3" />
          </span>
        ) : (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-parchment-300 text-ink/50 ring-2 ring-parchment-50">
            <LockIcon className="h-3 w-3" />
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p className={`font-display text-sm font-bold ${badge.earned ? 'text-ink' : 'text-ink/60'}`}>
          {badge.label}
        </p>
        <p className={`mt-0.5 text-xs leading-snug ${badge.earned ? 'text-brand-800' : 'text-muted'}`}>
          {badge.description}
        </p>
      </div>
    </li>
  );
}

type IconProps = { className?: string };

/** Each badge gets a treasure-map-themed emblem so achievements feel distinct. */
function iconForBadge(id: string): ComponentType<IconProps> {
  const map: Record<string, ComponentType<IconProps>> = {
    'first-solve': FootprintIcon,
    'streak-3': FlameIcon,
    perfect: CompassIcon,
    halfway: FlagIcon,
    'streak-7': SailboatIcon,
    treasure: GemIcon,
    'first-dig': ShovelIcon,
    'equation-ace': StarIcon,
    'peak-climber': MountainIcon,
    'deep-thinker': BulbIcon,
  };
  return map[id] ?? MedalIcon;
}

function FootprintIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <ellipse cx="12" cy="15" rx="4.2" ry="5.6" />
      <circle cx="8.2" cy="9" r="1.3" />
      <circle cx="11.3" cy="7.3" r="1.5" />
      <circle cx="14.7" cy="7.6" r="1.4" />
      <circle cx="17.3" cy="9.6" r="1.2" />
    </svg>
  );
}

function FlameIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2s5 3.8 5 9a5 5 0 11-10 0c0-2 .9-3.2 2-4.2 0 1.1.6 1.9 1.5 1.9 1.1 0 1.6-1 1-3-.4-2.3.5-3.7.5-3.7z" />
    </svg>
  );
}

function CompassIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6l2.2 5.8L12 18l-2.2-6.2z" fill="currentColor" />
    </svg>
  );
}

function FlagIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M6 3v18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6 4.2h11l-3 3.4 3 3.4H6z" fill="currentColor" />
    </svg>
  );
}

function SailboatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="11.2" y="2.5" width="1.6" height="10" />
      <path d="M13 4l5.6 7.5H13z" />
      <path d="M4 13.5h16l-2.2 4.2a3 3 0 01-2.6 1.6H8.8a3 3 0 01-2.6-1.6z" />
    </svg>
  );
}

function GemIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M6 3h12l3 5-9 13L3 8z" />
    </svg>
  );
}

function ShovelIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M10 2.5h4v2.2h-4z" />
      <path d="M11 3.5h2v8.5h-2z" />
      <path d="M7.8 11.5h8.4l-1.7 5.3a2.5 2.5 0 0 1-5 0z" />
    </svg>
  );
}

function StarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 17.8 6.5 19l1.4-6.1-4.7-4.1 6.2-.6z" />
    </svg>
  );
}

function MountainIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 19l5.5-10 3.3 6 2.2-3.7L21 19z" />
    </svg>
  );
}

function BulbIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5a6 6 0 00-3.6 10.8c.4.3.6.7.6 1.2v.5h6v-.5c0-.5.2-.9.6-1.2A6 6 0 0012 2.5z" />
      <rect x="9.5" y="16" width="5" height="1.8" rx="0.9" />
      <rect x="10.3" y="18.6" width="3.4" height="1.8" rx="0.9" />
    </svg>
  );
}

function MedalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 2l2 6H6L8 2zm8 0l-2 6h4l-2-6z" />
      <circle cx="12" cy="15" r="6" />
      <circle cx="12" cy="15" r="3" fill="#fff8e1" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function LockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z" />
    </svg>
  );
}
