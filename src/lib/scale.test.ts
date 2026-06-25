import { describe, expect, it } from 'vitest';
import {
  canApplyRemoveFromBoth,
  getUnknownValue,
  removeWeightFromBothSides,
  removeWeightFromLeftOnly,
} from './scale';
import type { ScaleVisualConfig } from '../types/lesson';

// Mirrors lesson-01 step s3: "?" + 1 lb balances 7 lb.
function unknownPlusWeight(): ScaleVisualConfig {
  return {
    left: [{ kind: 'unknown', label: '?' }, { kind: 'weight', value: 1 }],
    right: [{ kind: 'weight', value: 7 }],
  };
}

describe('removeWeightFromBothSides', () => {
  it('removes an exact weight from the left and subtracts from a larger right block', () => {
    const after = removeWeightFromBothSides(unknownPlusWeight(), 1);
    expect(after.left).toEqual([{ kind: 'unknown', label: '?' }]);
    expect(after.right).toEqual([{ kind: 'weight', value: 6 }]);
  });

  it('does not mutate the original config', () => {
    const config = unknownPlusWeight();
    removeWeightFromBothSides(config, 1);
    expect(config.left).toHaveLength(2);
    expect(config.right).toEqual([{ kind: 'weight', value: 7 }]);
  });

  it('isolates the unknown so its value can be read off the scale', () => {
    const after = removeWeightFromBothSides(unknownPlusWeight(), 1);
    expect(getUnknownValue(after)).toBe(6);
  });
});

describe('removeWeightFromLeftOnly', () => {
  it('removes from the left while leaving the right untouched (the wrong move)', () => {
    const after = removeWeightFromLeftOnly(unknownPlusWeight(), 1);
    expect(after.left).toEqual([{ kind: 'unknown', label: '?' }]);
    expect(after.right).toEqual([{ kind: 'weight', value: 7 }]);
  });
});

describe('canApplyRemoveFromBoth', () => {
  it('allows removal when the left has the weight and the right can cover it', () => {
    expect(canApplyRemoveFromBoth(unknownPlusWeight(), 1)).toBe(true);
  });

  it('rejects removal when the left lacks that weight', () => {
    expect(canApplyRemoveFromBoth(unknownPlusWeight(), 2)).toBe(false);
  });

  it('rejects removal when the right cannot cover the amount', () => {
    const config: ScaleVisualConfig = {
      left: [{ kind: 'unknown' }, { kind: 'weight', value: 10 }],
      right: [{ kind: 'weight', value: 3 }],
    };
    expect(canApplyRemoveFromBoth(config, 10)).toBe(false);
  });
});

describe('getUnknownValue', () => {
  it('solves for an unknown on the left', () => {
    const config: ScaleVisualConfig = {
      left: [{ kind: 'unknown' }, { kind: 'weight', value: 5 }],
      right: [{ kind: 'weight', value: 13 }],
    };
    expect(getUnknownValue(config)).toBe(8);
  });

  it('solves for an unknown on the right', () => {
    const config: ScaleVisualConfig = {
      left: [{ kind: 'weight', value: 13 }],
      right: [{ kind: 'unknown' }, { kind: 'weight', value: 5 }],
    };
    expect(getUnknownValue(config)).toBe(8);
  });

  it('returns null when neither side has an unknown', () => {
    const config: ScaleVisualConfig = {
      left: [{ kind: 'shape', shape: 'triangle', count: 3 }],
      right: [{ kind: 'weight', value: 9 }],
    };
    expect(getUnknownValue(config)).toBeNull();
  });
});
