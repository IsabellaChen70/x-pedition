import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import AchievementsModal from '../components/AchievementsModal';
import AppHeader from '../components/AppHeader';
import BadgeUnlockModal from '../components/BadgeUnlockModal';
import LevelUpModal from '../components/LevelUpModal';
import ReviewDeck from '../components/ReviewDeck';
import SaveProgressModal from '../components/SaveProgressModal';
import ShopModal from '../components/ShopModal';
import TreasureMap from '../components/TreasureMap';
import type { MapSection, MapStop } from '../components/TreasureMap';
import TreasureModal from '../components/TreasureModal';
import { Alert, Button } from '../components/ui';
import mapBg from '../assets/map-bg.jpg';
import { isPracticeEnabled } from '../lib/ai/config';
import { conceptForLesson, lessonForConcept } from '../lib/ai/concepts';
import { getDueConcepts, skillState } from '../lib/ai/srs';
import type { ConceptId } from '../lib/ai/types';
import { computeBadges, newlyEarnedBadgeIds } from '../lib/badges';
import type { Badge } from '../lib/badges';
import { applyEquip, applyPurchase, canPurchase, resolveAvatar, resolveMapTheme } from '../lib/cosmetics';
import type { Cosmetic } from '../lib/cosmetics';
import { getCourse, getLesson, listLessons } from '../lib/content';
import {
  acknowledgeBadges,
  acknowledgeLevelCelebration,
  acknowledgeStreakCelebration,
  backfillCompletedSkills,
  equipCosmetic,
  getCourseProgress,
  getDevDayOffset,
  purchaseCosmetic,
  recordFinalChallengePassed,
  resetCourseProgress,
  resolveMistake,
  setDevDayOffset,
  shouldCelebrateLevel,
  shouldCelebrateStreak,
  todayKey,
} from '../lib/progress';
import type { CourseProgress } from '../lib/progress';
import { removeMistakeFromLog } from '../lib/mistakes';
import { resolveResume } from '../lib/resume';
import { earnedXp, levelForXp, spendableXp, XP_PER_LEVEL, xpIntoLevel } from '../lib/xp';

const PracticeSession = lazy(() => import('../components/PracticeSession'));
const FinalChallenge = lazy(() => import('../components/FinalChallenge'));

type LessonCardStatus = 'completed' | 'current' | 'unlocked' | 'locked';

