import { useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Badge } from '../lib/badges';
import { fireMilestoneConfetti } from '../lib/confetti';
import { Button } from './ui';
import Chest from './Chest';

type TreasureModalProps = {
  level: number;
  totalXp: number;
  earnedBadges: Badge[];
  onClose: () => void;
};

/** The capstone payoff: opens when every stop is cleared and the treasure is unlocked. */
export default function TreasureModal({ level, totalXp, earnedBadges, onClose }: TreasureModalProps) {
  useEffect(() => {
    fireMilestoneConfetti();
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 focus:outline-none">
          <div className="overflow-hidden rounded-2xl border-2 border-gold-500 bg-parchment-50 shadow-2xl motion-safe:animate-dialog-in">
            <div className="bg-ink px-6 py-7 text-center">
              <div className="flex justify-center">
                <BigChest />
              </div>
              <Dialog.Title className="mt-3 font-display text-2xl font-bold text-gold-300">
                Treasure unlocked!
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-parchment-200">
                You cleared every stop on the map.
              </Dialog.Description>
            </div>

            <div className="px-6 py-5">
              <div className="flex justify-center gap-8">
                <Stat label="Level" value={`${level}`} />
                <Stat label="XP" value={totalXp.toLocaleString()} />
                <Stat label="Badges" value={`${earnedBadges.length}`} />
              </div>

              {earnedBadges.length > 0 && (
                <ul className="mt-4 flex flex-wrap justify-center gap-2">
                  {earnedBadges.map((badge) => (
                    <li
                      key={badge.id}
                      className="rounded-full border border-gold-400 bg-gold-300/25 px-3 py-1 text-xs font-semibold text-ink"
                    >
                      {badge.label}
                    </li>
                  ))}
                </ul>
              )}

              <Dialog.Close asChild>
                <Button fullWidth className="mt-5">
                  Close
                </Button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="nums font-display text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function BigChest() {
  return <Chest variant="open" className="h-28 w-auto drop-shadow-[0_0_22px_rgba(231,165,42,0.5)]" />;
}
