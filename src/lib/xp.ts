/**
 * XP math, kept pure and separate so the header, the level-up beat, and the shop
 * all agree on one model (and it stays unit-testable without a browser).
 *
 * The model has two distinct quantities:
 *
 *  - Earned XP: everything the learner has ever earned. This is the LEVEL signal
 *    and only ever grows. Spending in the shop never touches it, so a purchase
 *    can never drop the player's level.
 *  - Spendable XP: earned XP minus the persisted `xpSpent` counter. This is the
 *    shop wallet. Buying a cosmetic increments `xpSpent`, lowering the wallet
 *    while leaving earned XP (and therefore the level) untouched.
 */

/** XP required to move from one level to the next. */
export const XP_PER_LEVEL = 300;

/** The raw activity counts that earn XP. Mirrors what the home screen tracks. */
export type XpStats = {
  /** Lessons cleared (mastery passed). */
  completedCount: number;
  /** Correct mastery-check answers across all lessons. */
  masteryCorrect: number;
  /** Lifetime practice problems solved. */
  practiceSolved: number;
  /** Lifetime self-explanations submitted. */
  reflectionsCompleted: number;
};

/** Points each activity is worth. Tuned so a full course run reaches a few levels. */
const XP_WEIGHTS = {
  completedLesson: 100,
  masteryCorrect: 20,
  practiceSolved: 10,
  reflection: 10,
} as const;

/** Lifetime earned XP. Only grows; this is the number the level is derived from. */
export function earnedXp(stats: XpStats): number {
  return (
    stats.completedCount * XP_WEIGHTS.completedLesson +
    stats.masteryCorrect * XP_WEIGHTS.masteryCorrect +
    stats.practiceSolved * XP_WEIGHTS.practiceSolved +
    stats.reflectionsCompleted * XP_WEIGHTS.reflection
  );
}

/** Level for a given lifetime earned XP (level 1 at 0 XP). */
export function levelForXp(earned: number): number {
  return Math.floor(Math.max(0, earned) / XP_PER_LEVEL) + 1;
}

/** How far into the current level (0..XP_PER_LEVEL) the earned XP sits. */
export function xpIntoLevel(earned: number): number {
  return Math.max(0, earned) % XP_PER_LEVEL;
}

/**
 * The shop wallet: earned XP minus what has been spent, floored at 0. Spending
 * moves this number, never the earned total, so the level is unaffected.
 */
export function spendableXp(earned: number, xpSpent: number): number {
  return Math.max(0, Math.max(0, earned) - Math.max(0, xpSpent));
}