/** Auto-celebrations shown on load, one at a time so confetti never doubles up. */
type Celebration = { kind: 'levelup'; level: number } | { kind: 'badges'; badges: Badge[] };
const CELEBRATION_ORDER: Record<Celebration['kind'], number> = { levelup: 0, badges: 1 };

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
  const [reviewConcepts, setReviewConcepts] = useState<ConceptId[]>([]);
  const [showFinalChallenge, setShowFinalChallenge] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showReviewDeck, setShowReviewDeck] = useState(false);
  const [showSaveProgress, setShowSaveProgress] = useState(false);
  // Set once a guest links a real account, so the banner drops immediately even
  // if the reused User object doesn't change reference on link.
  const [savedProgress, setSavedProgress] = useState(false);
  const [celebrateStreak, setCelebrateStreak] = useState(false);
  const [celebrationQueue, setCelebrationQueue] = useState<Celebration[]>([]);
  const badgeCelebrationShown = useRef(false);
  const levelCelebrationShown = useRef(false);
  const completedCount = progress?.completedLessonIds.length ?? 0;
  const streakCount = progress?.streakCount ?? 0;
  const practiceSolved = progress?.practice.solvedTotal ?? 0;
  const practiceDigs = progress?.practice.digsCompleted ?? 0;
  const practiceBestLevel = progress?.practice.bestLevel ?? 0;
  const reflectionsCompleted = progress?.reflectionsCompleted ?? 0;
  const mistakes = progress?.mistakeLog ?? [];
  // The home "Daily Treasure Dig" reviews skills up to the furthest lesson the
  // learner has completed; a new learner falls back to the first lesson.
  const practiceLessonId =
    (progress?.completedLessonIds ?? [])
      .slice()
      .sort((a, b) => course.lessonOrder.indexOf(b) - course.lessonOrder.indexOf(a))[0] ?? firstLessonId;
  const firstName =
    user?.displayName?.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'Explorer';

  // The spaced-repetition Skill Map + Daily Review read straight from the loaded
  // progress doc's per-skill memory (no extra Firestore read): which skills are
  // due today, and the memory the map renders.
  const today = todayKey();
  const skills = progress?.skills ?? {};
  const dueConcepts = getDueConcepts(skills, today);

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
  // Earned XP is the lifetime total and the level signal; it only ever grows.
  const totalXp = earnedXp({ completedCount, masteryCorrect, practiceSolved, reflectionsCompleted });
  const level = levelForXp(totalXp);

  // A first-time visitor (nothing earned, started, or streaked yet) gets a short
  // orientation instead of "Welcome back", so the map is never unexplained.
  const hasProgress =
    completedCount > 0 ||
    streakCount > 0 ||
    totalXp > 0 ||
    Object.keys(progress?.lessons ?? {}).length > 0;

  // Shop state drives the spendable wallet (earned minus spent) and the applied
  // cosmetics. Buying moves the wallet, never the earned total, so the level and
  // its bar are untouched. Absent progress falls back to the default look.
  const cosmetics = progress?.cosmetics ?? { unlocked: [], equipped: {}, xpSpent: 0 };
  const spendable = spendableXp(totalXp, cosmetics.xpSpent);
  const mapTheme = resolveMapTheme(cosmetics.equipped);
  const avatar = resolveAvatar(cosmetics.equipped);
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

  // The prominent Continue action for a returning learner: resume the in-progress
  // lesson at its saved step, start the next unlocked lesson, or replay once the
  // course is done. LessonPlayer restores the exact phase + step from Firestore.
  const resumeTarget = progress
    ? resolveResume(progress, course.lessonOrder, (id) => getLesson(id) !== null)
    : null;
  const resumeTitle = resumeTarget
    ? course.lessons[resumeTarget.lessonId]?.title ?? resumeTarget.lessonId
    : '';
  const resumeVerb =
    resumeTarget?.mode === 'continue'
      ? 'Continue'
      : resumeTarget?.mode === 'start'
        ? 'Start lesson'
        : 'Play again';
  const resumeProgressLabel = resumeTarget ? getLessonProgressLabel(resumeTarget.lessonId) : null;
  const resumeHelper =
    resumeTarget?.mode === 'continue' && resumeProgressLabel
      ? `${resumeTitle} · ${resumeProgressLabel}`
      : resumeTitle;

  const getLockedReason = (lessonIndex: number): string => {
    if (lessonIndex <= 0) {
      return 'Start the first lesson to begin.';
    }
    const priorLesson = lessons[lessonIndex - 1];
    return `Pass ${priorLesson.title} to open this.`;
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

  // Buy a cosmetic: update the view optimistically, then persist additively. The
  // pure guard means a stale click (already owned / unaffordable) is a no-op.
  const handleBuyCosmetic = (cosmetic: Cosmetic) => {
    if (!user || !progress || !canPurchase(cosmetic, cosmetics.unlocked, spendable)) {
      return;
    }
    const nextCosmetics = applyPurchase(cosmetics, cosmetic, spendable);
    setProgress((prev) => (prev ? { ...prev, cosmetics: nextCosmetics } : prev));
    void purchaseCosmetic(user.uid, course.id, cosmetic.id, cosmetic.slot, cosmetic.price);
  };

  const handleEquipCosmetic = (cosmetic: Cosmetic) => {
    if (!user || !progress) {
      return;
    }
    const nextCosmetics = applyEquip(cosmetics, cosmetic);
    setProgress((prev) => (prev ? { ...prev, cosmetics: nextCosmetics } : prev));
    void equipCosmetic(user.uid, course.id, cosmetic.slot, cosmetic.id);
  };

  // Clear a reviewed mistake: drop it locally right away, then persist additively.
  const handleResolveMistake = (id: string) => {
    if (!user) {
      return;
    }
    setProgress((prev) =>
      prev ? { ...prev, mistakeLog: removeMistakeFromLog(prev.mistakeLog, id) } : prev,
    );
    void resolveMistake(user.uid, course.id, id);
  };

  // Quietly re-read progress after a dig/review so the Skill Map and Daily Review
  // reflect the freshly recorded spaced-repetition reviews (cache-first, cheap).
  const refreshProgress = useCallback(async () => {
    if (!user || !firstLessonId) {
      return;
    }
    try {
      const next = await getCourseProgress(user.uid, course.id, firstLessonId);
      setProgress(next);
    } catch {
      // Keep the current view; a transient read failure shouldn't disrupt the page.
    }
  }, [course.id, firstLessonId, user]);

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

          // Backfill the spaced system from lessons completed before they were
          // tracked, so every finished lesson gets a schedule and shows on the map.
          void backfillCompletedSkills(user.uid, course.id, nextProgress).then((seeds) => {
            if (active && Object.keys(seeds).length > 0) {
              setProgress((prev) =>
                prev ? { ...prev, skills: { ...(prev.skills ?? {}), ...seeds } } : prev,
              );
            }
          });
        }
      } catch (loadError) {
        console.error('Progress load failed:', loadError);
        if (active) {
          setProgressError('We could not load your saved progress. Check your connection and refresh.');
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
    const earned = badges.filter((badge) => newIds.includes(badge.id));
    setCelebrationQueue((queue) => [...queue, { kind: 'badges', badges: earned }]);
    void acknowledgeBadges(user.uid, course.id, newIds);
    setProgress((prev) =>
      prev
        ? { ...prev, acknowledgedBadgeIds: [...prev.acknowledgedBadgeIds, ...newIds] }
        : prev,
    );
  }, [badges, course.id, progress, user]);

  // Celebrate reaching a new level. Level is derived from earned XP (not stored),
  // so we persist the last-celebrated level to pop it exactly once. A fresh or
  // legacy doc (baseline 0) syncs its current level silently the first time, so
  // "level 1" and already-earned levels never trigger a spurious beat.
  useEffect(() => {
    if (!user || !progress || levelCelebrationShown.current) {
      return;
    }
    levelCelebrationShown.current = true;
    const last = progress.lastCelebratedLevel;
    if (shouldCelebrateLevel(level, last)) {
      setCelebrationQueue((queue) => [...queue, { kind: 'levelup', level }]);
    }
    if (level !== last) {
      void acknowledgeLevelCelebration(user.uid, course.id, level);
      setProgress((prev) => (prev ? { ...prev, lastCelebratedLevel: level } : prev));
    }
  }, [course.id, level, progress, user]);

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
    // Fold the spaced-repetition signal onto the map node: a completed lesson's
    // skill shows its mastery state, and any due skill gets a "review due" ping.
    const concept = conceptForLesson(lesson.id);
    const mastery = status === 'completed' && concept ? skillState(skills[concept]) : undefined;
    const due = concept ? dueConcepts.includes(concept) : false;
    return {
      id: lesson.id,
      label: lesson.title,
      status,
      to: accessible ? `/lesson/${lesson.id}` : undefined,
      lockedReason:
        status === 'locked' ? getLockedReason(index) : !hasContent ? 'Coming soon' : undefined,
      progressLabel: getLessonProgressLabel(lesson.id),
      mastery,
      due,
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

  // Show at most one auto-celebration at a time (level-up before badges) so their
  // confetti bursts never overlap or double-fire on a single load.
  const activeCelebration =
    celebrationQueue.length > 0
      ? [...celebrationQueue].sort(
          (a, b) => CELEBRATION_ORDER[a.kind] - CELEBRATION_ORDER[b.kind],
        )[0]
      : null;
  const dismissCelebration = (target: Celebration) =>
    setCelebrationQueue((queue) => queue.filter((celebration) => celebration !== target));

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        sticky
        level={level}
        xp={xpIntoLevel(totalXp)}
        xpToNext={XP_PER_LEVEL}
        streak={streakCount}
        celebrateStreak={celebrateStreak}
        onAchievements={() => setShowAchievements(true)}
        onShop={() => setShowShop(true)}
        onSignOut={() => void signOut()}
      />

      <main
        className="relative flex-1 bg-cover bg-top bg-no-repeat"
        style={{
          // The whole screen is the map, behind the welcome bar AND the trail, one
          // continuous surface. The equipped theme's wash sits over the parchment
          // image; a dark theme flips the welcome text below to a light ink.
          backgroundImage: `${mapTheme.overlay}, url(${mapBg})`,
        }}
      >
        <div className="px-4 pb-6 pt-6 text-center sm:pt-8">
          <h1
            className={`font-display text-2xl font-bold sm:text-3xl ${
              mapTheme.dark
                ? 'text-parchment-50 drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]'
                : 'text-[#33261a] drop-shadow-[0_1px_2px_rgba(253,248,236,0.9)]'
            }`}
          >
            {hasProgress ? `Welcome back, ${firstName}!` : `Welcome, ${firstName}!`}
          </h1>
          <p
            className={`mt-1 text-sm font-medium sm:text-base ${
              mapTheme.dark ? 'text-parchment-200' : 'text-[#4a3a28]'
            }`}
          >
            {hasProgress
              ? "Ready for today's adventure?"
              : 'This map is your algebra course. Start at the first stop and follow the trail.'}
          </p>
          {resumeTarget && (
            <div className="mt-5 flex justify-center">
              <Link
                to={`/lesson/${resumeTarget.lessonId}`}
                aria-label={`${resumeVerb}: ${resumeTitle}`}
                className="inline-flex max-w-full items-center gap-3 rounded-2xl bg-gold-500 px-6 py-3.5 text-left shadow-lg ring-1 ring-gold-600/30 transition duration-200 hover:bg-gold-400 hover:shadow-xl motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment-100"
              >
                <PlayIcon className="h-6 w-6 shrink-0 text-on-gold" />
                <span className="min-w-0">
                  <span className="block font-display text-lg font-bold leading-tight text-on-gold">
                    {resumeVerb}
                  </span>
                  <span className="block truncate text-sm font-medium text-on-gold opacity-80">
                    {resumeHelper}
                  </span>
                </span>
              </Link>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {isPracticeEnabled() && practiceLessonId && (
              <button
                type="button"
                onClick={() => {
                  setReviewConcepts(dueConcepts);
                  setShowPractice(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-gold-400 px-5 py-2.5 text-sm font-bold text-on-gold shadow-md transition duration-200 hover:bg-gold-300 hover:shadow-lg motion-safe:hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment-100"
              >
                <ShovelIcon className="h-4 w-4" />
                Daily Treasure Dig
                {dueConcepts.length > 0 && (
                  <span className="rounded-full bg-ink/15 px-2 py-0.5 text-xs font-bold">
                    {dueConcepts.length} due
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowReviewDeck(true)}
              className="inline-flex items-center gap-2 rounded-full border-2 border-brand-200 bg-parchment-50 px-5 py-2.5 text-sm font-bold text-brand-700 shadow-sm transition duration-200 hover:border-brand-400 hover:shadow-md motion-safe:hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment-100"
            >
              <BookIcon className="h-4 w-4" />
              Review deck
              {mistakes.length > 0 && (
                <span className="nums rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">
                  {mistakes.length}
                </span>
              )}
            </button>
          </div>

          {user?.isAnonymous && !savedProgress && (
            <div className="mx-auto mt-5 flex max-w-md flex-col items-center gap-2 rounded-2xl border border-parchment-300 bg-parchment-50/90 px-4 py-3 shadow-sm sm:flex-row sm:justify-between sm:text-left">
              <p className="text-sm text-ink">
                <span className="font-semibold">Exploring as a guest.</span> Your progress
                is saved on this device. Add a login to keep it and resume anywhere.
              </p>
              <Button size="sm" className="shrink-0" onClick={() => setShowSaveProgress(true)}>
                Save my progress
              </Button>
            </div>
          )}
        </div>

        {user && progress && (
          <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-4">
            {import.meta.env.DEV && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-parchment-400 bg-parchment-50 px-4 py-3">
                <p className="text-sm text-ink">
                  Dev time travel: viewing as <span className="font-semibold">{today}</span>
                  {getDevDayOffset() > 0 &&
                    ` (+${getDevDayOffset()} day${getDevDayOffset() === 1 ? '' : 's'})`}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDevDayOffset(getDevDayOffset() + 1);
                      window.location.reload();
                    }}
                  >
                    +1 day
                  </Button>
                  {getDevDayOffset() > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDevDayOffset(0);
                        window.location.reload();
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <TreasureMap sections={sections} backdrop={false} theme={mapTheme} avatar={avatar} />
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

      {showReviewDeck && user && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4">
          <div className="mx-auto mt-8 max-w-2xl">
            <ReviewDeck
              mistakes={mistakes}
              onResolve={handleResolveMistake}
              onClose={() => setShowReviewDeck(false)}
            />
          </div>
        </div>
      )}

      {showSaveProgress && (
        <SaveProgressModal
          onClose={() => setShowSaveProgress(false)}
          onSaved={() => setSavedProgress(true)}
        />
      )}

      {showShop && progress && (
        <ShopModal
          spendable={spendable}
          unlocked={cosmetics.unlocked}
          equipped={cosmetics.equipped}
          onBuy={handleBuyCosmetic}
          onEquip={handleEquipCosmetic}
          onClose={() => setShowShop(false)}
        />
      )}

      {activeCelebration?.kind === 'levelup' && (
        <LevelUpModal
          level={activeCelebration.level}
          spendable={spendable}
          onOpenShop={() => setShowShop(true)}
          onClose={() => dismissCelebration(activeCelebration)}
        />
      )}

      {activeCelebration?.kind === 'badges' && (
        <BadgeUnlockModal
          badges={activeCelebration.badges}
          onClose={() => dismissCelebration(activeCelebration)}
        />
      )}

      {showPractice && practiceLessonId && user && (
        <Suspense fallback={null}>
          <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4">
            <div className="mx-auto mt-8 max-w-2xl">
              <PracticeSession
                userId={user.uid}
                courseId={course.id}
                lessonId={
                  reviewConcepts.length === 1
                    ? lessonForConcept(reviewConcepts[0]) ?? practiceLessonId
                    : practiceLessonId
                }
                reviewConcepts={reviewConcepts}
                onExit={() => {
                  setShowPractice(false);
                  void refreshProgress();
                }}
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

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M19 17H6a2 2 0 0 0-2 2" />
    </svg>
  );
}
