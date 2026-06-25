import * as Dialog from '@radix-ui/react-dialog';
import type { Badge } from '../lib/badges';
import { Button } from './ui';

type AchievementsModalProps = {
  badges: Badge[];
  onClose: () => void;
};

export default function AchievementsModal({ badges, onClose }: AchievementsModalProps) {
  const earnedCount = badges.filter((badge) => badge.earned).length;

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/50 motion-safe:animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 focus:outline-none">
          <div className="max-h-[85vh] overflow-y-auto rounded-2xl border border-parchment-300 bg-parchment-50 p-6 shadow-xl motion-safe:animate-dialog-in">
            <Dialog.Title className="font-display text-xl font-bold text-ink">Badges</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">
              {earnedCount} of {badges.length} earned
            </Dialog.Description>

            <ul className="mt-4 space-y-2">
              {badges.map((badge) => (
                <li
                  key={badge.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    badge.earned
                      ? 'border-gold-400 bg-gold-300/25 shadow-sm'
                      : 'border-parchment-300 bg-parchment-100 opacity-70'
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      badge.earned
                        ? 'bg-gold-400 text-ink shadow-sm ring-2 ring-gold-300'
                        : 'bg-parchment-200 text-ink/40'
                    }`}
                  >
                    {badge.earned ? <MedalIcon className="h-5 w-5" /> : <LockIcon className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{badge.label}</p>
                    <p className="text-sm text-muted">{badge.description}</p>
                  </div>
                </li>
              ))}
            </ul>

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

function MedalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 2l2 6H6L8 2zm8 0l-2 6h4l-2-6z" />
      <circle cx="12" cy="15" r="6" />
      <circle cx="12" cy="15" r="3" fill="#fff8e1" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z" />
    </svg>
  );
}
