export type Badge = {
  id: string;
  label: string;
  description: string;
  earned: boolean;
};

export type BadgeStats = {
  completedCount: number;
  totalLessons: number;
  streak: number;
  perfectLessons: number;
  masteryCorrect: number;
};

/** Achievements derived from saved progress, so they stay accurate without extra storage. */
export function computeBadges(s: BadgeStats): Badge[] {
  return [
    {
      id: 'first-solve',
      label: 'First Steps',
      description: 'Solve your first puzzle.',
      earned: s.masteryCorrect >= 1 || s.completedCount >= 1,
    },
    {
      id: 'streak-3',
      label: 'On a Roll',
      description: 'Reach a 3-day streak.',
      earned: s.streak >= 3,
    },
    {
      id: 'perfect',
      label: 'Sharp Navigator',
      description: 'Ace a mastery check, 3 of 3.',
      earned: s.perfectLessons >= 1,
    },
    {
      id: 'halfway',
      label: 'Halfway There',
      description: 'Clear three lessons.',
      earned: s.completedCount >= 3,
    },
    {
      id: 'streak-7',
      label: 'Week Voyager',
      description: 'Reach a 7-day streak.',
      earned: s.streak >= 7,
    },
    {
      id: 'treasure',
      label: 'Treasure Hunter',
      description: 'Finish the whole map.',
      earned: s.totalLessons > 0 && s.completedCount >= s.totalLessons,
    },
  ];
}

/**
 * The ids of badges that are earned but not yet acknowledged. Because badges are
 * derived from progress rather than stored, we compare against the persisted
 * acknowledged ids to celebrate each badge exactly once.
 */
export function newlyEarnedBadgeIds(badges: Badge[], acknowledgedIds: string[]): string[] {
  return badges
    .filter((badge) => badge.earned && !acknowledgedIds.includes(badge.id))
    .map((badge) => badge.id);
}
