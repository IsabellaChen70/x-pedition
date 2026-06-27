import type { GeneratedProblem } from './types';

export type VerifyResult = { ok: true } | { ok: false; reason: string };

const EPSILON = 1e-9;
// Sample points used to decide expression equivalence. Several values make the
// check reliable; linear expressions that agree here agree everywhere.
const SAMPLE_POINTS = [0, 1, 2, 3, 5, 7, 11];

/**
 * Make algebra notation explicit: "2x" -> "2*x", "3(x+1)" -> "3*(x+1)",
 * ")(" -> ")*(", and strip whitespace, so the evaluator sees plain arithmetic.
 */
function normalize(expr: string): string {
  return expr
    .replace(/\s+/g, '')
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
    .replace(/([a-zA-Z)])\(/g, '$1*(');
}

/**
 * Evaluate a normalized arithmetic expression (digits, one variable, + - * /,
 * parentheses, unary +/-) with the variable bound to `x`; returns null on any
 * parse error. A tiny recursive-descent evaluator, so we don't ship a whole math
 * library just to substitute a number. The generated grammar is small and fully
 * exercised by the generator's property tests.
 */
function evaluateExpression(input: string, variable: string, x: number): number | null {
  let i = 0;

  const parseExpression = (): number | null => {
    let value = parseTerm();
    if (value === null) return null;
    while (input[i] === '+' || input[i] === '-') {
      const op = input[i++];
      const right = parseTerm();
      if (right === null) return null;
      value = op === '+' ? value + right : value - right;
    }
    return value;
  };

  const parseTerm = (): number | null => {
    let value = parseFactor();
    if (value === null) return null;
    while (input[i] === '*' || input[i] === '/') {
      const op = input[i++];
      const right = parseFactor();
      if (right === null) return null;
      value = op === '*' ? value * right : value / right;
    }
    return value;
  };

  const parseFactor = (): number | null => {
    if (input[i] === '+') {
      i++;
      return parseFactor();
    }
    if (input[i] === '-') {
      i++;
      const factor = parseFactor();
      return factor === null ? null : -factor;
    }
    if (input[i] === '(') {
      i++;
      const value = parseExpression();
      if (value === null || input[i] !== ')') return null;
      i++;
      return value;
    }
    const start = i;
    while (i < input.length && /[0-9.]/.test(input[i])) {
      i++;
    }
    if (i > start) {
      const num = Number(input.slice(start, i));
      return Number.isFinite(num) ? num : null;
    }
    if (input[i] === variable) {
      i++;
      return x;
    }
    return null;
  };

  const result = parseExpression();
  if (result === null || i !== input.length || !Number.isFinite(result)) {
    return null;
  }
  return result;
}

export function evaluateAt(expr: string, variable: string, x: number): number | null {
  return evaluateExpression(normalize(expr), variable, x);
}

/** True when two expressions agree at every sample point (algebraically equal). */
export function isEquivalent(a: string, b: string, variable: string): boolean {
  for (const x of SAMPLE_POINTS) {
    const va = evaluateAt(a, variable, x);
    const vb = evaluateAt(b, variable, x);
    if (va === null || vb === null || Math.abs(va - vb) > EPSILON) {
      return false;
    }
  }
  return true;
}

function checkCommon(problem: GeneratedProblem): VerifyResult {
  if (problem.options.length < 3 || problem.options.length > 5) {
    return { ok: false, reason: 'need between 3 and 5 options' };
  }
  const trimmed = problem.options.map((option) => option.trim());
  if (trimmed.some((option) => option.length === 0)) {
    return { ok: false, reason: 'options must be non-empty' };
  }
  if (new Set(trimmed).size !== trimmed.length) {
    return { ok: false, reason: 'options must be distinct' };
  }
  if (
    !Number.isInteger(problem.correctIndex) ||
    problem.correctIndex < 0 ||
    problem.correctIndex >= problem.options.length
  ) {
    return { ok: false, reason: 'correctIndex is out of range' };
  }
  if (
    !problem.feedback ||
    typeof problem.feedback.correct !== 'string' ||
    !problem.feedback.correct.trim() ||
    !Array.isArray(problem.feedback.incorrect) ||
    problem.feedback.incorrect.length === 0
  ) {
    return { ok: false, reason: 'feedback must include a correct message and at least one incorrect message' };
  }
  return { ok: true };
}

/**
 * Verify a generated problem against the math, never trusting the model. Exactly
 * one option must be correct and it must be the option marked correct; anything
 * malformed or ambiguous is rejected so the caller can discard and regenerate.
 */
export function verifyProblem(problem: GeneratedProblem): VerifyResult {
  const common = checkCommon(problem);
  if (!common.ok) return common;

  const { check } = problem;

  if (check.kind === 'value') {
    const matches = problem.options
      .map((option, index) => ({ index, value: Number.parseFloat(option) }))
      .filter(({ value }) => Number.isFinite(value) && Math.abs(value - check.value) < EPSILON)
      .map(({ index }) => index);
    if (matches.length !== 1) {
      return { ok: false, reason: `expected exactly one option equal to ${check.value}, found ${matches.length}` };
    }
    if (matches[0] !== problem.correctIndex) {
      return { ok: false, reason: 'correctIndex does not point to the matching option' };
    }
    return { ok: true };
  }

  if (!/^[a-zA-Z]$/.test(check.variable)) {
    return { ok: false, reason: 'variable must be a single letter' };
  }

  if (check.kind === 'solves') {
    const sides = check.equation.split('=');
    if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) {
      return { ok: false, reason: 'equation must have exactly one "=" with both sides non-empty' };
    }
    const values = problem.options.map((option) => Number(option));
    if (values.some((value) => !Number.isFinite(value))) {
      return { ok: false, reason: 'every option must be numeric' };
    }
    const solvers = values
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => {
        const left = evaluateAt(sides[0], check.variable, value);
        const right = evaluateAt(sides[1], check.variable, value);
        return left !== null && right !== null && Math.abs(left - right) < EPSILON;
      })
      .map(({ index }) => index);
    if (solvers.length !== 1) {
      return { ok: false, reason: `expected exactly one option to solve the equation, found ${solvers.length}` };
    }
    if (solvers[0] !== problem.correctIndex) {
      return { ok: false, reason: 'correctIndex does not point to the solving option' };
    }
    return { ok: true };
  }

  const matches = problem.options
    .map((option, index) => ({ index, equal: isEquivalent(option, check.expression, check.variable) }))
    .filter(({ equal }) => equal)
    .map(({ index }) => index);
  if (matches.length !== 1) {
    return { ok: false, reason: `expected exactly one equivalent option, found ${matches.length}` };
  }
  if (matches[0] !== problem.correctIndex) {
    return { ok: false, reason: 'correctIndex does not point to the equivalent option' };
  }
  return { ok: true };
}
