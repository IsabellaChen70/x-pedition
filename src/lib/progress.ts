import {
  arrayUnion,
  doc,
  getDoc,
  getDocFromCache,
  increment,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firestore';
import { buildWeaknessMap } from './ai/adaptive';
import { lessonForConcept } from './ai/concepts';
import type { ConceptId } from './ai/types';

type LessonProgressPhase = 'scaffolded' | 'mastery';

export type LessonAnswerRecord = {
  stepId: string;
  phase: LessonProgressPhase;
  ok: boolean;
  answer: string;
  correctAnswer: string;
  attempts: string[];
  /** The learner's typed self-explanation ("Convince Me"), shown in review. */
  reflection?: string;
};

export type LessonProgressSnapshot = {
  phase: LessonProgressPhase;
  stepIndex: number;
  masteryResults: Record<string, boolean>;
  finished: boolean;
  passed: boolean;
  answerHistory: Record<string, LessonAnswerRecord>;
};

export type PracticeStats = {
  /** Highest difficulty level reached in practice (1-5); 0 means none yet. */
  bestLevel: number;
  /** Lifetime practice problems solved. */
  solvedTotal: number;
  /** Lifetime Daily Treasure Digs completed. */
  digsCompleted: number;
};

export type CourseProgress = {
  currentLessonId: string;
  unlockedLessonIds: string[];
  completedLessonIds: string[];
  lessons: Record<string, LessonProgressSnapshot>;
  streakCount: number;
  lastStreakDate: string | null;
  lastCelebratedStreak: number;
  acknowledgedBadgeIds: string[];
  practice: PracticeStats;
  /** Lifetime self-explanations submitted ("Convince Me"); rewards reflection. */
  reflectionsCompleted: number;
  /** Passed the capstone Final Challenge (one puzzle per lesson), unlocks the treasure. */
  finalChallengePassed: boolean;
};

function progressRef(userId: string, courseId: string) {
  return doc(db, 'users', userId, 'progress', courseId);
}

function normalizePractice(data: unknown): PracticeStats {
  const practice = typeof data === 'object' && data !== null ? data as Partial<PracticeStats> : {};
  return {
    bestLevel: typeof practice.bestLevel === 'number' ? practice.bestLevel : 0,
    solvedTotal: typeof practice.solvedTotal === 'number' ? practice.solvedTotal : 0,
    digsCompleted: typeof practice.digsCompleted === 'number' ? practice.digsCompleted : 0,
  };
}

export function normalizeProgress(data: unknown, firstLessonId: string): CourseProgress {
  const progress = typeof data === 'object' && data !== null ? data as Partial<CourseProgress> : {};

  return {
    currentLessonId: progress.currentLessonId ?? firstLessonId,
    unlockedLessonIds: progress.unlockedLessonIds ?? [firstLessonId],
    completedLessonIds: progress.completedLessonIds ?? [],
    lessons: progress.lessons ?? {},
    streakCount: progress.streakCount ?? 0,
    lastStreakDate: progress.lastStreakDate ?? null,
    lastCelebratedStreak: progress.lastCelebratedStreak ?? 0,
    acknowledgedBadgeIds: progress.acknowledgedBadgeIds ?? [],
    practice: normalizePractice(progress.practice),
    reflectionsCompleted: progress.reflectionsCompleted ?? 0,
    finalChallengePassed: progress.finalChallengePassed ?? false,
  };
}

/**
 * Whether the streak badge should play its celebration. True only when the
 * current streak is positive and has advanced past the last value we already
 * celebrated, so each milestone is celebrated exactly once, on any device.
 */
export function shouldCelebrateStreak(
  streakCount: number,
  lastCelebratedStreak: number,
): boolean {
  return streakCount > 0 && streakCount > lastCelebratedStreak;
}

// Every seventh day is a milestone (7, 14, 21, ...). Milestones earn a bigger,
// one-time celebration on top of the normal daily streak bump.
const STREAK_MILESTONE_INTERVAL = 7;

export function isStreakMilestone(streakCount: number): boolean {
  return streakCount > 0 && streakCount % STREAK_MILESTONE_INTERVAL === 0;
}

// Streak "days" are counted by the calendar day in Central Time, so an evening
// session that crosses UTC midnight (7pm CST) still counts as a single day.
const STREAK_TIME_ZONE = 'America/Chicago';

export function dateKeyInTimeZone(date: Date, timeZone: string = STREAK_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD, which sorts and compares cleanly.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function todayKey(): string {
  return dateKeyInTimeZone(new Date());
}

export function yesterdayKey(): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return dateKeyInTimeZone(yesterday);
}

export function nextStreakCount(lastStreakDate: string | null | undefined, currentStreak: number): number {
  const today = todayKey();
  if (lastStreakDate === today) {
    return currentStreak;
  }
  if (lastStreakDate === yesterdayKey()) {
    return currentStreak + 1;
  }
  return 1;
}

export async function getCourseProgress(
  userId: string,
  courseId: string,
  firstLessonId: string,
): Promise<CourseProgress> {
  const ref = progressRef(userId, courseId);

  // Read the on-disk cache first so the dashboard and its celebrations appear
  // instantly. Local writes update this cache, so a just-finished lesson is
  // already reflected here without waiting on a server round-trip.
  try {
    const cached = await getDocFromCache(ref);
    if (cached.exists()) {
      return normalizeProgress(cached.data(), firstLessonId);
    }
  } catch {
    // No cached copy yet (first load) or cache unavailable; use the server.
  }

  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const initialProgress: CourseProgress = {
      currentLessonId: firstLessonId,
      unlockedLessonIds: [firstLessonId],
      completedLessonIds: [],
      lessons: {},
      streakCount: 0,
      lastStreakDate: null,
      lastCelebratedStreak: 0,
      acknowledgedBadgeIds: [],
      practice: { bestLevel: 0, solvedTotal: 0, digsCompleted: 0 },
      reflectionsCompleted: 0,
      finalChallengePassed: false,
    };
    await setDoc(ref, {
      ...initialProgress,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return initialProgress;
  }

  return normalizeProgress(snapshot.data(), firstLessonId);
}

export async function resetCourseProgress(
  userId: string,
  courseId: string,
  firstLessonId: string,
): Promise<CourseProgress> {
  const initialProgress: CourseProgress = {
    currentLessonId: firstLessonId,
    unlockedLessonIds: [firstLessonId],
    completedLessonIds: [],
    lessons: {},
    streakCount: 0,
    lastStreakDate: null,
    lastCelebratedStreak: 0,
    acknowledgedBadgeIds: [],
    practice: { bestLevel: 0, solvedTotal: 0, digsCompleted: 0 },
    reflectionsCompleted: 0,
    finalChallengePassed: false,
  };

  await setDoc(progressRef(userId, courseId), {
    ...initialProgress,
    resetAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return initialProgress;
}

/**
 * Records that the streak celebration has been shown for the given streak
 * value, so it won't replay on the next load (here or on another device).
 */
export async function acknowledgeStreakCelebration(
  userId: string,
  courseId: string,
  streakCount: number,
): Promise<void> {
  await setDoc(
    progressRef(userId, courseId),
    {
      lastCelebratedStreak: streakCount,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Records that the unlock celebration has been shown for the given badge ids,
 * so each badge is celebrated exactly once, on any device. Badges are derived
 * from progress, so we persist the acknowledged ids rather than the badges.
 */
export async function acknowledgeBadges(
  userId: string,
  courseId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await setDoc(
    progressRef(userId, courseId),
    {
      acknowledgedBadgeIds: arrayUnion(...ids),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  progress: LessonProgressSnapshot,
): Promise<void> {
  await setDoc(
    progressRef(userId, courseId),
    {
      currentLessonId: lessonId,
      unlockedLessonIds: arrayUnion(lessonId),
      lessons: {
        [lessonId]: {
          ...progress,
          updatedAt: serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function completeLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  progress: LessonProgressSnapshot,
  nextLessonId: string | null,
): Promise<void> {
  const existing = await getDoc(progressRef(userId, courseId));
  const currentProgress = normalizeProgress(existing.data(), lessonId);
  const today = todayKey();
  // The streak rewards finishing a lesson, pass or fail: showing up and doing
  // the work is the daily habit. Passing only governs unlocking the next lesson.
  const streakFields = {
    streakCount: nextStreakCount(currentProgress.lastStreakDate, currentProgress.streakCount),
    lastStreakDate: today,
  };

  const nextUnlocked = progress.passed && nextLessonId
    ? arrayUnion(lessonId, nextLessonId)
    : arrayUnion(lessonId);
  const completionFields = progress.passed
    ? { completedLessonIds: arrayUnion(lessonId) }
    : {};

  await setDoc(
    progressRef(userId, courseId),
    {
      currentLessonId: progress.passed && nextLessonId ? nextLessonId : lessonId,
      unlockedLessonIds: nextUnlocked,
      lessons: {
        [lessonId]: {
          ...progress,
          finished: true,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      },
      ...completionFields,
      ...streakFields,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Record one completed self-explanation ("Convince Me"). Purely additive, it
 * never touches lesson or practice progress, and drives reflection XP/badges.
 */
export async function recordReflection(userId: string, courseId: string): Promise<void> {
  await setDoc(
    progressRef(userId, courseId),
    {
      reflectionsCompleted: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Record that the learner passed the capstone Final Challenge, which unlocks the
 * treasure. Additive and idempotent, it only flips the flag, leaving lesson and
 * practice progress untouched.
 */
export async function recordFinalChallengePassed(userId: string, courseId: string): Promise<void> {
  await setDoc(
    progressRef(userId, courseId),
    {
      finalChallengePassed: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Pure: fraction (0-1) of a lesson's mastery answers correct, or null if none. */
function masteryFractionFromResults(results: Record<string, boolean> | undefined): number | null {
  if (!results) return null;
  const outcomes = Object.values(results);
  if (outcomes.length === 0) return null;
  return outcomes.filter(Boolean).length / outcomes.length;
}

/** Read the progress doc once, cache-first then server. Undefined if it doesn't exist. */
async function readProgressData(
  userId: string,
  courseId: string,
): Promise<Partial<CourseProgress> | undefined> {
  const ref = progressRef(userId, courseId);
  try {
    const cached = await getDocFromCache(ref);
    if (cached.exists()) {
      return cached.data() as Partial<CourseProgress>;
    }
  } catch {
    // No cached copy yet or cache unavailable; fall through to the server.
  }
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? (snapshot.data() as Partial<CourseProgress>) : undefined;
}

/** Everything the practice dig needs to place + adapt, from ONE Firestore read. */
export type PracticeSetup = {
  /** Best difficulty reached before, for resume placement. */
  bestLevel: number;
  /** Mastery fraction for the launch lesson (first-timer placement). */
  masteryFraction: number | null;
  /** Per-skill weakness (0..1) for the adaptive path. */
  weakness: Partial<Record<ConceptId, number>>;
};

/**
 * Load placement + adaptivity inputs for a dig in a SINGLE doc read (previously
 * this was ~7 reads of the same doc: stats + a mastery read per concept). Pure
 * derivation after the read, so it's fast and cheap on dig start.
 */
export async function getPracticeSetup(
  userId: string,
  courseId: string,
  lessonId: string,
  concepts: ConceptId[],
): Promise<PracticeSetup> {
  const data = await readProgressData(userId, courseId).catch(() => undefined);
  const bestLevel = normalizePractice(data?.practice).bestLevel;
  const masteryFraction = masteryFractionFromResults(data?.lessons?.[lessonId]?.masteryResults);
  const fractions = Object.fromEntries(
    concepts.map((concept) => {
      const conceptLesson = lessonForConcept(concept);
      const fraction = conceptLesson
        ? masteryFractionFromResults(data?.lessons?.[conceptLesson]?.masteryResults)
        : null;
      return [concept, fraction];
    }),
  );
  return { bestLevel, masteryFraction, weakness: buildWeaknessMap(fractions) };
}

/**
 * Persist a practice session additively, leaving all lesson progress untouched.
 * `solved` is the count of newly solved problems to add; `peakLevel` raises the
 * saved best level (used to resume one level below it next time); completing a
 * Daily Treasure Dig (`completedDig`) also counts as today's streak activity.
 */
export async function recordPracticeSession(
  userId: string,
  courseId: string,
  { solved, peakLevel, completedDig }: { solved: number; peakLevel: number; completedDig: boolean },
): Promise<void> {
  if (solved <= 0 && !completedDig) {
    return;
  }
  const ref = progressRef(userId, courseId);
  const existing = await getDoc(ref);
  const data = (existing.data() ?? {}) as Partial<CourseProgress>;
  const previousBest = data.practice?.bestLevel ?? 0;

  const practiceUpdate: Record<string, unknown> = {
    bestLevel: Math.max(previousBest, peakLevel),
  };
  if (solved > 0) {
    practiceUpdate.solvedTotal = increment(solved);
  }
  if (completedDig) {
    practiceUpdate.digsCompleted = increment(1);
  }

  const streakFields = completedDig
    ? {
        streakCount: nextStreakCount(data.lastStreakDate ?? null, data.streakCount ?? 0),
        lastStreakDate: todayKey(),
      }
    : {};

  await setDoc(
    ref,
    {
      practice: practiceUpdate,
      ...streakFields,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
