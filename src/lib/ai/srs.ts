import type { ConceptId } from './types';

/**
 * One skill's spaced-repetition memory: a deterministic Leitner/SM-2-lite record
 * that lives in the user's progress doc. `box` indexes a growing review interval,
 * `dueDate` is the next calendar day it should resurface, and `strength` is a
 * durable 0..1 retention estimate (rises on recall, drops on a lapse).
 */
export type SkillMemory = {
  /** 0..1 durable retention estimate (up on correct, down on wrong). */
  strength: number;
  /** Leitner box 1..5; the interval index (higher = longer gap). */
  box: number;
  /** YYYY-MM-DD calendar day the skill is next due for review. */
  dueDate: string;
  /** YYYY-MM-DD calendar day the skill was last reviewed. */
  lastSeen: string;
  /** Total reviews, used for the retention metric. */
  reviews: number;
  /** Wrong-answer count (a skill dropping back to box 1). */
  lapses: number;
};

/**
 * The durable mastery signal. `mastered` is only reachable at the top box, which
 * a skill can only enter after surviving the full chain of spaced intervals
 * (Soderstrom-Bjork: in-session fluency is not durable learning).
 */
export type SkillState = 'learning' | 'practicing' | 'mastered';

// Growing review gaps in days, indexed by box 1..5. A correct review promotes a
// box (longer gap); a wrong one drops to box 1 so the skill resurfaces tomorrow.
const BOX_INTERVALS = [1, 2, 4, 9, 21];
const MIN_BOX = 1;
const MAX_BOX = BOX_INTERVALS.length;

// How fast strength climbs toward 1 on a correct recall, and how hard it falls
// on a lapse. Multiplicative so it asymptotes (never quite 1) and never negative.
const STRENGTH_GAIN = 0.4;
const STRENGTH_PENALTY = 0.5;

// Weakness blends low strength with how overdue a skill is. A skill a week past
// due contributes its full overdue weight; the two parts are weighted so a fresh,
// strong, not-yet-due skill stays near zero.
const OVERDUE_SATURATION_DAYS = 7;
const WEAKNESS_STRENGTH_WEIGHT = 0.6;
const WEAKNESS_OVERDUE_WEIGHT = 0.4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Whole-day index for a 'YYYY-MM-DD' key, computed in UTC to avoid TZ drift. */
function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/** Calendar days from `fromKey` to `toKey` (positive when `toKey` is later). */
function daysBetween(fromKey: string, toKey: string): number {
  return dayNumber(toKey) - dayNumber(fromKey);
}

/**
 * Pure date math on a 'YYYY-MM-DD' key: add `n` calendar days (negative to go
 * back) in UTC so the result never shifts across a daylight-saving boundary, then
 * reformat as 'YYYY-MM-DD'. Exported so callers and tests share one definition.
 */
export function addDays(dateKey: string, n: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + n * MS_PER_DAY);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The review gap in days for a Leitner box (clamped to the 1..5 range). */
export function intervalForBox(box: number): number {
  const index = Math.min(MAX_BOX, Math.max(MIN_BOX, Math.round(box))) - 1;
  return BOX_INTERVALS[index];
}

/** A brand-new, never-reviewed skill: box 1, zero strength, due today. */
export function freshMemory(today: string): SkillMemory {
  return {
    strength: 0,
    box: 1,
    dueDate: today,
    lastSeen: today,
    reviews: 0,
    lapses: 0,
  };
}

/**
 * Apply one review to a skill's memory (treating an absent `prev` as fresh) and
 * return the next memory; never mutates the input.
 * - Correct: promote a box (capped at 5), push `dueDate` out by the new box's
 *   growing interval, and raise strength toward 1.
 * - Wrong: drop to box 1 so it resurfaces tomorrow, count a lapse, lower strength.
 *
 * Per-day clamp: a skill's box advances at most once per calendar day. If it was
 * already reviewed today, a further correct review still raises strength but
 * holds the box and due date, so grinding several sessions in one day cannot
 * fast-track "mastered" (Soderstrom-Bjork: durable mastery must survive real
 * spaced delays, not in-session repetition). A wrong review still lapses, since a
 * genuine miss is real evidence, not inflation.
 */
export function reviewSkill(
  prev: SkillMemory | undefined,
  correct: boolean,
  today: string,
): SkillMemory {
  const base = prev ?? freshMemory(today);
  const reviews = base.reviews + 1;

  if (correct) {
    // A brand-new skill (no prev) is a genuine first review, not "already seen".
    const alreadyReviewedToday = prev !== undefined && base.lastSeen === today;
    const box = alreadyReviewedToday ? base.box : Math.min(base.box + 1, MAX_BOX);
    return {
      strength: clamp01(base.strength + (1 - base.strength) * STRENGTH_GAIN),
      box,
      dueDate: alreadyReviewedToday ? base.dueDate : addDays(today, intervalForBox(box)),
      lastSeen: today,
      reviews,
      lapses: base.lapses,
    };
  }

  return {
    strength: clamp01(base.strength * STRENGTH_PENALTY),
    box: MIN_BOX,
    dueDate: addDays(today, intervalForBox(MIN_BOX)),
    lastSeen: today,
    reviews,
    lapses: base.lapses + 1,
  };
}

/**
 * The concepts due for review on `today` (dueDate on or before today), most
 * overdue first. Date keys sort chronologically as strings, so earliest dueDate
 * comes first. Pure; missing/undefined entries are skipped.
 */
export function getDueConcepts(
  skills: Partial<Record<ConceptId, SkillMemory>>,
  today: string,
): ConceptId[] {
  return (Object.entries(skills) as [ConceptId, SkillMemory | undefined][])
    .filter((entry): entry is [ConceptId, SkillMemory] => Boolean(entry[1]) && entry[1]!.dueDate <= today)
    .sort((a, b) => a[1].dueDate.localeCompare(b[1].dueDate))
    .map(([concept]) => concept);
}

/**
 * The durable mastery signal for a skill: `learning` (unseen or box 1-2),
 * `practicing` (box 3-4), `mastered` (box 5). Reaching box 5 requires a chain of
 * spaced correct reviews, so `mastered` reflects survival of spacing, not a
 * single in-session win.
 */
export function skillState(memory: SkillMemory | undefined): SkillState {
  if (!memory) return 'learning';
  if (memory.box >= MAX_BOX) return 'mastered';
  if (memory.box >= 3) return 'practicing';
  return 'learning';
}

/**
 * Per-concept weakness (0..1) derived from persisted memory: low strength and/or
 * being overdue both raise the weight, so the Daily Dig leans on skills that are
 * shaky or waiting for review. A fresh, strong, not-yet-due skill stays near 0.
 * Pure; missing/undefined entries are skipped.
 */
export function weaknessFromSkills(
  skills: Partial<Record<ConceptId, SkillMemory>>,
  today: string,
): Partial<Record<ConceptId, number>> {
  const out: Partial<Record<ConceptId, number>> = {};
  for (const [concept, memory] of Object.entries(skills) as [ConceptId, SkillMemory | undefined][]) {
    if (!memory) continue;
    const lowStrength = 1 - clamp01(memory.strength);
    const overdueDays = Math.max(0, daysBetween(memory.dueDate, today));
    const overdueFactor = clamp01(overdueDays / OVERDUE_SATURATION_DAYS);
    out[concept] = clamp01(
      WEAKNESS_STRENGTH_WEIGHT * lowStrength + WEAKNESS_OVERDUE_WEIGHT * overdueFactor,
    );
  }
  return out;
}
