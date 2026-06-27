/**
 * Deterministic misconception detection (AI-free).
 *
 * On a WRONG answer, we infer the likely misunderstanding straight from the
 * learner's structured answer vs the step's validation, never from the LLM. The
 * detected misconception drives two things: the feedback names what happened
 * ("It looks like you..."), and the Get Hint escalation switches to that
 * misconception's fix steps. Pure + unit-testable; mirrors `solution.ts`.
 */
import type { Step } from '../../types/lesson';
import type { TileGrouping } from '../validation';
import type { Misconception, MisconceptionId } from './types';

/** The learner's raw answer at submit time, paired with the step it answers. */
export type LearnerAnswer =
  | { type: 'mc'; selectedIndex: number }
  | {
      type: 'scale_interactive';
      removalApplied: boolean;
      removedFromBoth: boolean;
      mcIndex: number | null;
    }
  | { type: 'tile_combine'; grouping: TileGrouping }
  | { type: 'equal_share'; groupCounts: number[] }
  | { type: 'expression_builder'; tokens: string[] };

/**
 * The misconception library. Explanations are answer-safe and written in the
 * "it looks like you..." voice; each `hintProgression` escalates L1 -> L3 without
 * revealing the answer. Only the entries the detector can produce are defined.
 */
export const MISCONCEPTIONS: Partial<Record<MisconceptionId, Misconception>> = {
  'one-side-only': {
    id: 'one-side-only',
    name: 'Changed only one side',
    description: 'Removed weight from one pan but not the other.',
    explanation:
      'It looks like you changed only one side. A balance stays even only if you do the same thing to both pans.',
    hintProgression: [
      'A balance stays even only when both sides change together.',
      'Whatever you took off one pan, take the same off the other.',
      'With both pans matched, read what one shape balances.',
    ],
  },
  'wrong-operation': {
    id: 'wrong-operation',
    name: 'Different move needed',
    description: 'Did not apply the balancing move before answering.',
    explanation:
      'It looks like the balancing move was not applied yet. Try changing the scale before you choose.',
    hintProgression: [
      'To find the shape, simplify the scale first.',
      'Take the loose weights off both pans equally.',
      'Then read what a single shape balances.',
    ],
  },
  'arithmetic-slip': {
    id: 'arithmetic-slip',
    name: 'Small slip',
    description: 'Right method, small arithmetic error.',
    explanation:
      'Your method looks right. It seems like a small arithmetic slip, so recount and check.',
    hintProgression: [
      'Your approach is right; recheck the counting.',
      'Redo the last step slowly.',
      'Compare each side to what the picture shows.',
    ],
  },
  'combined-unlike-terms': {
    id: 'combined-unlike-terms',
    name: 'Combined unlike terms',
    description: 'Grouped x-tiles together with plain numbers.',
    explanation:
      'It looks like different kinds of tiles got grouped together. Only tiles of the same kind can be combined.',
    hintProgression: [
      'Only the same kind of tile can be combined.',
      'Keep the plain number out of the x box.',
      'Count just the x-tiles to name the combined term.',
    ],
  },
  miscount: {
    id: 'miscount',
    name: 'Count is off',
    description: 'Right idea, but the count does not match.',
    explanation:
      'The idea looks right, but the count is a little off. Recount carefully and compare to the picture.',
    hintProgression: [
      'You have the right idea; check the count.',
      'Recount one item at a time.',
      'Match your count to what the picture shows.',
    ],
  },
  'uneven-share': {
    id: 'uneven-share',
    name: 'Groups not equal',
    description: 'Groups ended up with different amounts.',
    explanation:
      'It looks like the groups are not equal. Sharing fairly means every group gets the same amount.',
    hintProgression: [
      'Equal sharing means every group is the same.',
      'Even out the groups so none has more than another.',
      'Deal them one to each group, round by round.',
    ],
  },
  'missing-constant': {
    id: 'missing-constant',
    name: 'Dropped the number',
    description: 'Left out the added or subtracted constant.',
    explanation:
      'It looks like the plain number got left out. Check whether the sentence adds or subtracts an amount.',
    hintProgression: [
      'Read the whole sentence, including the number part.',
      '"More" adds a number; "less" subtracts one.',
      'Add the number piece after the x part.',
    ],
  },
  'wrong-coefficient': {
    id: 'wrong-coefficient',
    name: 'Number in front is off',
    description: 'Wrong coefficient on x.',
    explanation:
      'It looks like the number in front of x does not match the words. "Times a number" tells you that number.',
    hintProgression: [
      'The number in front of x comes from "times a number".',
      'Match the multiplier in the sentence to the number on x.',
      'Then add the separate number.',
    ],
  },
};

