import { describe, expect, it } from 'vitest';
import {
  MASTERY_PASS_THRESHOLD,
  countMasteryCorrect,
  masteryPass,
} from './mastery';

const STEP_IDS = ['m1', 'm2', 'm3'];

describe('masteryPass', () => {
  it('passes at or above the threshold', () => {
    expect(masteryPass(MASTERY_PASS_THRESHOLD)).toBe(true);
    expect(masteryPass(MASTERY_PASS_THRESHOLD + 1)).toBe(true);
  });

  it('fails below the threshold', () => {
    expect(masteryPass(MASTERY_PASS_THRESHOLD - 1)).toBe(false);
    expect(masteryPass(0)).toBe(false);
  });
});

describe('countMasteryCorrect', () => {
  it('counts only steps explicitly marked correct', () => {
    const results = { m1: true, m2: false, m3: true };
    expect(countMasteryCorrect(STEP_IDS, results)).toBe(2);
  });

  it('treats missing or non-true results as incorrect', () => {
    const results = { m1: true } as Record<string, boolean>;
    expect(countMasteryCorrect(STEP_IDS, results)).toBe(1);
  });

  it('returns 0 when nothing is correct', () => {
    expect(countMasteryCorrect(STEP_IDS, {})).toBe(0);
  });
});
