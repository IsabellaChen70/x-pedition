import { describe, expect, it } from 'vitest';
import { buildGenerationPrompt, parseGeneratedProblem } from './problemParse';
import { verifyProblem } from './verify';

const validSolve = {
  concept: 'solve',
  prompt: 'x + 2 = 6. What is x?',
  options: ['2', '4', '6', '8'],
  correctIndex: 1,
  feedbackCorrect: 'Nice!',
  feedbackIncorrect: ['Undo the +2.'],
  steps: ['Subtract 2 from both sides.'],
  checkKind: 'solves',
  equation: 'x + 2 = 6',
  variable: 'x',
};

describe('parseGeneratedProblem', () => {
  it('parses a well-formed solve problem that the engine then verifies', () => {
    const problem = parseGeneratedProblem(validSolve);
    expect(problem).not.toBeNull();
    expect(problem!.concept).toBe('solve');
    expect(problem!.check).toEqual({ kind: 'solves', equation: 'x + 2 = 6', variable: 'x' });
    expect(verifyProblem(problem!)).toEqual({ ok: true });
  });

  it('parses value (balance) and equivalent (expression) checks', () => {
    const value = parseGeneratedProblem({
      concept: 'balance',
      prompt: 'Two circles balance 8 lb. One circle?',
      options: ['2 lb', '4 lb', '6 lb'],
      correctIndex: 1,
      feedbackCorrect: 'Yes',
      feedbackIncorrect: ['Split it'],
      steps: ['8 / 2 = 4'],
      checkKind: 'value',
      value: 4,
    });
    expect(value!.check).toEqual({ kind: 'value', value: 4 });

    const equivalent = parseGeneratedProblem({
      concept: 'expression',
      prompt: 'Three times a number',
      options: ['3x', 'x + 3', 'x - 3'],
      correctIndex: 0,
      feedbackCorrect: 'Yes',
      feedbackIncorrect: ['Times means copies'],
      steps: ['3 copies of x'],
      checkKind: 'equivalent',
      expression: '3x',
      variable: 'x',
    });
    expect(equivalent!.check).toEqual({ kind: 'equivalent', expression: '3x', variable: 'x' });
  });

  it('rejects malformed payloads', () => {
    expect(parseGeneratedProblem(null)).toBeNull();
    expect(parseGeneratedProblem('nope')).toBeNull();
    expect(parseGeneratedProblem({ ...validSolve, options: ['only-one'] })).toBeNull();
    expect(parseGeneratedProblem({ ...validSolve, options: ['1', '1', '2', '3'] })).toBeNull(); // dup options
    expect(parseGeneratedProblem({ ...validSolve, correctIndex: 9 })).toBeNull();
    expect(parseGeneratedProblem({ ...validSolve, checkKind: 'solves', equation: undefined })).toBeNull();
    expect(parseGeneratedProblem({ ...validSolve, prompt: '' })).toBeNull();
  });

  it('supplies safe defaults for feedback', () => {
    const problem = parseGeneratedProblem({ ...validSolve, feedbackCorrect: '', feedbackIncorrect: [] });
    expect(problem!.feedback.correct).toBeTruthy();
    expect(problem!.feedback.incorrect.length).toBeGreaterThan(0);
  });
});

describe('buildGenerationPrompt', () => {
  it('includes each requested concept rule and the difficulty', () => {
    const prompt = buildGenerationPrompt(['balance', 'solve'], 4);
    expect(prompt).toContain('balance:');
    expect(prompt).toContain('solve:');
    expect(prompt).toContain('Difficulty: 4 of 5');
  });
});
