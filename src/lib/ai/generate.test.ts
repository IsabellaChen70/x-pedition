import { describe, expect, it } from 'vitest';
import {
  CONCEPTS,
  CONFIDENT_WIN_MS,
  clampDifficulty,
  generateLocalProblem,
  generateProblem,
  isConfidentWin,
  masteryStartDifficulty,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  pickNextConcept,
  toMcStep,
} from './generate';
import type { Difficulty } from './generate';
import { explainWrongChoice, solutionSteps } from './solution';
import type { GeneratedProblem } from './types';
import { verifyProblem } from './verify';
import { validateMcStep } from '../validation';

const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5];

describe('generateLocalProblem', () => {
  it('produces verified problems for every concept at every difficulty', () => {
    for (const concept of CONCEPTS) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 60; i++) {
          const problem = generateLocalProblem(concept, difficulty);
          expect(
            verifyProblem(problem),
            `${concept} L${difficulty}: "${problem.prompt}" [${problem.options.join(', ')}]`,
          ).toEqual({ ok: true });
          expect(problem.concept).toBe(concept);
        }
      }
    }
  });

  it('produces 3-5 distinct options with an in-range correctIndex', () => {
    for (const concept of CONCEPTS) {
      for (let i = 0; i < 30; i++) {
        const problem = generateLocalProblem(concept, 3);
        expect(new Set(problem.options).size).toBe(problem.options.length);
        expect(problem.options.length).toBeGreaterThanOrEqual(3);
        expect(problem.options.length).toBeLessThanOrEqual(5);
        expect(problem.correctIndex).toBeGreaterThanOrEqual(0);
        expect(problem.correctIndex).toBeLessThan(problem.options.length);
      }
    }
  });

  it('maps to an McStep where the correct option validates and a wrong one does not', () => {
    for (const concept of CONCEPTS) {
      const problem = generateLocalProblem(concept, 3);
      const step = toMcStep(problem);
      expect(validateMcStep(step, problem.correctIndex).ok).toBe(true);
      const wrongIndex = (problem.correctIndex + 1) % step.options.length;
      expect(validateMcStep(step, wrongIndex).ok).toBe(false);
    }
  });
});

describe('clampDifficulty', () => {
  it('keeps difficulty within bounds', () => {
    expect(clampDifficulty(0)).toBe(MIN_DIFFICULTY);
    expect(clampDifficulty(99)).toBe(MAX_DIFFICULTY);
    expect(clampDifficulty(3)).toBe(3);
  });
});

describe('generateProblem (async entry)', () => {
  it('returns a verified problem for the requested concept (local fallback, AI off)', async () => {
    for (const concept of CONCEPTS) {
      const problem = await generateProblem(concept, 3);
      expect(problem.concept).toBe(concept);
      expect(verifyProblem(problem).ok).toBe(true);
    }
  });
});

