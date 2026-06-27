import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isPracticeEnabled } from '../lib/ai/config';
import type { MisconceptionSummary } from '../lib/ai/misconception';
import { fireConfetti } from '../lib/confetti';
import { Button, buttonClasses } from './ui';
import ProgressRing from './ProgressRing';

const PracticeSession = lazy(() => import('./PracticeSession'));

type LessonCompleteProps = {
  lessonTitle: string;
  masteryCorrect: number;
  masteryTotal: number;
  passed: boolean;
  nextLesson?: { id: string; title: string };
  /** Ideas the learner tripped on this run, for a "what to revisit" nudge. */
  revisit?: MisconceptionSummary[];
  userId: string;
  courseId: string;
  lessonId: string;
  onReview: () => void;
  onRestart: () => void;
};

export default function LessonComplete({
  lessonTitle,
  masteryCorrect,
  masteryTotal,
  passed,
  nextLesson,
  revisit = [],
  userId,
  courseId,
  lessonId,
  onReview,
  onRestart,
}: LessonCompleteProps) {
  const [practicing, setPracticing] = useState(false);

  useEffect(() => {
    if (passed) {
      fireConfetti();
    }
  }, [passed]);

  if (practicing) {
    return (
      <Suspense fallback={<p className="text-center text-muted">Loading practice…</p>}>
        <PracticeSession
          userId={userId}
          courseId={courseId}
          lessonId={lessonId}
          onExit={() => setPracticing(false)}
        />
      </Suspense>
    );
  }

  const cardClass = passed
    ? 'rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center'
    : 'rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center';
  const labelClass = passed
    ? 'mt-4 text-sm font-medium uppercase tracking-wide text-emerald-700'
    : 'mt-4 text-sm font-medium uppercase tracking-wide text-amber-700';
  const titleClass = passed
    ? 'mt-2 text-2xl font-semibold text-emerald-950'
    : 'mt-2 text-2xl font-semibold text-amber-950';
  const bodyClass = passed ? 'mt-2 text-emerald-900' : 'mt-2 text-amber-900';

  return (
    <div className={cardClass}>
      <div className="flex justify-center">
        <ProgressRing
          value={masteryCorrect}
          max={masteryTotal}
          size={108}
          strokeWidth={9}
          trackClassName={passed ? 'text-emerald-100' : 'text-amber-100'}
          indicatorClassName={passed ? 'text-emerald-500' : 'text-amber-500'}
          ariaLabel={`Mastery score: ${masteryCorrect} of ${masteryTotal} correct`}
        >
          <span
            className={`nums text-2xl font-semibold ${passed ? 'text-emerald-800' : 'text-amber-800'}`}
          >
            {masteryCorrect}/{masteryTotal}
          </span>
          <span
            className={`text-xs font-medium uppercase tracking-wide ${
              passed ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            correct
          </span>
        </ProgressRing>
      </div>

      <p className={labelClass}>{passed ? 'Lesson complete' : 'Try again later'}</p>
      <h2 className={titleClass}>{lessonTitle}</h2>
      <p className={bodyClass}>
        {passed
          ? 'You passed. Nice work sticking with it.'
          : 'Review the practice, then try the lesson again.'}
      </p>
      {passed && nextLesson && (
        <p className="mt-4 text-base text-emerald-800">
          Up next: <span className="font-semibold">{nextLesson.title}</span>
        </p>
      )}

      {revisit.length > 0 && (
        <div className="mx-auto mt-5 max-w-sm rounded-xl border border-parchment-300 bg-parchment-50 px-4 py-3 text-left">
          <p className="text-sm font-semibold text-ink">What to revisit</p>
          <ul className="mt-2 space-y-2">
            {revisit.map((item) => (
              <li key={item.id} className="text-sm leading-relaxed text-ink/80">
                <span className="font-semibold text-ink">{item.name}</span>
                {item.count > 1 && (
                  <span className="text-muted"> · came up {item.count} times</span>
                )}
                <span className="block text-ink/70">{item.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {isPracticeEnabled() && (
            <Button onClick={() => setPracticing(true)}>Keep practicing</Button>
          )}
          <Button variant="outline" onClick={onReview}>
            Review questions
          </Button>
          {!passed && (
            <Button variant="outline" onClick={onRestart}>
              Restart lesson
            </Button>
          )}
        </div>
        <Link to="/" className={buttonClasses({ variant: 'secondary' })}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
