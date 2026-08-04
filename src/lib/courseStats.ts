import type { CourseProgress } from './progress';
import { earnedXp, levelForXp, XP_PER_LEVEL, xpIntoLevel } from './xp';

export type HeaderStats = {
  level: number;
  /** XP earned into the current level (0..XP_PER_LEVEL). */
  xp: number;
  xpToNext: number;
  streak: number;
};

/**
 * The level, into-level XP, and streak the AppHeader shows, derived from saved
 * progress the same way HomePage does. Pulled out so the lesson screen can keep
 * the habit-loop stats visible without duplicating the XP math. A null progress
 * (still loading) reads as a fresh level-1 header.
 */
export function headerStatsFromProgress(
  progress: CourseProgress | null,
  lessonIds: string[],
): HeaderStats {
  if (!progress) {
    return { level: levelForXp(0), xp: xpIntoLevel(0), xpToNext: XP_PER_LEVEL, streak: 0 };
  }

  let masteryCorrect = 0;
  for (const lessonId of lessonIds) {
    const saved = progress.lessons[lessonId];
    if (!saved) {
      continue;
    }
    masteryCorrect += Object.values(saved.masteryResults ?? {}).filter(Boolean).length;
  }

  const totalXp = earnedXp({
    completedCount: progress.completedLessonIds.length,
    masteryCorrect,
    practiceSolved: progress.practice.solvedTotal,
    reflectionsCompleted: progress.reflectionsCompleted,
  });

  return {
    level: levelForXp(totalXp),
    xp: xpIntoLevel(totalXp),
    xpToNext: XP_PER_LEVEL,
    streak: progress.streakCount,
  };
}
