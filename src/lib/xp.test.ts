import { describe, expect, it } from 'vitest';
import { earnedXp, levelForXp, spendableXp, XP_PER_LEVEL, xpIntoLevel } from './xp';

const NO_ACTIVITY = {
  completedCount: 0,
  masteryCorrect: 0,
  practiceSolved: 0,
  reflectionsCompleted: 0,
};

describe('earnedXp', () => {
  it('is zero with no activity', () => {
    expect(earnedXp(NO_ACTIVITY)).toBe(0);
  });

  it('weights each activity and sums them', () => {
    expect(
      earnedXp({
        completedCount: 2, // 200
        masteryCorrect: 3, // 60
        practiceSolved: 4, // 40
        reflectionsCompleted: 5, // 50
      }),
    ).toBe(350);
  });
});

describe('levelForXp / xpIntoLevel', () => {
  it('starts at level 1 with a full bar remaining', () => {
    expect(levelForXp(0)).toBe(1);
    expect(xpIntoLevel(0)).toBe(0);
  });

  it('advances a level exactly at each XP_PER_LEVEL boundary', () => {
    expect(levelForXp(XP_PER_LEVEL - 1)).toBe(1);
    expect(levelForXp(XP_PER_LEVEL)).toBe(2);
    expect(levelForXp(XP_PER_LEVEL * 3)).toBe(4);
  });

  it('reports how far into the current level the XP sits', () => {
    expect(xpIntoLevel(XP_PER_LEVEL + 40)).toBe(40);
  });
});

describe('spendableXp', () => {
  it('equals earned XP when nothing has been spent', () => {
    expect(spendableXp(500, 0)).toBe(500);
  });

  it('subtracts what has been spent', () => {
    expect(spendableXp(500, 150)).toBe(350);
  });

  it('never goes negative when spend exceeds earned (e.g. after a progress reset)', () => {
    expect(spendableXp(100, 400)).toBe(0);
  });

  it('treats negative inputs as zero defensively', () => {
    expect(spendableXp(-10, -10)).toBe(0);
  });
});

describe('spending does not change the level signal', () => {
  it('keeps level and into-level bar tied to earned XP, not the wallet', () => {
    const earned = XP_PER_LEVEL * 2 + 120; // level 3, 120 into the level
    const beforeLevel = levelForXp(earned);
    const beforeInto = xpIntoLevel(earned);

    // A purchase increments xpSpent only; earned XP is the same argument here.
    const walletAfter = spendableXp(earned, 300);

    expect(walletAfter).toBe(earned - 300);
    expect(levelForXp(earned)).toBe(beforeLevel);
    expect(xpIntoLevel(earned)).toBe(beforeInto);
  });
});
