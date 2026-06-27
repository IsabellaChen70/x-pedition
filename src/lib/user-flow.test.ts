/**
 * End-to-end user-flow simulation: exercises every major path a learner can take
 * without a browser or API keys. Runs as part of `npm test`.
 */
import { describe, expect, it } from 'vitest';
import { buildWeaknessMap, bumpSessionWeakness, weaknessFromMasteryFraction } from './ai/adaptive';
import { conceptForLesson, conceptsForLesson, lessonForConcept } from './ai/concepts';
import {
  CONCEPTS,
  generateLocalProblem,
  isConfidentWin,
  masteryStartDifficulty,
  pickNextConcept,
  toMcStep,
} from './ai/generate';
import type { Difficulty } from './ai/generate';
import { answerStringsToAvoid, deterministicHints } from './ai/hint';
import { detectMisconception } from './ai/misconception';
import { explainWrongChoice, solutionSteps } from './ai/solution';
import { verifyProblem } from './ai/verify';
import { computeBadges } from './badges';
import { getCourse, getLesson, listLessons } from './content';
import { countMasteryCorrect, masteryPass, MASTERY_PASS_THRESHOLD } from './mastery';
import {
  validateEqualShare,
  validateExpressionBuilder,
  validateMcStep,
  validateScaleInteractive,
  validateTileCombine,
} from './validation';
import type { McStep, Step } from '../types/lesson';

const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5];
const DAILY_GOAL = 8;

function wrongMcIndex(step: McStep): number {
  return step.correctIndex === 0 ? 1 : 0;
}

function simulateScoredStep(step: Step): void {
  switch (step.type) {
    case 'mc': {
      const wrong = validateMcStep(step, wrongMcIndex(step));
      expect(wrong.ok, `${step.id} mc wrong`).toBe(false);
      const right = validateMcStep(step, step.correctIndex);
      expect(right.ok, `${step.id} mc right`).toBe(true);
      break;
    }
    case 'scale_interactive': {
      const wrongSide = validateScaleInteractive(step, {
        removed: true,
        removedFromBoth: false,
        mcIndex: null,
      });
      expect(wrongSide.ok, `${step.id} scale one-side`).toBe(false);
      const state = {
        removed: true,
        removedFromBoth: true,
        mcIndex: step.followUpMc ? step.followUpMc.correctIndex : null,
      };
      const right = validateScaleInteractive(step, state);
      expect(right.ok, `${step.id} scale right`).toBe(true);
      break;
    }
    case 'tile_combine': {
      const v = step.validation;
      const wrong = validateTileCombine(step, { xCombined: 0, constantsKept: 0, misplaced: 1 });
      expect(wrong.ok, `${step.id} tile misplaced`).toBe(false);
      const right = validateTileCombine(step, {
        xCombined: v.targetCount,
        constantsKept: v.distractorLabel ? 1 : 0,
        misplaced: 0,
      });
      expect(right.ok, `${step.id} tile right`).toBe(true);
      break;
    }
    case 'equal_share': {
      const { groupCount, targetPerGroup } = step.validation;
      const wrong = validateEqualShare(step, Array.from({ length: groupCount }, () => targetPerGroup - 1));
      expect(wrong.ok, `${step.id} share wrong`).toBe(false);
      const right = validateEqualShare(step, Array.from({ length: groupCount }, () => targetPerGroup));
      expect(right.ok, `${step.id} share right`).toBe(true);
      break;
    }
    case 'expression_builder': {
      const wrong = validateExpressionBuilder(step, [step.tokens[0]]);
      expect(wrong.ok, `${step.id} expr wrong`).toBe(false);
      const right = validateExpressionBuilder(step, step.validation.expectedTokens);
      expect(right.ok, `${step.id} expr right`).toBe(true);
      break;
    }
    default:
      break;
  }
}

