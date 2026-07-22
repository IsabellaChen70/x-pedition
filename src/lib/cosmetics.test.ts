import { describe, expect, it } from 'vitest';
import {
  applyEquip,
  applyPurchase,
  canPurchase,
  cosmeticsForSlot,
  DEFAULT_EQUIPPED,
  EMPTY_COSMETICS,
  equippedId,
  getCosmetic,
  isEquipped,
  isUnlocked,
  resolveAvatar,
  resolveMapTheme,
} from './cosmetics';
import type { CosmeticsState } from './cosmetics';

const classic = getCosmetic('map-classic')!;
const verdant = getCosmetic('map-verdant')!;
const night = getCosmetic('map-night')!;
const explorer = getCosmetic('avatar-explorer')!;

function state(overrides: Partial<CosmeticsState> = {}): CosmeticsState {
  return { ...EMPTY_COSMETICS, ...overrides };
}

describe('catalog shape', () => {
  it('has visible cosmetics in both slots', () => {
    expect(cosmeticsForSlot('mapTheme').length).toBeGreaterThanOrEqual(2);
    expect(cosmeticsForSlot('avatar').length).toBeGreaterThanOrEqual(2);
  });

  it('map themes carry theme tokens and avatars carry an avatar id', () => {
    for (const c of cosmeticsForSlot('mapTheme')) expect(c.theme).toBeDefined();
    for (const c of cosmeticsForSlot('avatar')) expect(c.avatar).toBeDefined();
  });
});

describe('ownership', () => {
    it('treats defaults as always owned, even with an empty owned list', () => {
    expect(isUnlocked(classic, [])).toBe(true);
    expect(getCosmetic(DEFAULT_EQUIPPED.avatar)!.isDefault).toBe(true);
  });

  it('treats non-defaults as owned only once purchased', () => {
    expect(isUnlocked(verdant, [])).toBe(false);
    expect(isUnlocked(verdant, ['map-verdant'])).toBe(true);
  });
});

describe('canPurchase', () => {
  it('blocks buying a default or an already-owned cosmetic', () => {
    expect(canPurchase(classic, [], 9999)).toBe(false);
    expect(canPurchase(verdant, ['map-verdant'], 9999)).toBe(false);
  });

  it('requires enough spendable XP', () => {
    expect(canPurchase(verdant, [], verdant.price - 1)).toBe(false);
    expect(canPurchase(verdant, [], verdant.price)).toBe(true);
  });
});

describe('applyPurchase', () => {
  it('owns, equips, and charges exactly the price on a valid buy', () => {
    const next = applyPurchase(state(), verdant, 500);
    expect(next.unlocked).toContain('map-verdant');
    expect(next.equipped.mapTheme).toBe('map-verdant');
    expect(next.xpSpent).toBe(verdant.price);
  });

  it('is a no-op when unaffordable', () => {
    const before = state();
    expect(applyPurchase(before, night, night.price - 1)).toEqual(before);
  });

  it('is a no-op when already owned (never double-charges)', () => {
    const before = state({ unlocked: ['map-verdant'], xpSpent: verdant.price });
    expect(applyPurchase(before, verdant, 999)).toEqual(before);
  });

  it('accumulates xpSpent across separate purchases', () => {
    const afterFirst = applyPurchase(state(), verdant, 1000);
    const afterSecond = applyPurchase(afterFirst, explorer, 1000 - verdant.price);
    expect(afterSecond.xpSpent).toBe(verdant.price + explorer.price);
    expect(afterSecond.unlocked).toEqual(['map-verdant', 'avatar-explorer']);
  });
});

describe('equip state', () => {
  it('falls back to the slot default when nothing is equipped', () => {
    expect(equippedId('mapTheme', {})).toBe('map-classic');
    expect(equippedId('avatar', {})).toBe('avatar-none');
  });

  it('equips only owned cosmetics', () => {
    const owned = applyEquip(state({ unlocked: ['map-verdant'] }), verdant);
    expect(owned.equipped.mapTheme).toBe('map-verdant');

    const notOwned = applyEquip(state(), night);
    expect(notOwned.equipped.mapTheme).toBeUndefined();
  });

  it('reports the equipped cosmetic for its slot', () => {
    const equipped = { mapTheme: 'map-verdant' };
    expect(isEquipped(verdant, equipped)).toBe(true);
    expect(isEquipped(classic, equipped)).toBe(false);
    // With nothing equipped, the default reads as equipped.
    expect(isEquipped(classic, {})).toBe(true);
  });
});

describe('resolve applied visuals', () => {
  it('resolves the equipped map theme, defaulting to classic', () => {
    expect(resolveMapTheme({})).toEqual(classic.theme);
    expect(resolveMapTheme({ mapTheme: 'map-night' })).toEqual(night.theme);
  });

  it('resolves the equipped avatar, with the default meaning no avatar', () => {
    expect(resolveAvatar({})).toBeNull();
    expect(resolveAvatar({ avatar: 'avatar-none' })).toBeNull();
    expect(resolveAvatar({ avatar: 'avatar-explorer' })).toBe('explorer');
  });

  it('degrades to defaults for an unknown equipped id', () => {
    expect(resolveMapTheme({ mapTheme: 'does-not-exist' })).toEqual(classic.theme);
    expect(resolveAvatar({ avatar: 'does-not-exist' })).toBeNull();
  });
});