describe('explainWrongChoice', () => {
  it('explains a solve mistake by plugging the choice back in (so it can never be inconsistent)', () => {
    const problem: GeneratedProblem = {
      id: 't',
      concept: 'solve',
      prompt: 'x + 3 = 4. x equals...',
      options: ['3', '2', '4', '1'],
      correctIndex: 3,
      feedback: { correct: 'c', incorrect: ['i'] },
      check: { kind: 'solves', equation: 'x + 3 = 4', variable: 'x' },
    };
    const text = explainWrongChoice(problem, 2); // chose "4"
    expect(text).toContain('4 + 3');
    expect(text).toContain('7');
    expect(text).toContain('needs 4');
  });

  it('explains an equivalence mistake with a concrete sample point', () => {
    const problem: GeneratedProblem = {
      id: 't2',
      concept: 'combine',
      prompt: 'Simplify x + x',
      options: ['2x', '3x'],
      correctIndex: 0,
      feedback: { correct: 'c', incorrect: ['i'] },
      check: { kind: 'equivalent', expression: 'x + x', variable: 'x' },
    };
    const text = explainWrongChoice(problem, 1); // chose "3x"
    expect(text).toContain('3x');
    expect(text).toContain('x = 2');
  });

  it('explains "you used the total" on an equal-share balance problem without giving the answer', () => {
    const problem: GeneratedProblem = {
      id: 't3',
      concept: 'balance',
      prompt: '2 identical boxes balance 6 pounds. How much does one box weigh?',
      options: ['3 lb', '6 lb', '4 lb', '2 lb'],
      correctIndex: 0,
      feedback: { correct: 'c', incorrect: ['i'] },
      check: { kind: 'value', value: 3, total: 6, count: 2, extra: 0 },
    };
    const text = explainWrongChoice(problem, 1); // chose "6 lb" (the total)
    expect(text).toBeTruthy();
    expect(text).toContain('6 lb');
    expect(text).toContain('2'); // "all 2 together"
    expect(text).not.toContain('3'); // never hands over the answer (3 lb)
  });

  it('explains grabbing the known weight on a block-plus-extra balance problem', () => {
    const problem: GeneratedProblem = {
      id: 't4',
      concept: 'balance',
      prompt: 'A mystery block plus a 2-pound weight balances 7 pounds. How much does the block weigh?',
      options: ['5 lb', '2 lb', '7 lb', '9 lb'],
      correctIndex: 0,
      feedback: { correct: 'c', incorrect: ['i'] },
      check: { kind: 'value', value: 5, total: 7, count: 1, extra: 2 },
    };
    const text = explainWrongChoice(problem, 1); // chose "2 lb" (the known weight)
    expect(text).toBeTruthy();
    expect(text).toContain('2');
    expect(text).not.toContain('5'); // never hands over the answer (5 lb)
  });

  it('returns null for a value problem with no scenario model to reason from', () => {
    const problem: GeneratedProblem = {
      id: 't5',
      concept: 'balance',
      prompt: '3 boxes balance 12 pounds...',
      options: ['3 lb', '4 lb'],
      correctIndex: 1,
      feedback: { correct: 'c', incorrect: ['i'] },
      check: { kind: 'value', value: 4 },
    };
    expect(explainWrongChoice(problem, 0)).toBeNull();
  });
});

describe('masteryStartDifficulty', () => {
  it('places the first session from mastery performance', () => {
    expect(masteryStartDifficulty(null)).toBe(2);
    expect(masteryStartDifficulty(1)).toBe(3);
    expect(masteryStartDifficulty(0.9)).toBe(3);
    expect(masteryStartDifficulty(0.67)).toBe(2);
    expect(masteryStartDifficulty(0.59)).toBe(1);
    expect(masteryStartDifficulty(0)).toBe(1);
  });
});

describe('solutionSteps', () => {
  it('gives non-empty steps that reference the answer for every concept', () => {
    for (const concept of CONCEPTS) {
      for (let i = 0; i < 20; i++) {
        const problem = generateLocalProblem(concept, 3);
        const steps = solutionSteps(problem);
        expect(steps.length, `${concept}: "${problem.prompt}"`).toBeGreaterThan(0);
        const answer = problem.options[problem.correctIndex];
        const core = problem.check.kind === 'equivalent' ? answer : String(Number.parseFloat(answer));
        expect(steps.join(' '), `${concept} steps missing "${core}"`).toContain(core);
      }
    }
  });
});

describe('pickNextConcept', () => {
  it('returns the only concept for a single-item pool', () => {
    expect(pickNextConcept(['solve'], 'solve')).toBe('solve');
  });

  it('never repeats the last concept when there is a choice', () => {
    for (let i = 0; i < 100; i++) {
      const next = pickNextConcept(['balance', 'introX', 'solve'], 'solve');
      expect(next).not.toBe('solve');
      expect(['balance', 'introX']).toContain(next);
    }
  });
});

describe('isConfidentWin (effort-aware difficulty)', () => {
  it('counts a quick answer as confident', () => {
    expect(isConfidentWin(3000)).toBe(true);
    expect(isConfidentWin(0)).toBe(true);
  });
  it('counts a slow answer as not confident', () => {
    expect(isConfidentWin(CONFIDENT_WIN_MS + 1)).toBe(false);
    expect(isConfidentWin(60000)).toBe(false);
  });
  it('treats the threshold itself as confident', () => {
    expect(isConfidentWin(CONFIDENT_WIN_MS)).toBe(true);
  });
});
