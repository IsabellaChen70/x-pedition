import { describe, expect, it } from 'vitest';
import { verifyProblem } from './verify';
import type { GeneratedProblem } from './types';

const solveBase: GeneratedProblem = {
  id: 'g-solve',
  concept: 'solve',
  prompt: 'Solve for x:  2x + 3 = 11',
  options: ['2', '4', '5', '7'],
  correctIndex: 1,
  feedback: { correct: 'Yes, x = 4.', incorrect: ['Undo the +3 first.'] },
  check: { kind: 'solves', equation: '2x + 3 = 11', variable: 'x' },
};

const equivBase: GeneratedProblem = {
  id: 'g-combine',
  concept: 'combine',
  prompt: 'Simplify:  2x + 3 + x',
  options: ['3x + 3', '3x', '5x + 3', '2x + 3'],
  correctIndex: 0,
  feedback: { correct: 'Nice.', incorrect: ['Combine like terms.'] },
  check: { kind: 'equivalent', expression: '2x + 3 + x', variable: 'x' },
};

describe('verifyProblem, solves', () => {
  it('accepts a correct equation', () => {
    expect(verifyProblem(solveBase)).toEqual({ ok: true });
  });

  it('handles implicit multiplication and parentheses', () => {
    const problem: GeneratedProblem = {
      ...solveBase,
      prompt: 'Solve for x:  2(x + 1) = 10',
      options: ['3', '4', '5', '6'],
      correctIndex: 1,
      check: { kind: 'solves', equation: '2(x + 1) = 10', variable: 'x' },
    };
    expect(verifyProblem(problem).ok).toBe(true);
  });

  it('rejects when the marked answer does not solve it', () => {
    expect(verifyProblem({ ...solveBase, correctIndex: 0 }).ok).toBe(false);
  });

  it('rejects when no option solves it', () => {
    expect(
      verifyProblem({ ...solveBase, check: { kind: 'solves', equation: 'x + 1 = 100', variable: 'x' } }).ok,
    ).toBe(false);
  });

  it('rejects non-numeric options', () => {
    expect(verifyProblem({ ...solveBase, options: ['four', '4', '5', '7'] }).ok).toBe(false);
  });

  it('rejects malformed equations', () => {
    expect(
      verifyProblem({ ...solveBase, check: { kind: 'solves', equation: '2x + 3', variable: 'x' } }).ok,
    ).toBe(false);
  });

  it('rejects duplicate options', () => {
    expect(verifyProblem({ ...solveBase, options: ['4', '4', '5', '7'] }).ok).toBe(false);
  });

  it('rejects a correctIndex out of range', () => {
    expect(verifyProblem({ ...solveBase, correctIndex: 9 }).ok).toBe(false);
  });
});

describe('verifyProblem, equivalent', () => {
  it('accepts a correct simplification', () => {
    expect(verifyProblem(equivBase)).toEqual({ ok: true });
  });

  it('accepts a correct written expression', () => {
    const problem: GeneratedProblem = {
      id: 'g-expr',
      concept: 'expression',
      prompt: 'Write an expression:  "two more than three times a number."',
      options: ['3x + 2', '2x + 3', '3x - 2', '5x'],
      correctIndex: 0,
      feedback: { correct: 'Yes.', incorrect: ['Match the words.'] },
      check: { kind: 'equivalent', expression: '3x + 2', variable: 'x' },
    };
    expect(verifyProblem(problem).ok).toBe(true);
  });

  it('accepts a commutative match (order does not matter)', () => {
    expect(verifyProblem({ ...equivBase, options: ['3 + 3x', '3x', '5x + 3', '2x'], correctIndex: 0 }).ok).toBe(true);
  });

  it('rejects when the marked option is not equivalent', () => {
    expect(verifyProblem({ ...equivBase, correctIndex: 1 }).ok).toBe(false);
  });

  it('rejects ambiguous options (two equivalent answers)', () => {
    expect(verifyProblem({ ...equivBase, options: ['3x + 3', '3 + 3x', '3x', '2x'], correctIndex: 0 }).ok).toBe(false);
  });
});

describe('verifyProblem, value', () => {
  const valueBase: GeneratedProblem = {
    id: 'g-balance',
    concept: 'balance',
    prompt: '4 identical circles balance 12 pounds. How much does one circle weigh?',
    options: ['2 lb', '3 lb', '4 lb', '12 lb'],
    correctIndex: 1,
    feedback: { correct: 'Yes.', incorrect: ['Divide the total by the count.'] },
    check: { kind: 'value', value: 3 },
  };

  it('accepts when exactly one option equals the value', () => {
    expect(verifyProblem(valueBase)).toEqual({ ok: true });
  });

  it('rejects when the marked option is not the value', () => {
    expect(verifyProblem({ ...valueBase, correctIndex: 2 }).ok).toBe(false);
  });

  it('rejects when no option equals the value', () => {
    expect(verifyProblem({ ...valueBase, check: { kind: 'value', value: 9 } }).ok).toBe(false);
  });
});
