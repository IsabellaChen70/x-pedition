import { useState } from 'react';
import { Link } from 'react-router-dom';
import LevelModal from './LevelModal';

type AppHeaderProps = {
  level?: number;
  xp?: number;
  xpToNext?: number;
  streak?: number;
  celebrateStreak?: boolean;
  onSignOut?: () => void;
  onAchievements?: () => void;
  sticky?: boolean;
};

/** The X-pedition top bar: wordmark plus the player's level, XP, and streak. */
export default function AppHeader({
  level,
  xp,
  xpToNext,
  streak,
  celebrateStreak,
  onSignOut,
  onAchievements,
  sticky,
}: AppHeaderProps) {
  const showStats = level !== undefined;
  const [showLevel, setShowLevel] = useState(false);
  const xpPct =
    xp !== undefined && xpToNext ? Math.min(100, Math.max(0, Math.round((xp / xpToNext) * 100))) : 0;

  return (
    <header
      className={`border-b border-black/20 bg-ink text-parchment-50 ${
        sticky ? 'sticky top-0 z-30' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        >
          <CompassIcon className="hidden h-8 w-8 text-gold-400 sm:block" />
          <span className="whitespace-nowrap font-display text-2xl font-bold tracking-tight sm:text-4xl">
            <span className="text-gold-400">X</span>-pedition
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {showStats && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLevel(true)}
                  aria-label={`Level ${level}, view progress`}
                  className="nums rounded-full bg-brand-600 px-2.5 py-0.5 text-sm font-bold text-white transition duration-200 hover:bg-brand-500 motion-safe:hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                >
                  Lv {level}
                </button>
                <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-white/20 sm:block">
                  <div
                    className="h-full rounded-full bg-gold-400 transition-all"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
                {xp !== undefined && xpToNext !== undefined && (
                  <span className="nums hidden text-xs text-parchment-200 sm:inline">
                    {xp}/{xpToNext}
                  </span>
                )}
              </div>
              <div
                className={`flex items-center gap-1.5 leading-none text-parchment-50 ${
                  celebrateStreak ? 'motion-safe:animate-streak-pop' : ''
                }`}
                title={`${streak ?? 0} day streak`}
              >
                <FlameIcon className="h-6 w-6 shrink-0 text-sunset" />
                <span className="text-sm font-bold">
                  <span className="nums">{streak ?? 0}</span>
                  <span className="hidden sm:inline">{' '}day streak</span>
                </span>
              </div>
            </>
          )}
          {onAchievements && (
            <button
              type="button"
              onClick={onAchievements}
              title="Badges"
              aria-label="Badges"
              className="inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-2.5 py-1.5 text-sm font-bold text-ink shadow-sm transition duration-200 hover:bg-gold-300 motion-safe:hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:px-3.5"
            >
              <TrophyIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Badges</span>
            </button>
          )}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              className="rounded-lg px-2 py-1 text-sm font-medium text-parchment-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              <span className="hidden sm:inline">Sign out</span>
              <LogOutIcon className="h-5 w-5 sm:hidden" />
            </button>
          )}
        </div>
      </div>
      {level !== undefined && showLevel && (
        <LevelModal
          level={level}
          xp={xp ?? 0}
          xpToNext={xpToNext ?? 0}
          onClose={() => setShowLevel(false)}
        />
      )}
    </header>
  );
}

function CompassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6l2.2 5.8L12 18l-2.2-6.2z" fill="currentColor" />
    </svg>
  );
}

function FlameIcon({ className }: { className?: string }) {
  // The flame shape sits in the top of its box, so scale it up and recenter it
  // to fill the icon and line up vertically with the streak text.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <g transform="translate(-4.8 -0.6) scale(1.4)">
        <path d="M12 2s5 3.8 5 9a5 5 0 11-10 0c0-2 .9-3.2 2-4.2 0 1.1.6 1.9 1.5 1.9 1.1 0 1.6-1 1-3-.4-2.3.5-3.7.5-3.7z" />
      </g>
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M5 4h14v3a5 5 0 01-4 4.9V14h2a3 3 0 013 3v1H4v-1a3 3 0 013-3h2v-2.1A5 5 0 015 7V4zM3 5H1v2a3 3 0 003 3V8H3V5zm18 0v3h-1v2a3 3 0 003-3V5h-2z" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
