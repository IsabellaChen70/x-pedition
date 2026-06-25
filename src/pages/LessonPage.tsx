import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import AppHeader from '../components/AppHeader';
import LessonPlayer from '../components/LessonPlayer';
import { getCourse, getLesson } from '../lib/content';

export default function LessonPage() {
  const { user } = useAuth();
  const { lessonId } = useParams<{ lessonId: string }>();
  const course = getCourse();
  const lesson = lessonId ? getLesson(lessonId) : null;

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
      <AppHeader />
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
