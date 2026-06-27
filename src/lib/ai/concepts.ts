import { getCourse } from '../content';
import type { ConceptId } from './types';

// The practice skill each lesson introduces (matches the lesson's own content,
// so a dig never uses notation the learner hasn't met yet).
const LESSON_CONCEPT: Record<string, ConceptId> = {
  'lesson-01': 'balance', // shapes & weights, no x
  'lesson-02': 'introX', // meet x
  'lesson-03': 'solve', // one-step equations
  'lesson-04': 'combine', // combine like terms / two-step
  'lesson-05': 'expression', // words -> expression
};

/** Short, learner-facing names for each skill (used by the "what to revisit" nudge). */
export const CONCEPT_LABELS: Record<ConceptId, string> = {
  balance: 'Balancing scales',
  introX: 'Working with x',
  solve: 'Solving for x',
  combine: 'Combining like terms',
  expression: 'Writing expressions',
};

/**
 * Pure: the concept pool for practice launched from `lessonId`, every distinct
 * skill taught up to and including that lesson, in order. Practice then
 * interleaves these so it builds on (and reviews) earlier lessons. Falls back to
 * "solve" for an unknown lesson.
 */
export function conceptsUpTo(lessonId: string, lessonOrder: string[]): ConceptId[] {
  const index = lessonOrder.indexOf(lessonId);
  if (index === -1) {
    return ['balance'];
  }
  const pool: ConceptId[] = [];
  for (const id of lessonOrder.slice(0, index + 1)) {
    const concept = LESSON_CONCEPT[id];
    if (concept && !pool.includes(concept)) {
      pool.push(concept);
    }
  }
  return pool.length > 0 ? pool : ['balance'];
}

/** The concept pool for a lesson, using the live course order. */
export function conceptsForLesson(lessonId: string): ConceptId[] {
  return conceptsUpTo(lessonId, getCourse().lessonOrder);
}

/**
 * The single concept a lesson introduces, or null if unknown. Used by the
 * capstone Final Challenge to draw one puzzle per lesson.
 */
export function conceptForLesson(lessonId: string): ConceptId | null {
  return LESSON_CONCEPT[lessonId] ?? null;
}

/** The lesson that introduces a concept, or null. Lets practice map a weak skill
 *  back to its lesson's mastery results. */
export function lessonForConcept(concept: ConceptId): string | null {
  const entry = Object.entries(LESSON_CONCEPT).find(([, value]) => value === concept);
  return entry ? entry[0] : null;
}
