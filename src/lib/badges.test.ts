import { describe, expect, it } from 'vitest';
import { newlyEarnedBadgeIds } from './badges';
import type { Badge } from './badges';

function badge(id: string, earned: boolean): Badge {
  return { id, label: id, description: `${id} description`, earned };
}

describe('newlyEarnedBadgeIds', () => {
  it('returns a newly earned badge that has not been acknowledged', () => {
    const badges = [badge('first-solve', true)];
    expect(newlyEarnedBadgeIds(badges, [])).toEqual(['first-solve']);
  });

  it('does not return an earned badge that was already acknowledged', () => {
    const badges = [badge('first-solve', true)];
    expect(newlyEarnedBadgeIds(badges, ['first-solve'])).toEqual([]);
  });

  it('never returns unearned badges', () => {
    const badges = [badge('streak-7', false)];
    expect(newlyEarnedBadgeIds(badges, [])).toEqual([]);
    expect(newlyEarnedBadgeIds(badges, ['streak-7'])).toEqual([]);
  });

  it('returns only the newly earned ids from a mix, preserving order', () => {
    const badges = [
      badge('first-solve', true), // earned and already acknowledged
      badge('streak-3', true), // earned and new
      badge('perfect', false), // not earned yet
      badge('halfway', true), // earned and new
    ];
    expect(newlyEarnedBadgeIds(badges, ['first-solve'])).toEqual(['streak-3', 'halfway']);
  });
});
