import { lazy, Suspense, useState } from 'react';
import type { ConceptStep, Lesson, Step } from '../types/lesson';
import type { LessonAnswerRecord } from '../lib/progress';
import { isPracticeEnabled } from '../lib/ai/config';
import { renderPrompt } from '../lib/renderPrompt';
import ScaleVisual from './ScaleVisual';
import { Button } from './ui';

const PracticeSession = lazy(() => import('./PracticeSession'));

type QuestionStep = Exclude<Step, ConceptStep>;

// Teaching (concept) pages have no answer to review, so they are skipped here.
function isQuestionStep(step: Step): step is QuestionStep {
  return step.type !== 'concept';
}

type LessonReviewProps = {
  lesson: Lesson;
  answerHistory: Record<string, LessonAnswerRecord>;
  userId: string;
  courseId: string;
  onRestart: () => void;
};

export default function LessonReview({
  lesson,
  answerHistory,
  userId,
  courseId,
  onRestart,
}: LessonReviewProps) {
  const [practicing, setPracticing] = useState(false);

  if (practicing) {
    return (
      <Suspense fallback={<p className="text-center text-muted">Loading practice…</p>}>
        <PracticeSession
          userId={userId}
          courseId={courseId}
          lessonId={lesson.id}
          onExit={() => setPracticing(false)}
        />
      </Suspense>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-brand-200 bg-brand-50 px-5 py-3">
        <span className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-wider text-brand-800">
          <EyeIcon className="h-5 w-5" />
          Review mode
        </span>
        <div className="flex items-center gap-2">
          {isPracticeEnabled() && (
            <Button size="sm" onClick={() => setPracticing(true)}>
              Keep practicing
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onRestart}>
            Restart lesson
          </Button>
        </div>
      </div>

      <ReviewSection
        title="Practice"
        steps={lesson.phases.scaffolded}
        answerHistory={answerHistory}
      />
      <ReviewSection
        title="Mastery"
        steps={lesson.phases.mastery}
        answerHistory={answerHistory}
      />
    </div>
  );
}

function ReviewSection({
  title,
  steps,
  answerHistory,
}: {
  title: string;
  steps: Step[];
  answerHistory: Record<string, LessonAnswerRecord>;
}) {
  return (
    <section className="mt-6">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-4">
        {steps.filter(isQuestionStep).map((step, index) => (
          <ReviewCard
            key={step.id}
            step={step}
            index={index}
            answer={answerHistory[step.id]}
          />
        ))}
      </div>
    </section>
  );
}

function ReviewCard({
  step,
  index,
  answer,
}: {
  step: QuestionStep;
  index: number;
  answer?: LessonAnswerRecord;
}) {
  const visual = 'visual' in step ? step.visual : undefined;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-slate-500">Question {index + 1}</p>
        {answer && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              answer.ok
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {answer.ok ? 'Correct' : 'Missed'}
          </span>
        )}
      </div>
      <p className="mt-3 text-base leading-relaxed text-slate-800">
        {renderPrompt(step.prompt)}
      </p>
      <ScaleVisual visual={visual} />
      {answer ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <AnswerBox label="Your answer" value={answer.answer} />
          <AnswerBox label="Correct answer" value={answer.correctAnswer} />
          {answer.attempts.length > 1 && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Attempts
              </p>
              <p className="mt-1 text-sm text-slate-800">{answer.attempts.join(' -> ')}</p>
            </div>
          )}
          {answer.reflection && (
            <div className="rounded-xl bg-brand-50 px-4 py-3 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                Your explanation
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">
                {answer.reflection}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-muted">
          No saved answer for this question yet.
        </p>
      )}
    </article>
  );
}

function AnswerBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EyeIcon({ className }: { className?: string }) {
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
