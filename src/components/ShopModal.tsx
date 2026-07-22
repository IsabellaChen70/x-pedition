import * as Dialog from '@radix-ui/react-dialog';
import mapBg from '../assets/map-bg.jpg';
import Avatar from './Avatar';
import { Button } from './ui';
import {
  canAfford,
  cosmeticsForSlot,
  isEquipped,
  isUnlocked,
  SHOP_SECTIONS,
} from '../lib/cosmetics';
import type { AvatarId, Cosmetic, CosmeticsState, MapThemeTokens } from '../lib/cosmetics';

type ShopModalProps = {
  /** Earned XP minus what has been spent. Buying draws this down, not the level. */
  spendable: number;
  unlocked: string[];
  equipped: CosmeticsState['equipped'];
  onBuy: (cosmetic: Cosmetic) => void;
  onEquip: (cosmetic: Cosmetic) => void;
  onClose: () => void;
};

/**
 * The shop: spend earned XP on cosmetics that visibly change the map and add a
 * companion. Buying never lowers the level (see the note in the header).
 */
export default function ShopModal({
  spendable,
  unlocked,
  equipped,
  onBuy,
  onEquip,
  onClose,
}: ShopModalProps) {
  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/60 motion-safe:animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 focus:outline-none">
          <div className="max-h-[86vh] overflow-y-auto rounded-2xl border-2 border-gold-500 bg-parchment-50 shadow-2xl motion-safe:animate-dialog-in">
            <div className="sticky top-0 z-10 bg-ink px-6 py-5 text-center">
              <Dialog.Title className="font-display text-2xl font-bold text-gold-300">Shop</Dialog.Title>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5">
                <GemIcon className="h-5 w-5 text-gold-300" />
                <span className="nums font-display text-xl font-bold text-gold-200">
                  {spendable.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-parchment-200">XP to spend</span>
              </div>
              <Dialog.Description className="mt-2 text-xs text-parchment-200">
                Spending here won't change your level.
              </Dialog.Description>
            </div>

            <div className="space-y-6 px-6 py-5">
              {SHOP_SECTIONS.map((section) => (
                <section key={section.slot}>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-700">
                    {section.title}
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {cosmeticsForSlot(section.slot).map((cosmetic) => (
                      <ItemRow
                        key={cosmetic.id}
                        cosmetic={cosmetic}
                        spendable={spendable}
                        unlocked={unlocked}
                        equipped={equipped}
                        onBuy={onBuy}
                        onEquip={onEquip}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              <Dialog.Close asChild>
                <Button fullWidth>Done</Button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ItemRow({
  cosmetic,
  spendable,
  unlocked,
  equipped,
  onBuy,
  onEquip,
}: {
  cosmetic: Cosmetic;
  spendable: number;
  unlocked: string[];
  equipped: CosmeticsState['equipped'];
  onBuy: (cosmetic: Cosmetic) => void;
  onEquip: (cosmetic: Cosmetic) => void;
}) {
  const owned = isUnlocked(cosmetic, unlocked);
  const equippedNow = isEquipped(cosmetic, equipped);
  const affordable = canAfford(cosmetic, spendable);

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-parchment-300 bg-parchment-100 p-3">
      <Preview cosmetic={cosmetic} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-ink">{cosmetic.name}</p>
        <p className="text-xs leading-snug text-muted">{cosmetic.description}</p>
      </div>
      <div className="shrink-0 text-right">
        {equippedNow ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-400 px-3 py-1 text-xs font-bold text-ink">
            <CheckIcon className="h-3.5 w-3.5" />
            Equipped
          </span>
        ) : owned ? (
          <Button size="sm" variant="outline" onClick={() => onEquip(cosmetic)}>
            Equip
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span className="nums inline-flex items-center gap-1 text-sm font-bold text-ink">
              <GemIcon className="h-4 w-4 text-gold-500" />
              {cosmetic.price}
            </span>
            <Button size="sm" disabled={!affordable} onClick={() => onBuy(cosmetic)}>
              Buy
            </Button>
            {!affordable && (
              <span className="nums text-[11px] text-muted">
                Need {(cosmetic.price - spendable).toLocaleString()} more
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function Preview({ cosmetic }: { cosmetic: Cosmetic }) {
  if (cosmetic.slot === 'mapTheme' && cosmetic.theme) {
    return <MapSwatch theme={cosmetic.theme} />;
  }
  return <AvatarSwatch avatar={cosmetic.avatar ?? 'none'} />;
}

function MapSwatch({ theme }: { theme: MapThemeTokens }) {
  return (
    <div
      className="h-12 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-parchment-300"
      style={{
        backgroundImage: `${theme.overlay}, url(${mapBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <svg viewBox="0 0 64 48" className="h-full w-full" aria-hidden="true">
        <path
          d="M8 40C20 30 44 30 56 10"
          fill="none"
          stroke={theme.trail}
          strokeWidth="3.5"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 2px ${theme.trailGlow})` }}
        />
      </svg>
    </div>
  );
}

function AvatarSwatch({ avatar }: { avatar: AvatarId }) {
  return (
    <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-parchment-50 ring-1 ring-parchment-300">
      {avatar === 'none' ? (
        <FlagIcon className="h-7 w-7" />
      ) : (
        <Avatar id={avatar} className="h-11 w-11" />
      )}
    </div>
  );
}

function GemIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M6 3h12l3 5-9 13L3 8z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M6 3v18" stroke="#a06713" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M6 4h11l-3 3.5L17 11H6z" fill="#e7a52a" stroke="#a06713" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
