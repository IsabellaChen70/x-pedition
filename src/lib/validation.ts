import type {
  EqualShareStep,
  ExpressionBuilderStep,
  McStep,
  ScaleInteractiveStep,
  Step,
  TileCombineStep,
} from '../types/lesson';
import { getUnknownValue, removeWeightFromBothSides } from './scale';

export type ValidationResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export function validateMcStep(step: McStep, selectedIndex: number | null): ValidationResult {
  if (selectedIndex === null) {
    return { ok: false, message: 'Pick an answer first.' };
  }
  if (selectedIndex === step.correctIndex) {
    return { ok: true, message: step.feedback.correct };
  }
  const incorrect =
    step.feedback.incorrect[selectedIndex % step.feedback.incorrect.length] ??
    step.feedback.incorrect[0];
  return { ok: false, message: incorrect };
}

export function validateScaleInteractive(
  step: ScaleInteractiveStep,
  state: { removed: boolean; removedFromBoth: boolean; mcIndex: number | null },
): ValidationResult {
  if (!state.removed) {
    return { ok: false, message: 'Try removing weight from the scale first.' };
  }

  const { validation, feedback } = step;

  if (validation.action === 'remove_from_both') {
    if (!state.removedFromBoth) {
      return {
        ok: false,
        message:
          feedback.incorrect[0] ?? 'You changed only one side. Both sides must stay equal.',
      };
    }

    if (step.followUpMc) {
      if (state.mcIndex === null) {
        return { ok: false, message: 'Pick how much the mystery block is worth.' };
      }
      if (state.mcIndex === step.followUpMc.correctIndex) {
        return { ok: true, message: step.followUpMc.feedback.correct };
      }
      const incorrect =
        step.followUpMc.feedback.incorrect[state.mcIndex % step.followUpMc.feedback.incorrect.length] ??
        step.followUpMc.feedback.incorrect[0];
      return { ok: false, message: incorrect };
    }

    const after = removeWeightFromBothSides(step.visual.config, validation.value);
    const unknown = getUnknownValue(after);

    if (unknown === validation.expectedUnknown) {
      return { ok: true, message: feedback.correct };
    }

    return {
      ok: false,
      message: feedback.incorrect[1] ?? feedback.incorrect[0],
    };
  }

  return { ok: false, message: 'Something went wrong. Try again.' };
}

export type TileGrouping = {
  /** Like terms (x tiles) placed in the combine box. */
  xCombined: number;
  /** Constant tiles placed in their own box. */
  constantsKept: number;
  /** Tiles dropped in the wrong box (an x with the constant, or a constant with the x's). */
  misplaced: number;
};

export function validateTileCombine(
  step: TileCombineStep,
  grouped: TileGrouping,
): ValidationResult {
  const { xCombined, constantsKept, misplaced } = grouped;
  const constantsNeeded = step.validation.distractorLabel ? 1 : 0;

  if (xCombined === 0 && constantsKept === 0 && misplaced === 0) {
    return { ok: false, message: 'Drag the tiles into the boxes first.' };
  }

  if (misplaced > 0) {
    return {
      ok: false,
      message: step.feedback.incorrect[0] ?? 'That tile is in the wrong box.',
    };
  }

  if (xCombined === step.validation.targetCount && constantsKept === constantsNeeded) {
    return { ok: true, message: step.feedback.correct };
  }

  return {
    ok: false,
    message: step.feedback.incorrect[1] ?? step.feedback.incorrect[0],
  };
}

export function validateEqualShare(
  step: EqualShareStep,
  groupCounts: number[],
): ValidationResult {
  const { targetPerGroup, groupCount } = step.validation;
  const filledGroups = groupCounts.filter((count) => count > 0).length;

  if (filledGroups === 0) {
    return { ok: false, message: `Drag or tap the ${step.validation.itemLabel} chips into the groups first.` };
  }

  const allGroupsFilled = groupCounts.length === groupCount && groupCounts.every((count) => count === targetPerGroup);
  if (allGroupsFilled) {
    return { ok: true, message: step.feedback.correct };
  }

  const incorrect =
    step.feedback.incorrect[filledGroups % step.feedback.incorrect.length] ??
    step.feedback.incorrect[0];
  return { ok: false, message: incorrect };
}

export function validateExpressionBuilder(
  step: ExpressionBuilderStep,
  selectedTokens: string[],
): ValidationResult {
  if (selectedTokens.length === 0) {
    return { ok: false, message: 'Drag or tap tokens into the expression first.' };
  }

  const expected = step.validation.expectedTokens;
  const exactMatch =
    selectedTokens.length === expected.length &&
    selectedTokens.every((token, index) => token === expected[index]);

  // Addition commutes, so accept any ordering of a pure "a + b + ..." answer
  // (e.g. "2 + 3x" is just as correct as "3x + 2").
  if (exactMatch || isSameAdditionExpression(selectedTokens, expected)) {
    return { ok: true, message: step.feedback.correct };
  }

  const incorrect =
    step.feedback.incorrect[selectedTokens.length % step.feedback.incorrect.length] ??
    step.feedback.incorrect[0];
  return { ok: false, message: incorrect };
}

/** Operands of a pure addition expression (operand, "+", operand, ...), or null. */
function additionOperands(tokens: string[]): string[] | null {
  const operands: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) {
      if (tokens[i] === '+') return null;
      operands.push(tokens[i]);
    } else if (tokens[i] !== '+') {
      return null;
    }
  }
  return operands.length > 0 ? operands : null;
}

function isSameAdditionExpression(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const oa = additionOperands(a);
  const ob = additionOperands(b);
  if (!oa || !ob || oa.length !== ob.length) return false;
  const sortedA = [...oa].sort();
  const sortedB = [...ob].sort();
  return sortedA.every((token, i) => token === sortedB[i]);
}

export function getStepsForPhase(lesson: { phases: { scaffolded: Step[]; mastery: Step[] } }, phase: 'scaffolded' | 'mastery'): Step[] {
  return phase === 'scaffolded' ? lesson.phases.scaffolded : lesson.phases.mastery;
}
