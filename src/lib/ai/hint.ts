/**
 * Deterministic Socratic hint progression (AI-free).
 *
 * Hints escalate in scaffolded practice only: Hint 1 is a conceptual nudge,
 * Hint 2 points toward the right move, Hint 3 suggests the next step, and none
 * of them reveal the answer. Always instant; they become misconception-specific
 * once one is detected. Pure + unit-testable; mirrors `solution.ts`.
 */
import type { Step } from '../../types/lesson';
import type { Misconception } from './types';

/** The step's authored static hint, if any (not all step types carry one). */
function authoredHint(step: Step): string | null {
  return 'hint' in step && typeof step.hint === 'string' && step.hint.length > 0 ? step.hint : null;
}

/** The step's authored targeted hint escalation (preferred over generic nudges). */
function authoredHints(step: Step): string[] | null {
  if ('hints' in step && Array.isArray(step.hints)) {
    const cleaned = step.hints.filter((hint) => typeof hint === 'string' && hint.length > 0);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return null;
}

/** Generic, answer-safe escalation for each interactive question type. */
function typeProgression(step: Step): string[] {
  switch (step.type) {
    case 'scale_interactive':
      return [
        'A balance stays even only when both sides match.',
        'Whatever you take off one pan, take the same off the other.',
        'Try removing the loose weights from both pans, then read what one shape balances.',
      ];
    case 'tile_combine':
      return [
        'Only tiles of the same kind can be grouped together.',
        'Gather the matching x-tiles; keep the plain number out of the combine box.',
        'Count just the x-tiles to name the combined term.',
      ];
    case 'equal_share':
      return [
        'Each group should end up with the same amount.',
        'Share the items out evenly across the groups.',
        'Deal them one per group, round by round, until none are left.',
      ];
    case 'expression_builder':
      return [
        'Match each part of the sentence to a piece of the expression.',
        "\u201cTimes a number\u201d is the number in front of x; \u201cmore\u201d or \u201cless\u201d adds or subtracts.",
        'Build it in order: the number-times-x part first, then the + or - number.',
      ];
    case 'mc':
      return [
        'Think about the main idea the question is testing before you choose.',
        'Rule out the choices you can already tell are wrong.',
        'Re-read the question and match it to the choice that fits exactly.',
      ];
    default:
      return [];
  }
}

/**
 * The escalating hint levels for a step (L1..L3), answer-safe. Priority:
 * 1) a detected misconception's targeted fix-steps (addresses the actual mistake),
 * 2) the question's own authored `hints` (targeted to THIS problem),
 * 3) a single authored `hint` + generic type nudges (legacy fallback).
 * The generic nudges are a safety net only and should not surface once a question
 * carries its own `hints`.
 */
export function deterministicHints(step: Step, misconception?: Misconception | null): string[] {
  if (misconception && misconception.hintProgression.length > 0) {
    // The conceptual "why" is already shown as the misconception feedback, so the
    // on-demand hints start from the next, more actionable step to avoid repeating it.
    const actionable = misconception.hintProgression.slice(1);
    return actionable.length > 0 ? actionable : misconception.hintProgression;
  }
  const targeted = authoredHints(step);
  if (targeted) {
    return targeted;
  }
  const base = typeProgression(step);
  if (base.length === 0) {
    return [];
  }
  const authored = authoredHint(step);
  return authored ? [authored, ...base.slice(1)] : base;
}

/**
 * Strings an AI-personalized hint must never contain (the answer), so we can
 * reject and fall back to the deterministic hint. Read straight from the step's
 * validation, the same source of truth the grader uses.
 */
export function answerStringsToAvoid(step: Step): string[] {
  switch (step.type) {
    case 'mc':
      return [step.options[step.correctIndex]].filter(Boolean) as string[];
    case 'scale_interactive': {
      const out = [String(step.validation.expectedUnknown)];
      if (step.followUpMc) {
        out.push(step.followUpMc.options[step.followUpMc.correctIndex] ?? '');
      }
      return out.filter(Boolean);
    }
    case 'tile_combine':
      return [step.validation.targetLabel].filter(Boolean);
    case 'equal_share':
      return [step.validation.correctAnswer, String(step.validation.targetPerGroup)].filter(Boolean);
    case 'expression_builder':
      return [step.validation.correctAnswer].filter(Boolean);
    default:
      return [];
  }
}
