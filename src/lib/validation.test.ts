import { describe, expect, it } from 'vitest';
import {
  validateEqualShare,
  validateExpressionBuilder,
  validateMcStep,
  validateScaleInteractive,
  validateTileCombine,
} from './validation';
import type {
  EqualShareStep,
  ExpressionBuilderStep,
  McStep,
  ScaleInteractiveStep,
  TileCombineStep,
} from '../types/lesson';

const mcStep: McStep = {
  id: 's1',
  type: 'mc',
  prompt: 'One triangle weighs?',
  options: ['2 lb', '3 lb', '4 lb', '6 lb'],
  correctIndex: 1,
  feedback: {
    correct: 'Yes! 3 pounds.',
    incorrect: ['Try dividing 9 by 3.', 'Equal shares.'],
  },
};

describe('validateMcStep', () => {
  it('asks for an answer when nothing is selected', () => {
    expect(validateMcStep(mcStep, null)).toEqual({ ok: false, message: 'Pick an answer first.' });
  });

  it('accepts the correct option', () => {
    expect(validateMcStep(mcStep, 1)).toEqual({ ok: true, message: 'Yes! 3 pounds.' });
  });

  it('returns wrong-answer feedback cycled by index', () => {
    expect(validateMcStep(mcStep, 0).message).toBe('Try dividing 9 by 3.');
    expect(validateMcStep(mcStep, 3).message).toBe('Equal shares.');
  });
});

const followUpStep: ScaleInteractiveStep = {
  id: 's3',
  type: 'scale_interactive',
  prompt: 'Remove 1 from both sides.',
  visual: {
    type: 'scale',
    config: {
      left: [{ kind: 'unknown', label: '?' }, { kind: 'weight', value: 1 }],
      right: [{ kind: 'weight', value: 7 }],
    },
  },
  validation: { action: 'remove_from_both', value: 1, expectedUnknown: 6 },
  followUpMc: {
    prompt: 'How much is the block?',
    options: ['4 lb', '5 lb', '6 lb', '8 lb'],
    correctIndex: 2,
    feedback: { correct: 'Yes! 6 pounds.', incorrect: ['Look right.', 'Count the pounds.'] },
  },
  feedback: { correct: 'Balanced!', incorrect: ['Only one side changed.', 'Remove equally.'] },
};

const computedStep: ScaleInteractiveStep = {
  id: 's3b',
  type: 'scale_interactive',
  prompt: 'Remove 1 from both sides.',
  visual: {
    type: 'scale',
    config: {
      left: [{ kind: 'unknown', label: '?' }, { kind: 'weight', value: 1 }],
      right: [{ kind: 'weight', value: 7 }],
    },
  },
  validation: { action: 'remove_from_both', value: 1, expectedUnknown: 6 },
  feedback: { correct: 'Balanced!', incorrect: ['Only one side changed.', 'Remove equally.'] },
};

describe('validateScaleInteractive', () => {
  it('prompts to remove weight before anything happens', () => {
    const result = validateScaleInteractive(followUpStep, {
      removed: false,
      removedFromBoth: false,
      mcIndex: null,
    });
    expect(result).toEqual({ ok: false, message: 'Try removing weight from the scale first.' });
  });

  it('rejects removing from only one side', () => {
    const result = validateScaleInteractive(followUpStep, {
      removed: true,
      removedFromBoth: false,
      mcIndex: null,
    });
    expect(result).toEqual({ ok: false, message: 'Only one side changed.' });
  });

  it('asks for the follow-up answer once both sides are balanced', () => {
    const result = validateScaleInteractive(followUpStep, {
      removed: true,
      removedFromBoth: true,
      mcIndex: null,
    });
    expect(result).toEqual({ ok: false, message: 'Pick how much the mystery block is worth.' });
  });

  it('accepts the correct follow-up answer', () => {
    const result = validateScaleInteractive(followUpStep, {
      removed: true,
      removedFromBoth: true,
      mcIndex: 2,
    });
    expect(result).toEqual({ ok: true, message: 'Yes! 6 pounds.' });
  });

  it('rejects an incorrect follow-up answer', () => {
    const result = validateScaleInteractive(followUpStep, {
      removed: true,
      removedFromBoth: true,
      mcIndex: 0,
    });
    expect(result.ok).toBe(false);
  });

  it('computes the unknown when there is no follow-up question', () => {
    const result = validateScaleInteractive(computedStep, {
      removed: true,
      removedFromBoth: true,
      mcIndex: null,
    });
    expect(result).toEqual({ ok: true, message: 'Balanced!' });
  });
});

