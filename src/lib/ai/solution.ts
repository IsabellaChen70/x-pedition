import { evaluateAt } from './verify';
import type { GeneratedProblem } from './types';

function coeffTerm(coeff: number, variable: string): string {
  return coeff === 1 ? variable : `${coeff}${variable}`;
}

/**
 * Derive the step-by-step solution for a linear equation "LHS = RHS" by reading
 * the coefficient and constant straight off the (engine) evaluator, then undoing
 * them. Used for solve/introX problems that don't carry author-written steps.
 */
function deriveSolveSteps(equation: string, variable: string): string[] {
  const [lhs, rhs] = equation.split('=');
  if (lhs === undefined || rhs === undefined) return [];
  const atZero = evaluateAt(lhs, variable, 0);
  const atOne = evaluateAt(lhs, variable, 1);
  const target = evaluateAt(rhs, variable, 0);
  if (atZero === null || atOne === null || target === null) return [];

  const coeff = atOne - atZero;
  const constant = atZero;
  if (coeff === 0) return [];

  const steps: string[] = [];
  let working = target;
  if (constant !== 0) {
    working = target - constant;
    const lhs = coeffTerm(coeff, variable);
    steps.push(
      constant > 0
        ? `Subtract ${constant} from both sides:  ${lhs} = ${target} − ${constant} = ${working}`
        : `Add ${-constant} to both sides:  ${lhs} = ${target} + ${-constant} = ${working}`,
    );
  }
  if (coeff !== 1) {
    steps.push(`Divide both sides by ${coeff}:  ${variable} = ${working} ÷ ${coeff} = ${working / coeff}`);
  }
  if (steps.length === 0) {
    steps.push(`${variable} = ${working}`);
  }
  return steps;
}

/**
 * Worked-solution steps for a problem: use the steps the generator attached
 * (balance / combine / expression), otherwise derive them from the equation
 * (solve / introX). Shown on demand as a faded worked example.
 */
export function solutionSteps(problem: GeneratedProblem): string[] {
  if (problem.steps && problem.steps.length > 0) {
    return problem.steps;
  }
  if (problem.check.kind === 'solves') {
    return deriveSolveSteps(problem.check.equation, problem.check.variable);
  }
  return [];
}

/**
 * A grounded, deterministic explanation of why the learner's CHOSEN wrong option
 * is wrong, checked against the problem's own math (solve/equivalent) or scenario
 * (balance), so it can never contradict itself the way a free-text guess can.
 * Stays answer-safe: it names what the chosen number actually is and points at the
 * move, never the correct value. Returns null only when there's nothing concrete
 * to say, so the caller can fall back to a generic nudge.
 */
export function explainWrongChoice(problem: GeneratedProblem, chosenIndex: number): string | null {
  const chosenLabel = problem.options[chosenIndex];
  if (chosenLabel === undefined) {
    return null;
  }
  const { check } = problem;

  if (check.kind === 'solves') {
    const chosen = Number.parseFloat(chosenLabel);
    if (Number.isNaN(chosen)) return null;
    const [lhs, rhs] = check.equation.split('=');
    if (lhs === undefined || rhs === undefined) return null;
    const lhsValue = evaluateAt(lhs, check.variable, chosen);
    const target = evaluateAt(rhs, check.variable, 0);
    if (lhsValue === null || target === null || lhsValue === target) return null;
    const substituted = lhs
      .trim()
      .replace(new RegExp(`(\\d+)\\s*${check.variable}`, 'g'), `$1×${chosen}`)
      .replace(new RegExp(`\\b${check.variable}\\b`, 'g'), `${chosen}`);
    return `If ${check.variable} were ${chosen}, then ${substituted} = ${lhsValue}, but the equation needs ${target}. Do the same move to both sides to undo it and get ${check.variable} by itself.`;
  }

  if (check.kind === 'equivalent') {
    for (const x of [2, 3, 5]) {
      const chosenValue = evaluateAt(chosenLabel, check.variable, x);
      const sourceValue = evaluateAt(check.expression, check.variable, x);
      if (chosenValue !== null && sourceValue !== null && chosenValue !== sourceValue) {
        // Show THEIR value as a concrete counter-example, but never the correct
        // expression's value (that would hand over the answer).
        return `At ${check.variable} = ${x}, your answer (${chosenLabel}) works out to ${chosenValue}, but the original gives a different number, so they can't be equal for every ${check.variable}.`;
      }
    }
    return null;
  }

  // Balance word problems: name what the learner's number actually is in the
  // scenario (the whole scale, the known weight, ...) and point at the move.
  // Never states the correct weight, that's what "Show me how" is for.
  if (check.kind === 'value') {
    const chosen = Number.parseFloat(chosenLabel);
    const { total, count } = check;
    const extra = check.extra ?? 0;
    if (Number.isNaN(chosen) || total === undefined || count === undefined || chosen === check.value) {
      return null;
    }
    const shapesWeight = total - extra; // weight the shapes carry together

    if (chosen === total) {
      if (count === 1) {
        return `${total} lb is the whole scale. Take the known weight off both sides first, then read what's left.`;
      }
      return extra > 0
        ? `${total} lb is the whole scale, extra weight and all. Take the extra off, then share what's left equally among the ${count}.`
        : `${total} lb is all ${count} together, not one. Share it equally to get just one.`;
    }
    if (extra > 0 && chosen === extra) {
      return `${extra} lb is the weight you were already told, not the mystery one. Use it to take ${extra} off both sides first.`;
    }
    if (extra > 0 && chosen === total + extra) {
      return `Looks like you added the ${extra} lb. It's already on the scale, so take it off both sides instead of adding it.`;
    }
    if (count > 1 && chosen === shapesWeight) {
      return `${shapesWeight} lb is what all ${count} carry together. Share it equally to get just one.`;
    }
    return count > 1
      ? `Each one is an equal share${extra > 0 ? ' of what is left after the extra comes off' : ''}. Re-check how you split the weight among the ${count}.`
      : `Take the known weight off both sides, then read what the mystery weight balances.`;
  }

  return null;
}
