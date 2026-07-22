/**
 * Pure resolution of what the home screen's "Continue" button should do for a
 * returning learner: resume the in-progress lesson at its saved step, start the
 * next unlocked lesson, or (course finished) offer a replay. Kept pure so the
 * home screen stays declarative and the behavior is unit-testable.
 */
import type { CourseProgress } from './progress';

export type ResumeMode = 'continue' | 'start' | 'done';

export type ResumeTarget = {
  lessonId: string;
  mode: ResumeMode;
};

type ResumeProgress = Pick<
  CourseProgress,
  'currentLessonId' | 'unlockedLessonIds' | 'completedLessonIds' | 'lessons'
>;

/**
 * Choose the lesson the Continue button points at.
 *
 * Priority:
 *  1. The saved current lesson if it is unfinished and has content -> resume it.
 *  2. Otherwise the first unlocked, not-yet-completed lesson with content ->
 *     start it (or resume, if it was already begun).
 *  3. Otherwise (everything done) the current/last playable lesson -> replay.
 *
 * Returns null only when no lesson has content at all, so the caller can hide the
 * button rather than link nowhere.
 */
export function resolveResume(
  progress: ResumeProgress,
  lessonOrder: string[],
  hasContent: (lessonId: string) => boolean,
): ResumeTarget | null {
  const current = progress.currentLessonId;
  const currentSaved = current ? progress.lessons[current] : undefined;
  const currentHasContent = Boolean(current) && hasContent(current);

  // 1. Resume an unfinished current lesson.
  if (currentHasContent && currentSaved && !currentSaved.finished) {
    return { lessonId: current, mode: 'continue' };
  }

  // 2. Start (or resume) the first unlocked, not-completed, playable lesson.
  const nextLessonId = lessonOrder.find(
    (id) =>
      hasContent(id) &&
      progress.unlockedLessonIds.includes(id) &&
      !progress.completedLessonIds.includes(id),
  );
  if (nextLessonId) {
    const saved = progress.lessons[nextLessonId];
    return {
      lessonId: nextLessonId,
      mode: saved && !saved.finished ? 'continue' : 'start',
    };
  }

  // 3. Course complete: offer a replay of the current (or last playable) lesson.
  if (currentHasContent) {
    return { lessonId: current, mode: 'done' };
  }
  const lastPlayable = [...lessonOrder].reverse().find(hasContent);
  return lastPlayable ? { lessonId: lastPlayable, mode: 'done' } : null;
}
