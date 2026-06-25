import {
  arrayUnion,
  doc,
  getDoc,
  getDocFromCache,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firestore';

type LessonProgressPhase = 'scaffolded' | 'mastery';

export type LessonAnswerRecord = {
  stepId: string;
  phase: LessonProgressPhase;
  ok: boolean;
  answer: string;
  correctAnswer: string;
  attempts: string[];
};

export type LessonProgressSnapshot = {
  phase: LessonProgressPhase;
  stepIndex: number;
  masteryResults: Record<string, boolean>;
  finished: boolean;
  passed: boolean;
  answerHistory: Record<string, LessonAnswerRecord>;
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
};

function progressRef(userId: string, courseId: string) {
  return doc(db, 'users', userId, 'progress', courseId);
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