function hintSafety(step: Step): void {
  if (step.type === 'concept') return;
  const avoid = answerStringsToAvoid(step);
  for (const hint of deterministicHints(step)) {
    for (const answer of avoid) {
      expect(hint.includes(answer), `${step.id} hint leaks "${answer}": ${hint}`).toBe(false);
    }
  }
}

describe('user flow: content catalog', () => {
  it('loads the course and all five lessons', () => {
    const course = getCourse();
    expect(course.lessonOrder.length).toBe(5);
    for (const id of course.lessonOrder) {
      const lesson = getLesson(id);
      expect(lesson, id).not.toBeNull();
      expect(lesson!.phases.scaffolded.length).toBeGreaterThan(0);
      expect(lesson!.phases.mastery.length).toBe(3);
    }
    expect(listLessons().length).toBe(5);
  });

  it('maps every lesson to a practice concept and back', () => {
    for (const id of getCourse().lessonOrder) {
      const concept = conceptForLesson(id);
      expect(concept, id).not.toBeNull();
      expect(lessonForConcept(concept!)).toBe(id);
    }
  });
});

describe('user flow: complete every lesson (wrong then right)', () => {
  for (const { id } of listLessons()) {
    it(`plays through ${id}`, () => {
      const lesson = getLesson(id)!;
      for (const step of [...lesson.phases.scaffolded, ...lesson.phases.mastery]) {
        if (step.type !== 'concept') {
          simulateScoredStep(step);
          hintSafety(step);
        }
      }
      // Mastery reflect moments (Q2 & Q3) carry authored follow-up twists.
      for (const index of [1, 2]) {
        const m = lesson.phases.mastery[index];
        expect(m.followUp?.prompt.trim(), `${id} m${index + 1} followUp`).toBeTruthy();
        expect(m.followUp?.answer.trim()).toBeTruthy();
        expect(m.followUp?.why.trim()).toBeTruthy();
      }
    });
  }
});

describe('user flow: mastery check outcomes', () => {
  it('passes at 2/3 and fails at 1/3', () => {
    expect(MASTERY_PASS_THRESHOLD).toBe(2);
    expect(masteryPass(countMasteryCorrect(['m1', 'm2', 'm3'], { m1: true, m2: true, m3: false }))).toBe(true);
    expect(masteryPass(countMasteryCorrect(['m1', 'm2', 'm3'], { m1: true, m2: false, m3: false }))).toBe(false);
  });
});

describe('user flow: practice dig (Daily Treasure Dig simulation)', () => {
  for (const lessonId of getCourse().lessonOrder) {
    it(`runs an 8-problem dig scoped to ${lessonId}`, () => {
      const pool = conceptsForLesson(lessonId);
      expect(pool.length).toBeGreaterThan(0);
      let weakness = buildWeaknessMap(
        Object.fromEntries(pool.map((c) => [c, c === pool[0] ? 0.33 : 1])),
      );
      let last: (typeof pool)[number] | null = null;
      let solved = 0;
      for (let i = 0; i < DAILY_GOAL; i++) {
        const concept = pickNextConcept(pool, last, weakness);
        expect(pool).toContain(concept);
        if (last !== null && pool.length > 1) expect(concept).not.toBe(last);
        const problem = generateLocalProblem(concept, masteryStartDifficulty(0.5));
        expect(verifyProblem(problem)).toEqual({ ok: true });
        const step = toMcStep(problem);
        // Wrong once, then correct (typical learner).
        expect(validateMcStep(step, wrongMcIndex(step)).ok).toBe(false);
        expect(validateMcStep(step, step.correctIndex).ok).toBe(true);
        expect(explainWrongChoice(problem, wrongMcIndex(step))).toBeTruthy();
        expect(solutionSteps(problem).length).toBeGreaterThan(0);
        weakness = bumpSessionWeakness(weakness, concept);
        last = concept;
        solved += 1;
      }
      expect(solved).toBe(DAILY_GOAL);
    });
  }
});