const tileStep: TileCombineStep = {
  id: 't1',
  type: 'tile_combine',
  prompt: 'Sort the tiles.',
  visual: { type: 'none' },
  validation: { totalTiles: 3, targetCount: 3, targetLabel: '3x + 3', tileLabel: 'x', distractorLabel: '3' },
  feedback: { correct: 'Sorted!', incorrect: ['Wrong box.', 'Keep going.'] },
};

describe('validateTileCombine', () => {
  it('asks the learner to start sorting', () => {
    expect(validateTileCombine(tileStep, { xCombined: 0, constantsKept: 0, misplaced: 0 }).message).toBe(
      'Drag the tiles into the boxes first.',
    );
  });

  it('accepts all x terms combined with the constant kept separate', () => {
    expect(validateTileCombine(tileStep, { xCombined: 3, constantsKept: 1, misplaced: 0 })).toEqual({
      ok: true,
      message: 'Sorted!',
    });
  });

  it('rejects an incomplete sort', () => {
    expect(validateTileCombine(tileStep, { xCombined: 2, constantsKept: 1, misplaced: 0 }).ok).toBe(false);
  });

  it('rejects a tile dropped in the wrong box', () => {
    expect(validateTileCombine(tileStep, { xCombined: 3, constantsKept: 0, misplaced: 1 }).message).toBe(
      'Wrong box.',
    );
  });
});

const equalShareStep: EqualShareStep = {
  id: 'e1',
  type: 'equal_share',
  prompt: 'Share 6 across 3 circles.',
  visual: { type: 'none' },
  validation: {
    totalItems: 6,
    groupCount: 3,
    targetPerGroup: 2,
    itemLabel: '1 lb',
    groupLabel: 'Circle',
    correctAnswer: '2 lb per circle',
  },
  feedback: { correct: 'Shared evenly!', incorrect: ['Same in each.', 'Keep sharing.'] },
};

describe('validateEqualShare', () => {
  it('prompts to start placing chips', () => {
    expect(validateEqualShare(equalShareStep, [0, 0, 0]).ok).toBe(false);
  });

  it('accepts an even split that fills every group', () => {
    expect(validateEqualShare(equalShareStep, [2, 2, 2])).toEqual({ ok: true, message: 'Shared evenly!' });
  });

  it('rejects an uneven split', () => {
    expect(validateEqualShare(equalShareStep, [3, 2, 1]).ok).toBe(false);
  });
});

const expressionStep: ExpressionBuilderStep = {
  id: 'x1',
  type: 'expression_builder',
  prompt: 'Build the expression.',
  visual: { type: 'none' },
  tokens: ['2', 'x', '+', '3'],
  validation: { expectedTokens: ['2', 'x', '+', '3'], correctAnswer: '2x + 3' },
  feedback: { correct: 'Exactly!', incorrect: ['Check the order.', 'Almost.'] },
};

describe('validateExpressionBuilder', () => {
  it('prompts to add tokens first', () => {
    expect(validateExpressionBuilder(expressionStep, []).ok).toBe(false);
  });

  it('accepts the exact token order', () => {
    expect(validateExpressionBuilder(expressionStep, ['2', 'x', '+', '3'])).toEqual({
      ok: true,
      message: 'Exactly!',
    });
  });

  it('rejects the wrong token order', () => {
    expect(validateExpressionBuilder(expressionStep, ['x', '2', '+', '3']).ok).toBe(false);
  });

  it('accepts a commutative reordering of a pure addition answer', () => {
    const sumStep: ExpressionBuilderStep = {
      id: 'x2',
      type: 'expression_builder',
      prompt: 'Build it.',
      visual: { type: 'none' },
      tokens: ['3x', '+', '2'],
      validation: { expectedTokens: ['3x', '+', '2'], correctAnswer: '3x + 2' },
      feedback: { correct: 'Yes!', incorrect: ['No.', 'Try.'] },
    };
    expect(validateExpressionBuilder(sumStep, ['2', '+', '3x']).ok).toBe(true);
    expect(validateExpressionBuilder(sumStep, ['3x', '+', '2']).ok).toBe(true);
  });
});
