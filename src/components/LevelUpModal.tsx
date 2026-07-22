import { useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { fireConfetti } from '../lib/confetti';
import { playLevelUp } from '../lib/sound';
import { Button } from './ui';

type LevelUpModalProps = {
  level: number;
  /** Spendable XP now available, so the beat points at what the level unlocked. */
  spendable: number;
  onClose: () => void;
  onOpenShop?: () => void;
};

/** A brief beat when the player reaches a new level. Fires confetti once on mount. */
export default function LevelUpModal({ level, spendable, onClose, onOpenShop }: LevelUpModalProps) {
  useEffect(() => {
    fireConfetti();
    playLevelUp();
  }, []);

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/60 motion-safe:animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 focus:outline-none">
          <div className="overflow-hidden rounded-2xl border-2 border-gold-500 bg-parchment-50 shadow-2xl motion-safe:animate-dialog-in">
            <div className="bg-ink px-6 py-7 text-center">
              <div className="flex justify-center">
                <LevelBadge level={level} />
              </div>
              <Dialog.Title className="mt-3 font-display text-2xl font-bold text-gold-300">
                Level {level}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-parchment-200">
                You reached a new level.
              </Dialog.Description>
            </div>

            <div className="px-6 py-5 text-center">
              <p className="nums text-sm text-ink">
                <span className="font-semibold">{spendable.toLocaleString()} XP</span> to spend in the
                shop.
              </p>

              <div className="mt-5 flex flex-col gap-2">
                {onOpenShop && (
                  <Button
                    fullWidth
                    onClick={() => {
                      onOpenShop();
                      onClose();
                    }}
                  >
                    Open shop
                  </Button>
                )}
                <Dialog.Close asChild>
                  <Button variant={onOpenShop ? 'secondary' : 'primary'} fullWidth>
                    Keep exploring
                  </Button>
                </Dialog.Close>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function LevelBadge({ level }: { level: number }) {
  return (
    <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-gold-300 to-gold-500 text-on-gold shadow-[0_0_18px_rgba(231,165,42,0.6)] ring-4 ring-gold-400/40">
      <StarIcon className="absolute h-16 w-16 text-ink/10" />
      <span className="nums font-display text-2xl font-extrabold leading-none">{level}</span>
    </span>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 17.8 6.5 19l1.4-6.1-4.7-4.1 6.2-.6z" />
    </svg>
  );
}