/** Look up a misconception entry by id, if defined. */
export function getMisconception(id: MisconceptionId): Misconception | undefined {
  return MISCONCEPTIONS[id];
}

/** One row of the "what to revisit" summary: a misconception and how often it came up. */
export type MisconceptionSummary = {
  id: MisconceptionId;
  name: string;
  /** Answer-safe, 7th-grade explanation of the idea to revisit. */
  explanation: string;
  count: number;
};

/**
 * Roll a session's detected misconceptions into a short "what to revisit" list,
 * most frequent first. Pure; drives the metacognition nudge on completion screens.
 * Unknown ids (no library entry) are dropped so we only surface real, teachable ideas.
 */
export function summarizeMisconceptions(
  ids: MisconceptionId[],
  limit = 2,
): MisconceptionSummary[] {
  const counts = new Map<MisconceptionId, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => {
      const entry = getMisconception(id);
      return entry ? { id, name: entry.name, explanation: entry.explanation, count } : null;
    })
    .filter((row): row is MisconceptionSummary => row !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Infer the likely misconception behind a WRONG answer from the structured answer
 * vs the step's validation. Returns null when we cannot tell with confidence
 * (e.g. plain multiple choice), it never guesses, and never consults the LLM.
 */
export function detectMisconception(step: Step, answer: LearnerAnswer): MisconceptionId | null {
  switch (step.type) {
    case 'scale_interactive': {
      if (answer.type !== 'scale_interactive') return null;
      if (answer.removalApplied && !answer.removedFromBoth) return 'one-side-only';
      if (!answer.removalApplied) return 'wrong-operation';
      return 'arithmetic-slip';
    }
    case 'tile_combine': {
      if (answer.type !== 'tile_combine') return null;
      const { xCombined, misplaced } = answer.grouping;
      if (misplaced > 0) return 'combined-unlike-terms';
      if (xCombined !== step.validation.targetCount) return 'miscount';
      // Combined the x-tiles correctly but mishandled the constant: the authored
      // feedback ("keep the number in its own box") is accurate, so don't override
      // it with a misleading "combined unlike terms" message.
      return null;
    }
    case 'equal_share': {
      if (answer.type !== 'equal_share') return null;
      const counts = answer.groupCounts;
      const first = counts[0] ?? 0;
      if (!counts.every((count) => count === first)) return 'uneven-share';
      return 'miscount';
    }
    case 'expression_builder': {
      if (answer.type !== 'expression_builder') return null;
      return detectExpressionMisconception(step.validation.expectedTokens, answer.tokens);
    }
    default:
      return null;
  }
}

function detectExpressionMisconception(expected: string[], tokens: string[]): MisconceptionId | null {
  const isNumber = (token: string) => /^\d+$/.test(token);
  const isOperator = (token: string) => token === '+' || token === '-';
  const hasVariable = (token: string) => /x/i.test(token);

  const expectedConstant = expected.find(isNumber);
  if (expectedConstant && !tokens.some(isNumber)) {
    return 'missing-constant';
  }
  const expectedOperator = expected.find(isOperator);
  const chosenOperator = tokens.find(isOperator);
  if (expectedOperator && chosenOperator && expectedOperator !== chosenOperator) {
    return 'wrong-operation';
  }
  const expectedVariable = expected.find(hasVariable);
  const chosenVariable = tokens.find(hasVariable);
  if (expectedVariable && chosenVariable && expectedVariable !== chosenVariable) {
    return 'wrong-coefficient';
  }
  return null;
}
