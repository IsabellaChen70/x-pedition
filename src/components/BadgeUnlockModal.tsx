import { useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Badge } from '../lib/badges';
import { fireConfetti } from '../lib/confetti';
import { Button } from './ui';

type BadgeUnlockModalProps = {
  badges: Badge[];
  onClose: () => void;
};

/** Pops once when one or more badges first become earned, with a confetti burst. */
export default function BadgeUnlockModal({ badges, onClose }: BadgeUnlockModalProps) {
  useEffect(() => {
    fireConfetti();
  }, []);

  const multiple = badges.length > 1;
  const heading = multiple ? 'Badges unlocked!' : 'Badge unlocked!';
  const subhead = multiple ? `You earned ${badges.length} new badges.` : 'You earned a new badge.';

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/60 motion-safe:animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 focus:outline-none">
          <div className="overflow-hidden rounded-2xl border-2 border-gold-500 bg-parchment-50 shadow-2xl motion-safe:animate-dialog-in">
            <div className="bg-ink px-6 py-7 text-center">
              <div className="flex justify-center">
                <AwardMedal />
              </div>
              <Dialog.Title className="mt-3 font-display text-2xl font-bold text-gold-300">
                {heading}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-parchment-200">
                {subhead}
              </Dialog.Description>
            </div>

            <div className="px-6 py-5">
              <ul className="space-y-2">
                {badges.map((badge) => (
                  <li
                    key={badge.id}
                    className="flex items-center gap-3 rounded-2xl border border-gold-400 bg-gold-300/25 p-3 shadow-sm"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400 text-ink shadow-sm ring-2 ring-gold-300">
                      <MedalIcon className="h-5 w-5" />
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
                  Nice
                </Button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AwardMedal() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-16 w-16 drop-shadow-[0_0_14px_rgba(231,165,42,0.6)]"
      aria-hidden="true"
    >
      <path
        d="M17 4h6l-3 17-6-2z"
        fill="#c45f2c"
        stroke="#8a3e1f"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M31 4h-6l3 17 6-2z"
        fill="#e2733a"
        stroke="#8a3e1f"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="30" r="13" fill="#f6c34c" stroke="#a06713" strokeWidth="2" />
      <circle cx="24" cy="30" r="9" fill="#ffda7a" stroke="#c9871a" strokeWidth="1.2" />
      <path
        d="M24 23l2.1 4.3 4.7 0.7-3.4 3.3 0.8 4.7-4.2-2.2-4.2 2.2 0.8-4.7-3.4-3.3 4.7-0.7z"
        fill="#fff8e1"
        stroke="#a06713"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        className="motion-safe:animate-sparkle-twinkle"
        d="M39 9l0.8 2.3 2.3 0.8-2.3 0.8-0.8 2.3-0.8-2.3-2.3-0.8 2.3-0.8z"
        fill="#fff8e1"
      />
    </svg>
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
