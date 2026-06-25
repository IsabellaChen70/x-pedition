import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import AchievementsModal from '../components/AchievementsModal';
import AppHeader from '../components/AppHeader';
import BadgeUnlockModal from '../components/BadgeUnlockModal';
import TreasureMap from '../components/TreasureMap';
import type { MapSection, MapStop } from '../components/TreasureMap';
import TreasureModal from '../components/TreasureModal';
import { Alert } from '../components/ui';
import { computeBadges, newlyEarnedBadgeIds } from '../lib/badges';
import type { Badge } from '../lib/badges';
import { getCourse, getLesson, listLessons } from '../lib/content';
import {
  acknowledgeBadges,
  acknowledgeStreakCelebration,
  getCourseProgress,
  resetCourseProgress,
  shouldCelebrateStreak,
} from '../lib/progress';
import type { CourseProgress } from '../lib/progress';

type LessonCardStatus = 'completed' | 'current' | 'unlocked' | 'locked';

export default function HomePage() {
  const { signOut, user } = useAuth();
  const course = getCourse();
  const lessons = listLessons();
  const firstLessonId = lessons[0]?.id;
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [resettingProgress, setResettingProgress] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showTreasure, setShowTreasure] = useState(false);
  const [celebrateStreak, setCelebrateStreak] = useState(false);
  const [unlockedBadges, setUnlockedBadges] = useState<Badge[]>([]);
  const badgeCelebrationShown = useRef(false);
  const completedCount = progress?.completedLessonIds.length ?? 0;
  const streakCount = progress?.streakCount ?? 0;
  const firstName =
    user?.displayName?.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'Explorer';

  // XP and level reflect real results: each cleared lesson and each correct
  // mastery answer is worth points, so the bar tracks actual progress.
  let masteryCorrect = 0;
  let perfectLessons = 0;
  for (const lessonMeta of lessons) {
    const saved = progress?.lessons[lessonMeta.id];
    if (!saved) continue;
    const correct = Object.values(saved.masteryResults ?? {}).filter(Boolean).length;
    masteryCorrect += correct;
    if (correct >= 3) perfectLessons += 1;
  }
  const XP_PER_LEVEL = 300;
  const totalXp = completedCount * 100 + masteryCorrect * 20;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = totalXp % XP_PER_LEVEL;
  const badges = computeBadges({
    completedCount,
    totalLessons: lessons.length,
    streak: streakCount,
    perfectLessons,
    masteryCorrect,
  });

  const getLessonProgressLabel = (lessonId: string): string | null => {
    const saved = progress?.lessons[lessonId];
    const content = getLesson(lessonId);
    if (!saved || saved.finished || !content) {
      return null;
    }

    const total =
      saved.phase === 'scaffolded'
        ? content.phases.scaffolded.length
        : content.phases.mastery.length;
    const phaseLabel = saved.phase === 'scaffolded' ? 'Practice' : 'Mastery';
    return `${phaseLabel} ${saved.stepIndex + 1}/${total}`;
  };

  const getLockedReason = (lessonIndex: number): string => {
    if (lessonIndex <= 0) {
      return 'Start the first lesson to begin.';
    }
    const priorLesson = lessons[lessonIndex - 1];
    return `Pass ${priorLesson.title} to unlock this.`;
  };

  const handleResetProgress = async () => {
    if (!user || !firstLessonId) {
      return;
    }
    const confirmed = window.confirm('Reset your demo progress and streak? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    try {
      setResettingProgress(true);
      setProgressError(null);
      const nextProgress = await resetCourseProgress(user.uid, course.id, firstLessonId);
      setProgress(nextProgress);
    } catch {
      setProgressError('Could not reset progress. Try again in a moment.');
    } finally {
      setResettingProgress(false);
    }
  };

  useEffect(() => {
    let active = true;

    async function loadProgress() {
      if (!user || !firstLessonId) {
        setProgressLoading(false);
        return;
      }

      try {
        setProgressLoading(true);
        setProgressError(null);
        const nextProgress = await getCourseProgress(user.uid, course.id, firstLessonId);
        if (active) {
          setProgress(nextProgress);

          // The lesson-complete screen already fires the big confetti, so an
          // advanced streak gets a quiet header pop here instead of a second burst.
          if (shouldCelebrateStreak(nextProgress.streakCount, nextProgress.lastCelebratedStreak)) {
            setCelebrateStreak(true);
            void acknowledgeStreakCelebration(user.uid, course.id, nextProgress.streakCount);
          }
        }
      } catch {
        if (active) {
          setProgressError('Could not load saved progress. Make sure Firestore is enabled.');
        }
      } finally {
        if (active) {
          setProgressLoading(false);
        }
      }
    }

    void loadProgress();

    return () => {
      active = false;
    };
  }, [course.id, firstLessonId, user]);

  // Celebrate the first time a badge becomes earned. Badges are derived from
  // progress, so the acknowledged ids are persisted (mirroring the streak
  // celebration) and we pop the modal only for newly earned ones. The ref keeps
  // it to once per load, and merging the ids into the in-memory progress stops
  // the effect from re-triggering.
  useEffect(() => {
    if (!user || !progress || badgeCelebrationShown.current) {
      return;
    }
    const newIds = newlyEarnedBadgeIds(badges, progress.acknowledgedBadgeIds);
    if (newIds.length === 0) {
      return;
    }
    badgeCelebrationShown.current = true;
    setUnlockedBadges(badges.filter((badge) => newIds.includes(badge.id)));
    void acknowledgeBadges(user.uid, course.id, newIds);
    setProgress((prev) =>
      prev
        ? { ...prev, acknowledgedBadgeIds: [...prev.acknowledgedBadgeIds, ...newIds] }
        : prev,
    );
  }, [badges, course.id, progress, user]);

  const getLessonStatus = (lessonId: string): LessonCardStatus => {
    if (progress?.completedLessonIds.includes(lessonId)) {
      return 'completed';
    }
    if (progress?.currentLessonId === lessonId) {
      return 'current';
    }
    const unlocked = progress
      ? progress.unlockedLessonIds.includes(lessonId)
      : lessonId === firstLessonId;
    return unlocked ? 'unlocked' : 'locked';
  };

  const stops: MapStop[] = lessons.map((lesson, index) => {
    const status = getLessonStatus(lesson.id);
    const hasContent = getLesson(lesson.id) !== null;
    const accessible = status !== 'locked' && hasContent;
    return {
      id: lesson.id,
      label: lesson.title,
      status,
      to: accessible ? `/lesson/${lesson.id}` : undefined,
      lockedReason:
        status === 'locked' ? getLockedReason(index) : !hasContent ? 'Coming soon' : undefined,
      progressLabel: getLessonProgressLabel(lesson.id),
    };
  });
  const treasureUnlocked = lessons.length > 0 && completedCount >= lessons.length;

  // The first section is the live course; the rest preview future topics with
  // full, named trails. They have no content yet, so their stops aren't clickable.
  const previewSection = (prefix: string, names: string[]): MapStop[] =>
    names.map((label, i) => ({ id: `${prefix}-${i}`, label, status: 'unlocked' as const }));

  const sections: MapSection[] = [
    {
      id: course.id,
      topic: 'Solving Equations',
      stops,
      treasureUnlocked,
      onOpenTreasure: treasureUnlocked ? () => setShowTreasure(true) : undefined,
    },
    {
      id: 'inequalities',
      topic: 'Inequalities',
      stops: previewSection('ineq', [
        'Inequality Basics',
        'Reading Inequalities',
        'Solving One-Step',
        'Number Line Graphs',
        'Word Problems',
      ]),
      treasureUnlocked: false,
    },
    {
      id: 'graphing-lines',
      topic: 'Graphing Lines',
      stops: previewSection('graph', [
        'The Coordinate Plane',
        'Plotting Points',
        'Finding Slope',
        'Intercepts',
        'Slope-Intercept Form',
        'Graphing a Line',
        'Equations of Lines',
      ]),
      treasureUnlocked: false,
    },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        sticky
        level={level}
        xp={xpIntoLevel}
        xpToNext={XP_PER_LEVEL}
        streak={streakCount}
        celebrateStreak={celebrateStreak}
        onAchievements={() => setShowAchievements(true)}
        onSignOut={() => void signOut()}
      />

      <main className="relative flex-1">
        <p className="px-4 pt-5 pb-1 text-center font-display text-xl font-bold text-ink sm:pt-6 sm:text-2xl">
          Welcome back, {firstName}
        </p>
        <TreasureMap sections={sections} />
      </main>

      <footer className="flex items-center justify-center bg-parchment-100 px-4 py-4 text-center">
        <button
          type="button"
          disabled={resettingProgress}
          className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void handleResetProgress()}
        >
          {resettingProgress ? 'Resetting progress...' : 'Reset demo progress'}
        </button>
      </footer>

      {(progressError || progressLoading) && (
        <div className="fixed left-1/2 top-20 z-30 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2">
          {progressError ? (
            <Alert variant="warning">{progressError}</Alert>
          ) : (
            <p className="mx-auto w-fit rounded-full bg-parchment-50/95 px-3 py-1 text-sm text-muted shadow">
              Loading progress...
            </p>
          )}
        </div>
      )}

      {showAchievements && (
        <AchievementsModal badges={badges} onClose={() => setShowAchievements(false)} />
      )}

      {showTreasure && (
        <TreasureModal
          level={level}
          totalXp={totalXp}
          earnedBadges={badges.filter((badge) => badge.earned)}
          onClose={() => setShowTreasure(false)}
        />
      )}

      {unlockedBadges.length > 0 && (
        <BadgeUnlockModal badges={unlockedBadges} onClose={() => setUnlockedBadges([])} />
      )}
    </div>
  );
}
