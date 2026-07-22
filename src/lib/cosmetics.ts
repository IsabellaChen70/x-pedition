/**
 * The shop catalog and the pure logic for owning and equipping cosmetics.
 *
 * Everything here is data + pure functions so the shop UI, the map, and the
 * home screen share one source of truth and it stays unit-testable. Persistence
 * lives in `progress.ts`; rendering of avatars lives in `Avatar.tsx`. Cosmetics
 * are visible-first: each one changes something the learner can actually see.
 */

export type CosmeticSlot = 'mapTheme' | 'avatar';

/** Visual tokens a map theme paints onto the home background and the trail. */
export type MapThemeTokens = {
  /** CSS gradient layered over the parchment map image (page + map wash). */
  overlay: string;
  /** Stroke color for the traveled (completed) segment of the trail. */
  trail: string;
  /** Glow color behind the traveled trail (rgba). */
  trailGlow: string;
  /** Stroke color for the dashed, not-yet-traveled trail. */
  dash: string;
  /** Opacity for the dashed trail. */
  dashOpacity: number;
  /** Base "r, g, b" for the fog-of-war haze over undiscovered ground. */
  fogRgb: string;
  /** Peak fog opacity (kept low so the map stays readable). */
  fogAlpha: number;
  /** Dark themes flip the welcome text to a light ink for contrast. */
  dark: boolean;
};

/** Avatars the learner can carry along the trail. `none` keeps the default flag. */
export type AvatarId = 'none' | 'explorer' | 'parrot';

export type Cosmetic = {
  id: string;
  slot: CosmeticSlot;
  name: string;
  description: string;
  /** Price in spendable XP. Zero for the free, pre-owned default of a slot. */
  price: number;
  /** The free default for its slot: always owned, and the graceful fallback. */
  isDefault?: boolean;
  /** Present when slot is 'mapTheme'. */
  theme?: MapThemeTokens;
  /** Present when slot is 'avatar'. */
  avatar?: AvatarId;
};

const CLASSIC_THEME: MapThemeTokens = {
  overlay: 'linear-gradient(rgba(247,238,214,0.5), rgba(247,238,214,0.5))',
  trail: '#a94c22',
  trailGlow: 'rgba(169,76,34,0.35)',
  dash: '#43280f',
  dashOpacity: 0.45,
  fogRgb: '58, 44, 28',
  fogAlpha: 0.32,
  dark: false,
};

const VERDANT_THEME: MapThemeTokens = {
  overlay: 'linear-gradient(rgba(223,238,209,0.55), rgba(203,228,190,0.6))',
  trail: '#3f7d3a',
  trailGlow: 'rgba(63,125,58,0.35)',
  dash: '#2f5a2a',
  dashOpacity: 0.5,
  fogRgb: '39, 61, 34',
  fogAlpha: 0.3,
  dark: false,
};

const NIGHT_THEME: MapThemeTokens = {
  overlay: 'linear-gradient(rgba(18,26,46,0.72), rgba(11,17,33,0.78))',
  trail: '#f6c34c',
  trailGlow: 'rgba(246,195,76,0.5)',
  dash: '#e3cd96',
  dashOpacity: 0.4,
  fogRgb: '7, 11, 24',
  fogAlpha: 0.46,
  dark: true,
};

/** The shipped catalog. Order here is the order shown in each shop section. */
export const COSMETICS: Cosmetic[] = [
  {
    id: 'map-classic',
    slot: 'mapTheme',
    name: 'Classic parchment',
    description: 'The original warm parchment map.',
    price: 0,
    isDefault: true,
    theme: CLASSIC_THEME,
  },
  {
    id: 'map-verdant',
    slot: 'mapTheme',
    name: 'Verdant valley',
    description: 'A green wash and mossy trail.',
    price: 300,
    theme: VERDANT_THEME,
  },
  {
    id: 'map-night',
    slot: 'mapTheme',
    name: 'Night expedition',
    description: 'A dark map with a glowing gold trail.',
    price: 600,
    theme: NIGHT_THEME,
  },
  {
    id: 'avatar-none',
    slot: 'avatar',
    name: 'No companion',
    description: 'Just the trail flag, no traveler.',
    price: 0,
    isDefault: true,
    avatar: 'none',
  },
  {
    id: 'avatar-explorer',
    slot: 'avatar',
    name: 'Explorer',
    description: 'A hatted explorer marks where you are.',
    price: 150,
    avatar: 'explorer',
  },
  {
    id: 'avatar-parrot',
    slot: 'avatar',
    name: 'Parrot',
    description: 'A parrot rides along the trail.',
    price: 450,
    avatar: 'parrot',
  },
];

