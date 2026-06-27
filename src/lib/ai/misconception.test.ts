import { describe, expect, it } from 'vitest';
import {
  detectMisconception,
  getMisconception,
  MISCONCEPTIONS,
  summarizeMisconceptions,
} from './misconception';
import type { MisconceptionId } from './types';
import type {
  EqualShareStep,
  ExpressionBuilderStep,
  McStep,
  ScaleInteractiveStep,
  TileCombineStep,
} from '../../types/lesson';

const feedback = { correct: 'c', incorrect: ['i', 'j'] };

const mc: McStep = {
  id: 'q',
  type: 'mc',
  prompt: 'p',
  options: ['3', '5', '6'],
  correctIndex: 2,
  feedback,
};
const scale: ScaleInteractiveStep = {
  id: 'q',
  type: 'scale_interactive',
  prompt: 'p',
  visual: { type: 'scale', config: { left: [], right: [] } },
  validation: { action: 'remove_from_both', value: 1, expectedUnknown: 6 },
  feedback,
};
const tile: TileCombineStep = {
  id: 'q',
  type: 'tile_combine',
  prompt: 'p',
  visual: { type: 'none' },
  validation: { totalTiles: 4, targetCount: 3, targetLabel: '3x', distractorLabel: '3' },
  feedback,
};
const share: EqualShareStep = {
  id: 'q',
  type: 'equal_share',
  prompt: 'p',
  visual: { type: 'none' },
  validation: {
    totalItems: 6,
    groupCount: 3,
    targetPerGroup: 2,
    itemLabel: 'chip',
    groupLabel: 'group',
    correctAnswer: '2',
  },
  feedback,
};
const expr: ExpressionBuilderStep = {
  id: 'q',
  type: 'expression_builder',
  prompt: 'p',
  visual: { type: 'none' },
  tokens: ['x', '3', '+'],
  validation: { expectedTokens: ['3x', '+', '3'], correctAnswer: '3x + 3' },
  feedback,
};

describe('detectMisconception', () => {
  it('scale: removing from only one side', () => {
    expect(
      detectMisconception(scale, {
        type: 'scale_interactive',
        removalApplied: true,
        removedFromBoth: false,
        mcIndex: null,
      }),
    ).toBe('one-side-only');
  });

  it('scale: never applied the move', () => {
    expect(
      detectMisconception(scale, {
        type: 'scale_interactive',
        removalApplied: false,
        removedFromBoth: false,
        mcIndex: null,
      }),
    ).toBe('wrong-operation');
  });

  it('scale: balanced both sides but still wrong = a slip', () => {
    expect(
      detectMisconception(scale, {
        type: 'scale_interactive',
        removalApplied: true,
        removedFromBoth: true,
        mcIndex: 0,
      }),
    ).toBe('arithmetic-slip');
  });

  it('tile: a misplaced tile = combined unlike terms', () => {
    expect(
      detectMisconception(tile, {
        type: 'tile_combine',
        grouping: { xCombined: 3, constantsKept: 0, misplaced: 1 },
      }),
    ).toBe('combined-unlike-terms');
  });

  it('tile: wrong number of x-tiles = miscount', () => {
    expect(
      detectMisconception(tile, {
        type: 'tile_combine',
        grouping: { xCombined: 2, constantsKept: 1, misplaced: 0 },
      }),
    ).toBe('miscount');
  });

  it('tile: x-tiles right but constant left out is NOT mislabeled as combining unlike terms', () => {
    // The authored feedback is accurate here, so detection should defer (null).
    expect(
      detectMisconception(tile, {
        type: 'tile_combine',
        grouping: { xCombined: 3, constantsKept: 0, misplaced: 0 },
      }),
    ).toBeNull();
  });

  it('equal_share: unequal groups', () => {
    expect(detectMisconception(share, { type: 'equal_share', groupCounts: [3, 2, 1] })).toBe(
      'uneven-share',
    );
  });

  it('equal_share: equal groups but the wrong amount = miscount', () => {
    expect(detectMisconception(share, { type: 'equal_share', groupCounts: [1, 1, 1] })).toBe(
      'miscount',
    );
  });

  it('expression: dropped the constant', () => {
    expect(detectMisconception(expr, { type: 'expression_builder', tokens: ['3x'] })).toBe(
      'missing-constant',
    );
  });

  it('expression: wrong operation', () => {
    const plusMinus: ExpressionBuilderStep = {
      ...expr,
      validation: { expectedTokens: ['x', '+', '3'], correctAnswer: 'x + 3' },
    };
    expect(
      detectMisconception(plusMinus, { type: 'expression_builder', tokens: ['x', '-', '3'] }),
    ).toBe('wrong-operation');
  });

  it('expression: wrong coefficient', () => {
    expect(
      detectMisconception(expr, { type: 'expression_builder', tokens: ['2x', '+', '3'] }),
    ).toBe('wrong-coefficient');
  });

  it('mc: returns null (no per-option metadata to infer from)', () => {
    expect(detectMisconception(mc, { type: 'mc', selectedIndex: 0 })).toBeNull();
  });

  it('returns null when the answer does not match the step type', () => {
    expect(detectMisconception(scale, { type: 'mc', selectedIndex: 0 })).toBeNull();
  });
});

describe('misconception library', () => {
  const detectableIds: MisconceptionId[] = [
    'one-side-only',
    'wrong-operation',
    'arithmetic-slip',
    'combined-unlike-terms',
    'miscount',
    'uneven-share',
    'missing-constant',
    'wrong-coefficient',
  ];

  it('defines a complete entry for every misconception the detector can return', () => {
    for (const id of detectableIds) {
      const entry = getMisconception(id);
      expect(entry, id).toBeDefined();
      if (!entry) continue;
      expect(entry.explanation.length, id).toBeGreaterThan(0);
      // Needs more than one step so the on-demand hints (which skip the conceptual
      // one already shown as feedback) are still non-empty.
      expect(entry.hintProgression.length, id).toBeGreaterThan(1);
    }
  });

  it('keeps explanations answer-safe (no bare numbers that could be the answer)', () => {
    for (const entry of Object.values(MISCONCEPTIONS)) {
      if (!entry) continue;
      expect(/\b\d+\b/.test(entry.explanation), entry.id).toBe(false);
    }
  });
});

describe('summarizeMisconceptions (what to revisit)', () => {
  it('returns nothing for a clean run', () => {
    expect(summarizeMisconceptions([])).toEqual([]);
  });

  it('counts occurrences and orders most-frequent first', () => {
    const summary = summarizeMisconceptions([
      'combined-unlike-terms',
      'one-side-only',
      'combined-unlike-terms',
    ]);
    expect(summary[0]).toMatchObject({ id: 'combined-unlike-terms', count: 2 });
    expect(summary[1]).toMatchObject({ id: 'one-side-only', count: 1 });
    expect(summary[0].name).toBeTruthy();
    expect(summary[0].explanation).toBeTruthy();
  });

  it('limits to the top N ideas', () => {
    const summary = summarizeMisconceptions(
      ['one-side-only', 'miscount', 'uneven-share', 'wrong-coefficient'],
      2,
    );
    expect(summary.length).toBe(2);
  });

  it('drops ids with no library entry', () => {
    // An id with no MISCONCEPTIONS entry should not appear in the summary.
    expect(summarizeMisconceptions(['nonexistent' as MisconceptionId])).toEqual([]);
  });
});
