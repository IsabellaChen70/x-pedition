import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import AchievementsModal from '../components/AchievementsModal';
import AppHeader from '../components/AppHeader';
import BadgeUnlockModal from '../components/BadgeUnlockModal';
import TreasureMap from '../components/TreasureMap';
import type { MapSection, MapStop } from '../components/TreasureMap';
import TreasureModal from '../components/TreasureModal';
import { Alert } from '../components/ui';
import mapBg from '../assets/map-bg.jpg';
import { isPracticeEnabled } from '../lib/ai/config';
import { computeBadges, newlyEarnedBadgeIds } from '../lib/badges';
import type { Badge } from '../lib/badges';
import { getCourse, getLesson, listLessons } from '../lib/content';
import {
  acknowledgeBadges,
  acknowledgeStreakCelebration,
  getCourseProgress,
  recordFinalChallengePassed,
  resetCourseProgress,
  shouldCelebrateStreak,
} from '../lib/progress';
import type { CourseProgress } from '../lib/progress';

const PracticeSession = lazy(() => import('../components/PracticeSession'));
const FinalChallenge = lazy(() => import('../components/FinalChallenge'));

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
  const [showPractice, setShowPractice] = useState(false);
  const [showFinalChallenge, setShowFinalChallenge] = useState(false);
  const [celebrateStreak, setCelebrateStreak] = useState(false);
  const [unlockedBadges, setUnlockedBadges] = useState<Badge[]>([]);
  const badgeCelebrationShown = useRef(false);
  const completedCount = progress?.completedLessonIds.length ?? 0;
  const streakCount = progress?.streakCount ?? 0;
  const practiceSolved = progress?.practice.solvedTotal ?? 0;
  const practiceDigs = progress?.practice.digsCompleted ?? 0;
  const practiceBestLevel = progress?.practice.bestLevel ?? 0;
  const reflectionsCompleted = progress?.reflectionsCompleted ?? 0;
  // The home "Daily Treasure Dig" reviews skills up to the furthest lesson the
  // learner has completed; a new learner falls back to the first lesson.
  const practiceLessonId =
    (progress?.completedLessonIds ?? [])
      .slice()
      .sort((a, b) => course.lessonOrder.indexOf(b) - course.lessonOrder.indexOf(a))[0] ?? firstLessonId;
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
  const totalXp =
    completedCount * 100 + masteryCorrect * 20 + practiceSolved * 10 + reflectionsCompleted * 10;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = totalXp % XP_PER_LEVEL;
  const badges = computeBadges({
    completedCount,
    totalLessons: lessons.length,
    streak: streakCount,
    perfectLessons,
    masteryCorrect,
    practiceSolved,
    digsCompleted: practiceDigs,
    bestLevel: practiceBestLevel,
    reflectionsCompleted,
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
  // The treasure now sits behind a capstone Final Challenge: clearing every
  // lesson unlocks the challenge, and passing it unlocks the treasure itself.
  const allLessonsDone = lessons.length > 0 && completedCount >= lessons.length;
  const finalChallengePassed = progress?.finalChallengePassed ?? false;
  const treasureUnlocked = allLessonsDone && finalChallengePassed;
  const challengeReady = allLessonsDone && !finalChallengePassed;

  const handleFinalChallengePassed = () => {
    if (!user) return;
    setProgress((prev) => (prev ? { ...prev, finalChallengePassed: true } : prev));
    void recordFinalChallengePassed(user.uid, course.id);
    setShowFinalChallenge(false);
    setShowTreasure(true);
  };

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
      challengeReady,
      onStartChallenge: challengeReady ? () => setShowFinalChallenge(true) : undefined,
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

      <main
        className="relative flex-1 bg-cover bg-top bg-no-repeat"
        style={{
          // The whole screen is the parchment map (a light wash is baked in for text
          // contrast), behind the welcome bar AND the trail, one continuous surface.
          backgroundImage: `linear-gradient(rgba(247,238,214,0.5), rgba(247,238,214,0.5)), url(${mapBg})`,
        }}
      >
        <div className="px-4 pb-6 pt-6 text-center sm:pt-8">
          <h1 className="font-display text-2xl font-bold text-ink drop-shadow-[0_1px_2px_rgba(253,248,236,0.9)] sm:text-3xl">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-1 text-sm font-medium text-ink/70 sm:text-base">Ready for today's adventure?</p>
          {isPracticeEnabled() && practiceLessonId && (
            <button
              type="button"
              onClick={() => setShowPractice(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-400 px-5 py-2.5 text-sm font-bold text-ink shadow-md transition duration-200 hover:bg-gold-300 hover:shadow-lg motion-safe:hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment-100"
            >
              <ShovelIcon className="h-4 w-4" />
              Daily Treasure Dig
            </button>
          )}
        </div>
        <TreasureMap sections={sections} backdrop={false} />
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

      {showPractice && practiceLessonId && user && (
        <Suspense fallback={null}>
          <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4">
            <div className="mx-auto mt-8 max-w-2xl">
              <PracticeSession
                userId={user.uid}
                courseId={course.id}
                lessonId={practiceLessonId}
                onExit={() => setShowPractice(false)}
              />
            </div>
          </div>
        </Suspense>
      )}

      {showFinalChallenge && user && (
        <Suspense fallback={null}>
          <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4">
            <div className="flex min-h-full items-center justify-center">
              <div className="w-full max-w-2xl">
                <FinalChallenge
                  onPass={handleFinalChallengePassed}
                  onExit={() => setShowFinalChallenge(false)}
                />
              </div>
            </div>
          </div>
        </Suspense>
      )}
    </div>
  );
}

function ShovelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M10 2.5h4v2.2h-4z" />
      <path d="M11 3.5h2v8.5h-2z" />
      <path d="M7.8 11.5h8.4l-1.7 5.3a2.5 2.5 0 0 1-5 0z" />
    </svg>
  );
}
