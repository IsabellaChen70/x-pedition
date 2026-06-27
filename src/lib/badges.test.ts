import { describe, expect, it } from 'vitest';
import { computeBadges, newlyEarnedBadgeIds } from './badges';
import type { Badge, BadgeStats } from './badges';

function badge(id: string, earned: boolean): Badge {
  return { id, label: id, description: `${id} description`, earned, category: 'quest' };
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

const EMPTY_STATS: BadgeStats = {
  completedCount: 0,
  totalLessons: 5,
  streak: 0,
  perfectLessons: 0,
  masteryCorrect: 0,
  practiceSolved: 0,
  digsCompleted: 0,
  bestLevel: 0,
  reflectionsCompleted: 0,
};

function earnedIds(overrides: Partial<BadgeStats>): string[] {
  return computeBadges({ ...EMPTY_STATS, ...overrides })
    .filter((b) => b.earned)
    .map((b) => b.id);
}

describe('computeBadges practice badges', () => {
  it('awards Treasure Digger after a completed dig', () => {
    expect(earnedIds({ digsCompleted: 1 })).toContain('first-dig');
  });

  it('awards Equation Ace at 25 solved, not before', () => {
    expect(earnedIds({ practiceSolved: 25 })).toContain('equation-ace');
    expect(earnedIds({ practiceSolved: 24 })).not.toContain('equation-ace');
  });

  it('awards Peak Climber at level 5, not before', () => {
    expect(earnedIds({ bestLevel: 5 })).toContain('peak-climber');
    expect(earnedIds({ bestLevel: 4 })).not.toContain('peak-climber');
  });

  it('awards Deep Thinker after 3 explanations, not before', () => {
    expect(earnedIds({ reflectionsCompleted: 3 })).toContain('deep-thinker');
    expect(earnedIds({ reflectionsCompleted: 2 })).not.toContain('deep-thinker');
  });

  it('awards no practice badges with empty stats', () => {
    const ids = earnedIds({});
    expect(ids).not.toContain('first-dig');
    expect(ids).not.toContain('equation-ace');
    expect(ids).not.toContain('peak-climber');
  });
});
