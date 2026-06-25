import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './ui';

type LevelModalProps = {
  level: number;
  xp: number;
  xpToNext: number;
  onClose: () => void;
};

/** A small popup showing how far the player is into the current level. */
export default function LevelModal({ level, xp, xpToNext, onClose }: LevelModalProps) {
  const xpPct =
    xpToNext > 0 ? Math.min(100, Math.max(0, Math.round((xp / xpToNext) * 100))) : 0;
  const xpRemaining = Math.max(0, xpToNext - xp);

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
          <div className="rounded-2xl border border-parchment-300 bg-parchment-50 p-6 shadow-xl motion-safe:animate-dialog-in">
            <Dialog.Title className="font-display text-xl font-bold text-ink">
              Level {level}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">
              Your progress to the next level
            </Dialog.Description>

            <div className="mt-4">
              <div className="h-3 w-full overflow-hidden rounded-full bg-parchment-200">
                <div
                  className="h-full rounded-full bg-gold-400 transition-all"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="nums text-sm font-semibold text-ink">
                  {xp} / {xpToNext} XP
                </span>
                <span className="nums text-sm text-muted">{xpPct}%</span>
              </div>
            </div>

            <p className="nums mt-4 rounded-2xl border border-gold-400 bg-gold-300/25 px-4 py-3 text-center text-sm font-semibold text-ink">
              {xpRemaining} XP to Level {level + 1}
            </p>

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
