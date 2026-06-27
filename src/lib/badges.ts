/** How a badge is earned, used to group them in the Badges modal. */
export type BadgeCategory = 'quest' | 'streak' | 'practice';

export type Badge = {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  category: BadgeCategory;
};

/** Display order + section titles for grouping badges by how you earn them. */
export const BADGE_CATEGORIES: { id: BadgeCategory; title: string }[] = [
  { id: 'quest', title: 'Map Quest' },
  { id: 'streak', title: 'Streaks' },
  { id: 'practice', title: 'Practice' },
];

export type BadgeStats = {
  completedCount: number;
  totalLessons: number;
  streak: number;
  perfectLessons: number;
  masteryCorrect: number;
  practiceSolved: number;
  digsCompleted: number;
  bestLevel: number;
  reflectionsCompleted: number;
};

/** Achievements derived from saved progress, so they stay accurate without extra storage. */
export function computeBadges(s: BadgeStats): Badge[] {
  return [
    {
      id: 'first-solve',
      label: 'First Steps',
      description: 'Solve your first puzzle.',
      earned: s.masteryCorrect >= 1 || s.completedCount >= 1,
      category: 'quest',
    },
    {
      id: 'perfect',
      label: 'Sharp Navigator',
      description: 'Ace a mastery check, 3 of 3.',
      earned: s.perfectLessons >= 1,
      category: 'quest',
    },
    {
      id: 'halfway',
      label: 'Halfway There',
      description: 'Clear three lessons.',
      earned: s.completedCount >= 3,
      category: 'quest',
    },
    {
      id: 'treasure',
      label: 'Treasure Hunter',
      description: 'Finish the whole map.',
      earned: s.totalLessons > 0 && s.completedCount >= s.totalLessons,
      category: 'quest',
    },
    {
      id: 'deep-thinker',
      label: 'Deep Thinker',
      description: 'Explain your reasoning 3 times.',
      earned: s.reflectionsCompleted >= 3,
      category: 'quest',
    },
    {
      id: 'streak-3',
      label: 'On a Roll',
      description: 'Reach a 3-day streak.',
      earned: s.streak >= 3,
      category: 'streak',
    },
    {
      id: 'streak-7',
      label: 'Week Voyager',
      description: 'Reach a 7-day streak.',
      earned: s.streak >= 7,
      category: 'streak',
    },
    {
      id: 'first-dig',
      label: 'Treasure Digger',
      description: 'Finish a Daily Treasure Dig.',
      earned: s.digsCompleted >= 1,
      category: 'practice',
    },
    {
      id: 'equation-ace',
      label: 'Equation Ace',
      description: 'Solve 25 practice problems.',
      earned: s.practiceSolved >= 25,
      category: 'practice',
    },
    {
      id: 'peak-climber',
      label: 'Peak Climber',
      description: 'Reach Depth 5 in practice.',
      earned: s.bestLevel >= 5,
      category: 'practice',
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
