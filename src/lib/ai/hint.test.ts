import { describe, expect, it } from 'vitest';
import { answerStringsToAvoid, deterministicHints } from './hint';
import { getMisconception } from './misconception';
import type {
  ConceptStep,
  EqualShareStep,
  ExpressionBuilderStep,
  McStep,
  ScaleInteractiveStep,
  TileCombineStep,
} from '../../types/lesson';

const feedback = { correct: 'c', incorrect: ['i'] };

const mcWithHint: McStep = {
  id: 'q',
  type: 'mc',
  prompt: 'p',
  options: ['3', '5', '6'],
  correctIndex: 2,
  hint: 'Authored hint',
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
  validation: { totalTiles: 4, targetCount: 3, targetLabel: '3x' },
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

describe('deterministicHints', () => {
  it('uses the authored hint as the conceptual first level', () => {
    const levels = deterministicHints(mcWithHint);
    expect(levels[0]).toBe('Authored hint');
    expect(levels.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to the generic per-type escalation with no authored hint', () => {
    const noHint: McStep = { ...mcWithHint, hint: undefined };
    expect(deterministicHints(noHint).length).toBe(3);
  });

  it('uses the question-specific authored hints verbatim, with no generic filler', () => {
    const targeted: McStep = {
      ...mcWithHint,
      hint: 'Authored hint',
      hints: ['Picture the scale balancing.', 'Split the total across the shapes.'],
    };
    expect(deterministicHints(targeted)).toEqual([
      'Picture the scale balancing.',
      'Split the total across the shapes.',
    ]);
  });

  it('returns no hints for concept (teaching) steps', () => {
    const concept: ConceptStep = { id: 'c', type: 'concept', title: 't', body: 'b' };
    expect(deterministicHints(concept)).toEqual([]);
  });

  it('switches to the misconception fix-steps, skipping the conceptual one already shown', () => {
    const entry = getMisconception('one-side-only');
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(deterministicHints(scale, entry)).toEqual(entry.hintProgression.slice(1));
  });

  it('never leaks the answer in any hint level', () => {
    for (const step of [mcWithHint, scale, tile, share, expr]) {
      const avoid = answerStringsToAvoid(step);
      for (const level of deterministicHints(step)) {
        for (const answer of avoid) {
          expect(level.includes(answer), `${step.type}: "${level}"`).toBe(false);
        }
      }
    }
  });
});

describe('answerStringsToAvoid', () => {
  it('mc -> the correct option', () => {
    expect(answerStringsToAvoid(mcWithHint)).toContain('6');
  });
  it('scale -> the expected unknown', () => {
    expect(answerStringsToAvoid(scale)).toContain('6');
  });
  it('tile -> the target label', () => {
    expect(answerStringsToAvoid(tile)).toContain('3x');
  });
  it('equal_share -> the correct answer', () => {
    expect(answerStringsToAvoid(share)).toContain('2');
  });
  it('expression -> the correct answer', () => {
    expect(answerStringsToAvoid(expr)).toContain('3x + 3');
  });
});
