import { describe, expect, it } from 'vitest';
import { conceptsUpTo } from './concepts';

const order = ['lesson-01', 'lesson-02', 'lesson-03', 'lesson-04', 'lesson-05'];

describe('conceptsUpTo', () => {
  it('is balance-only at lesson 1 (no x yet)', () => {
    expect(conceptsUpTo('lesson-01', order)).toEqual(['balance']);
  });

  it('adds introX at lesson 2 (reviewing balance)', () => {
    expect(conceptsUpTo('lesson-02', order)).toEqual(['balance', 'introX']);
  });

  it('adds one-step solving at lesson 3', () => {
    expect(conceptsUpTo('lesson-03', order)).toEqual(['balance', 'introX', 'solve']);
  });

  it('adds combining at lesson 4', () => {
    expect(conceptsUpTo('lesson-04', order)).toEqual(['balance', 'introX', 'solve', 'combine']);
  });

  it('adds writing expressions at lesson 5 (all skills interleaved)', () => {
    expect(conceptsUpTo('lesson-05', order)).toEqual([
      'balance',
      'introX',
      'solve',
      'combine',
      'expression',
    ]);
  });

  it('falls back to balance for an unknown lesson', () => {
    expect(conceptsUpTo('mystery', order)).toEqual(['balance']);
  });
});