describe('user flow: final challenge (capstone quiz)', () => {
  it('builds 5 verified puzzles and passes at 4/5', () => {
    const questions = getCourse().lessonOrder.map((lessonId) => {
      const concept = conceptForLesson(lessonId)!;
      return generateLocalProblem(concept, 3);
    });
    expect(questions.length).toBe(5);
    let correct = 0;
    for (const [i, problem] of questions.entries()) {
      expect(verifyProblem(problem)).toEqual({ ok: true });
      const step = toMcStep(problem);
      // Miss exactly one (first question wrong, rest right).
      const pick = i === 0 ? wrongMcIndex(step) : step.correctIndex;
      if (validateMcStep(step, pick).ok) correct += 1;
    }
    expect(correct).toBe(4);
    expect(correct >= questions.length - 1).toBe(true);
  });
});

describe('user flow: gamification milestones', () => {
  it('awards expected badges along a typical learner arc', () => {
    const firstLesson = computeBadges({
      completedCount: 1,
      totalLessons: 5,
      streak: 1,
      perfectLessons: 0,
      masteryCorrect: 0,
      practiceSolved: 0,
      digsCompleted: 0,
      bestLevel: 0,
      reflectionsCompleted: 0,
    });
    expect(firstLesson.some((b) => b.id === 'first-solve' && b.earned)).toBe(true);

    const afterDig = computeBadges({
      completedCount: 3,
      totalLessons: 5,
      streak: 3,
      perfectLessons: 0,
      masteryCorrect: 6,
      practiceSolved: 8,
      digsCompleted: 1,
      bestLevel: 3,
      reflectionsCompleted: 0,
    });
    expect(afterDig.some((b) => b.id === 'first-dig' && b.earned)).toBe(true);

    const deepThinker = computeBadges({
      completedCount: 5,
      totalLessons: 5,
      streak: 5,
      perfectLessons: 2,
      masteryCorrect: 12,
      practiceSolved: 40,
      digsCompleted: 3,
      bestLevel: 4,
      reflectionsCompleted: 5,
    });
    expect(deepThinker.some((b) => b.id === 'deep-thinker' && b.earned)).toBe(true);
  });
});

describe('user flow: effort-aware difficulty', () => {
  it('treats quick wins as confident and slow wins as hesitant', () => {
    expect(isConfidentWin(5000)).toBe(true);
    expect(isConfidentWin(25000)).toBe(false);
    expect(masteryStartDifficulty(1)).toBeGreaterThan(masteryStartDifficulty(0.5));
    expect(weaknessFromMasteryFraction(0)).toBe(1);
    expect(weaknessFromMasteryFraction(1)).toBe(0);
  });
});

describe('user flow: random learner sessions (multi-round)', () => {
  const ROUNDS = 5;

  it(`survives ${ROUNDS} randomized dig sessions without errors`, () => {
    for (let round = 0; round < ROUNDS; round++) {
      for (const concept of CONCEPTS) {
        for (const difficulty of DIFFICULTIES) {
          const problem = generateLocalProblem(concept, difficulty);
          expect(verifyProblem(problem)).toEqual({ ok: true });
          const step = toMcStep(problem);
          const tries = Math.floor(Math.random() * 3);
          for (let t = 0; t < tries; t++) {
            validateMcStep(step, wrongMcIndex(step));
          }
          expect(validateMcStep(step, step.correctIndex).ok).toBe(true);
        }
      }
    }
  });

  it(`survives ${ROUNDS} randomized lesson replays`, () => {
    const lessons = listLessons();
    for (let round = 0; round < ROUNDS; round++) {
      const pick = lessons[round % lessons.length];
      const lesson = getLesson(pick.id)!;
      for (const step of lesson.phases.mastery) {
        simulateScoredStep(step);
        if (step.type !== 'concept') {
          detectMisconception(step, { kind: 'mc', index: wrongMcIndex(step as McStep) });
        }
      }
    }
  });
});