/** The equipped id for each slot when nothing has been chosen yet. */
export const DEFAULT_EQUIPPED: Record<CosmeticSlot, string> = {
  mapTheme: 'map-classic',
  avatar: 'avatar-none',
};

/** The ordered slots the shop renders as sections, with learner-facing titles. */
export const SHOP_SECTIONS: { slot: CosmeticSlot; title: string }[] = [
  { slot: 'mapTheme', title: 'Map themes' },
  { slot: 'avatar', title: 'Companions' },
];

/** The persisted shop state on the progress doc. Additive; defaults are empty. */
export type CosmeticsState = {
  /** Ids the learner has bought (defaults are always owned, not stored here). */
  unlocked: string[];
  /** Chosen id per slot; missing slots fall back to DEFAULT_EQUIPPED. */
  equipped: Partial<Record<CosmeticSlot, string>>;
  /** Lifetime XP spent in the shop. The spendable wallet subtracts this. */
  xpSpent: number;
};

export const EMPTY_COSMETICS: CosmeticsState = {
  unlocked: [],
  equipped: {},
  xpSpent: 0,
};

export function getCosmetic(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id);
}

export function cosmeticsForSlot(slot: CosmeticSlot): Cosmetic[] {
  return COSMETICS.filter((c) => c.slot === slot);
}

/** Defaults (and only defaults) are free and pre-owned. */
export function isDefault(cosmetic: Cosmetic): boolean {
  return cosmetic.isDefault === true;
}

/** Whether the learner owns a cosmetic: defaults are always owned. */
export function isUnlocked(cosmetic: Cosmetic, unlocked: string[]): boolean {
  return isDefault(cosmetic) || unlocked.includes(cosmetic.id);
}

/** The equipped cosmetic id for a slot, falling back to the slot default. */
export function equippedId(slot: CosmeticSlot, equipped: CosmeticsState['equipped']): string {
  return equipped[slot] ?? DEFAULT_EQUIPPED[slot];
}

export function isEquipped(cosmetic: Cosmetic, equipped: CosmeticsState['equipped']): boolean {
  return equippedId(cosmetic.slot, equipped) === cosmetic.id;
}

export function canAfford(cosmetic: Cosmetic, spendable: number): boolean {
  return spendable >= cosmetic.price;
}

/** A cosmetic can be bought only if it is not already owned and is affordable. */
export function canPurchase(
  cosmetic: Cosmetic,
  unlocked: string[],
  spendable: number,
): boolean {
  return !isUnlocked(cosmetic, unlocked) && canAfford(cosmetic, spendable);
}

/**
 * Apply a purchase purely: returns the next cosmetics state with the id owned,
 * the slot equipped to it, and `xpSpent` advanced by its price. Returns the
 * state unchanged if the purchase is not allowed (already owned or unaffordable),
 * so callers can trust the result without a second guard.
 */
export function applyPurchase(
  state: CosmeticsState,
  cosmetic: Cosmetic,
  spendable: number,
): CosmeticsState {
  if (!canPurchase(cosmetic, state.unlocked, spendable)) {
    return state;
  }
  return {
    unlocked: [...state.unlocked, cosmetic.id],
    equipped: { ...state.equipped, [cosmetic.slot]: cosmetic.id },
    xpSpent: state.xpSpent + cosmetic.price,
  };
}

/**
 * Equip an owned cosmetic purely. Ignores the request if the cosmetic is not
 * owned, so the UI can call it optimistically without going out of sync.
 */
export function applyEquip(state: CosmeticsState, cosmetic: Cosmetic): CosmeticsState {
  if (!isUnlocked(cosmetic, state.unlocked)) {
    return state;
  }
  return { ...state, equipped: { ...state.equipped, [cosmetic.slot]: cosmetic.id } };
}

/** The map theme tokens for the equipped theme, falling back to classic. */
export function resolveMapTheme(equipped: CosmeticsState['equipped']): MapThemeTokens {
  const cosmetic = getCosmetic(equippedId('mapTheme', equipped));
  return cosmetic?.theme ?? CLASSIC_THEME;
}

/** The equipped avatar, or null when the default "no companion" is chosen. */
export function resolveAvatar(equipped: CosmeticsState['equipped']): AvatarId | null {
  const cosmetic = getCosmetic(equippedId('avatar', equipped));
  const avatar = cosmetic?.avatar ?? 'none';
  return avatar === 'none' ? null : avatar;
}
