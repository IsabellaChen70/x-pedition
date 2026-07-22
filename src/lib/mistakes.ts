/**
 * The mistake log: a small, additive record of problems the learner missed, so
 * they can revisit them later in the Review deck. Everything here is pure data +
 * pure functions (shape, cap, dedupe, defensive parse) so the deck, the recorder
 * in `progress.ts`, and the unit tests all agree on one source of truth.
 *
 * A miss stores enough to review it later WITHOUT re-showing the exact failure as
 * a wall of red: the concept (so an equivalent problem can be regenerated), the
 * detected misconception (the "why"), the prompt, the learner's wrong choice, the
 * correct answer, and when it happened. Entries are keyed by a stable id so the
 * same question re-missed updates in place instead of piling up.
 */
import type { ConceptId, MisconceptionId } from './ai/types';

/** Where a miss came from: a graded lesson step, or a practice problem. */
export type MistakeSource = 'lesson' | 'practice';

export type MistakeLogEntry = {
  /** Stable identity, so re-missing the same problem refreshes one entry. */
  id: string;
  /** The skill, so the deck can regenerate an equivalent problem to retry. */
  concept: ConceptId;
  /** The detected misconception, when one was inferred; null otherwise. */
  misconceptionId: MisconceptionId | null;
  /** The exact prompt the learner saw (shown if an equivalent can't be built). */
  prompt: string;
  /** What the learner chose. Kept for context, never dwelt on. */
  wrongAnswer: string;
  /** The correct answer. Surfaced only in review, never during a fresh retry. */
  correctAnswer: string;
  /** The lesson it happened in (or the lesson that teaches the concept). */
  lessonId: string | null;
  source: MistakeSource;
  /** Epoch ms on the client clock (serverTimestamp can't live inside an array). */
  at: number;
};

/**
 * How many recent misses to keep. Bounded so the log stays a short, encouraging
 * "try these again" set rather than an ever-growing ledger of failures.
 */
export const MISTAKE_LOG_CAP = 30;

const CONCEPT_IDS: readonly ConceptId[] = [
  'balance',
  'introX',
  'solve',
  'combine',
  'expression',
];

/** A stable id for a lesson-step miss, so re-missing that step updates one entry. */
export function lessonMistakeId(lessonId: string, stepId: string): string {
  return `l:${lessonId}:${stepId}`;
}

/**
 * A stable id for a practice miss, keyed by concept. Practice problems are
 * regenerated each time, so keeping one rolling entry per concept (the most
 * recent miss) keeps the deck focused instead of flooding it with ephemera.
 */
export function practiceMistakeId(concept: ConceptId): string {
  return `p:${concept}`;
}

/**
 * Add a miss to the log, purely: drop any prior entry with the same id (so a
 * re-miss updates in place), put the newest first, and cap to the most recent
 * `cap`. Returning a fresh array keeps callers simple and the result testable.
 */
export function addMistakeToLog(
  log: MistakeLogEntry[],
  entry: MistakeLogEntry,
  cap: number = MISTAKE_LOG_CAP,
): MistakeLogEntry[] {
  const withoutDuplicate = log.filter((existing) => existing.id !== entry.id);
  return [entry, ...withoutDuplicate]
    .sort((a, b) => b.at - a.at)
    .slice(0, Math.max(0, cap));
}

/** Remove one entry (e.g. once the learner clears it by retrying successfully). */
export function removeMistakeFromLog(
  log: MistakeLogEntry[],
  id: string,
): MistakeLogEntry[] {
  return log.filter((entry) => entry.id !== id);
}

function isConceptId(value: unknown): value is ConceptId {
  return typeof value === 'string' && (CONCEPT_IDS as readonly string[]).includes(value);
}

function parseEntry(value: unknown): MistakeLogEntry | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  // A concept is required (it's what makes an entry reviewable); everything else
  // has a safe fallback so a partially-written legacy entry still renders.
  if (!isConceptId(raw.concept) || typeof raw.id !== 'string') {
    return null;
  }
  return {
    id: raw.id,
    concept: raw.concept,
    misconceptionId:
      typeof raw.misconceptionId === 'string' ? (raw.misconceptionId as MisconceptionId) : null,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    wrongAnswer: typeof raw.wrongAnswer === 'string' ? raw.wrongAnswer : '',
    correctAnswer: typeof raw.correctAnswer === 'string' ? raw.correctAnswer : '',
    lessonId: typeof raw.lessonId === 'string' ? raw.lessonId : null,
    source: raw.source === 'practice' ? 'practice' : 'lesson',
    at: typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : 0,
  };
}

/**
 * Defensively parse a stored mistake log: keep only well-formed entries, newest
 * first, capped. A legacy doc with no log (or a malformed one) reads as empty, so
 * the feature is purely additive and can never throw on old data.
 */
export function normalizeMistakeLog(
  data: unknown,
  cap: number = MISTAKE_LOG_CAP,
): MistakeLogEntry[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map(parseEntry)
    .filter((entry): entry is MistakeLogEntry => entry !== null)
    .sort((a, b) => b.at - a.at)
    .slice(0, Math.max(0, cap));
}
