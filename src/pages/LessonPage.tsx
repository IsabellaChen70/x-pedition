import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import AppHeader from '../components/AppHeader';
import LessonPlayer from '../components/LessonPlayer';
import { getCourse, getLesson } from '../lib/content';
import { headerStatsFromProgress } from '../lib/courseStats';
import { getCourseProgress } from '../lib/progress';
import type { CourseProgress } from '../lib/progress';

export default function LessonPage() {
  const { user } = useAuth();
  const { lessonId } = useParams<{ lessonId: string }>();
  const course = getCourse();
  const lesson = lessonId ? getLesson(lessonId) : null;

  // Keep the habit-loop stats (level, XP, streak) in the lesson header too, so
  // the reward signal doesn't vanish during the core activity. Cache-first, so
  // it usually resolves from the same doc LessonPlayer already read.
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;
    void getCourseProgress(user.uid, course.id, course.lessonOrder[0])
      .then((next) => {
        if (active) setProgress(next);
      })
      .catch(() => {
        // Header stats are best-effort; a read failure just shows a fresh header.
      });
    return () => {
      active = false;
    };
  }, [course.id, course.lessonOrder, user]);

  const stats = headerStatsFromProgress(progress, course.lessonOrder);

  if (!lessonId || !lesson) {
    return (
      <div className="min-h-dvh">
        <AppHeader />
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">
            ← Back to map
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-ink">Lesson not found</h1>
          <p className="mt-2 text-muted">
            {lessonId ? (
              <>
                No content for <span className="font-mono text-ink">{lessonId}</span> yet.
              </>
            ) : (
              'No lesson selected.'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <AppHeader
        level={stats.level}
        xp={stats.xp}
        xpToNext={stats.xpToNext}
        streak={stats.streak}
      />
      <div className="mx-auto max-w-3xl px-4 py-6 pb-12 sm:py-8">
        <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">
          ← Back to map
        </Link>
        <header className="mt-3 mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{lesson.title}</h1>
        </header>
        <LessonPlayer
          lesson={lesson}
          userId={user!.uid}
          courseId={course.id}
          firstLessonId={course.lessonOrder[0]}
        />
      </div>
    </div>
  );
}
