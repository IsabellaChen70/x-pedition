import { describe, expect, it } from 'vitest';
import {
  dateKeyInTimeZone,
  isStreakMilestone,
  nextStreakCount,
  normalizeProgress,
  shouldCelebrateStreak,
  todayKey,
  yesterdayKey,
} from './progress';

describe('nextStreakCount', () => {
  it('keeps the same count when the last activity was already today', () => {
    expect(nextStreakCount(todayKey(), 4)).toBe(4);
  });

  it('increments the streak when the last activity was yesterday', () => {
    expect(nextStreakCount(yesterdayKey(), 4)).toBe(5);
  });

  it('resets to 1 when the streak was broken (gap of more than a day)', () => {
    expect(nextStreakCount('2020-01-01', 9)).toBe(1);
  });

  it('starts a fresh streak at 1 when there is no prior activity', () => {
    expect(nextStreakCount(null, 0)).toBe(1);
    expect(nextStreakCount(undefined, 0)).toBe(1);
  });
});

describe('dateKeyInTimeZone (Central time day boundary)', () => {
  it('counts a late-evening CST session as the same calendar day, not the next UTC day', () => {
    // 01:24 UTC Jun 24 is 8:24pm Jun 23 in Chicago (CDT), the spurious-streak case.
    const eveningCst = new Date('2026-06-24T01:24:00Z');
    expect(dateKeyInTimeZone(eveningCst, 'America/Chicago')).toBe('2026-06-23');
  });

  it('rolls to the next day only after CST midnight', () => {
    // 06:00 UTC Jun 24 is 1:00am Jun 24 in Chicago.
    const afterMidnightCst = new Date('2026-06-24T06:00:00Z');
    expect(dateKeyInTimeZone(afterMidnightCst, 'America/Chicago')).toBe('2026-06-24');
  });

  it('formats as YYYY-MM-DD', () => {
    expect(dateKeyInTimeZone(new Date('2026-01-05T12:00:00Z'), 'America/Chicago')).toBe('2026-01-05');
  });
});

describe('shouldCelebrateStreak', () => {
  it('celebrates when the streak advances past the last celebrated value', () => {
    expect(shouldCelebrateStreak(3, 2)).toBe(true);
    expect(shouldCelebrateStreak(1, 0)).toBe(true);
  });

  it('does not celebrate the same streak twice', () => {
    expect(shouldCelebrateStreak(3, 3)).toBe(false);
  });

  it('does not celebrate a zero or reset streak', () => {
    expect(shouldCelebrateStreak(0, 0)).toBe(false);
  });

  it('does not celebrate when somehow behind the last celebrated value', () => {
    expect(shouldCelebrateStreak(2, 5)).toBe(false);
  });
});

describe('isStreakMilestone', () => {
  it('flags every seventh day as a milestone', () => {
    expect(isStreakMilestone(7)).toBe(true);
    expect(isStreakMilestone(14)).toBe(true);
    expect(isStreakMilestone(21)).toBe(true);
  });

  it('does not flag non-multiples of seven', () => {
    expect(isStreakMilestone(1)).toBe(false);
    expect(isStreakMilestone(6)).toBe(false);
    expect(isStreakMilestone(8)).toBe(false);
  });

  it('does not flag a zero streak', () => {
    expect(isStreakMilestone(0)).toBe(false);
  });
});

describe('normalizeProgress', () => {
  it('defaults lastCelebratedStreak to 0 for legacy docs missing the field', () => {
    const result = normalizeProgress({ streakCount: 4 }, 'lesson-01');
    expect(result.lastCelebratedStreak).toBe(0);
    expect(result.streakCount).toBe(4);
  });

  it('preserves a stored lastCelebratedStreak value', () => {
    const result = normalizeProgress({ streakCount: 4, lastCelebratedStreak: 4 }, 'lesson-01');
    expect(result.lastCelebratedStreak).toBe(4);
  });

  it('falls back to the first lesson id for an empty/invalid doc', () => {
    expect(normalizeProgress(null, 'lesson-01').currentLessonId).toBe('lesson-01');
    expect(normalizeProgress(null, 'lesson-01').lastCelebratedStreak).toBe(0);
  });
});
