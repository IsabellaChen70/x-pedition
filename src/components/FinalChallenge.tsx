import { useMemo, useState } from 'react';
import { conceptForLesson } from '../lib/ai/concepts';
import { generateLocalProblem, toMcStep } from '../lib/ai/generate';
import type { GeneratedProblem } from '../lib/ai/types';
import { getCourse } from '../lib/content';
import { fireConfetti } from '../lib/confetti';
import { validateMcStep } from '../lib/validation';
import Chest from './Chest';
import McStepView from './McStepView';
import { Button, Card } from './ui';

type FinalChallengeProps = {
  /** Called when the learner answers every question correctly. */
  onPass: () => void;
  /** Close the challenge without unlocking (back to the map). */
  onExit: () => void;
};

// One puzzle per lesson at a steady mid difficulty: comprehensive but fair for a
// learner who has already cleared every lesson.
const DIFFICULTY = 3;

type Question = { title: string; problem: GeneratedProblem };

/** One verified puzzle per lesson, in course order, drawing on that lesson's skill. */
function buildQuestions(): Question[] {
  const course = getCourse();
  const questions: Question[] = [];
  for (const lessonId of course.lessonOrder) {
    const concept = conceptForLesson(lessonId);
    if (!concept) continue;
    questions.push({
      title: course.lessons[lessonId]?.title ?? '',
      problem: generateLocalProblem(concept, DIFFICULTY),
    });
  }
  return questions;
}

export default function FinalChallenge({ onPass, onExit }: FinalChallengeProps) {
  const [round, setRound] = useState(0);
  // Fresh puzzles each attempt: bumping `round` on retry intentionally forces a
  // regenerate, even though buildQuestions() takes no args.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const questions = useMemo(() => buildQuestions(), [round]);
  const total = questions.length;

  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [index, setIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [correct, setCorrect] = useState(0);

  const current = questions[index];
  const step = current ? toMcStep(current.problem) : null;
  // Pass at 4 of 5, one slip is allowed on the capstone.
  const passMark = Math.max(1, total - 1);
  const passed = correct >= passMark;

  const handleSubmit = (selectedIndex: number) => {
    if (!step) return;
    const result = validateMcStep(step, selectedIndex);
    setFeedback({ ok: result.ok, message: result.message });
    setSubmitted(true);
    if (result.ok) setCorrect((count) => count + 1);
  };

  const handleContinue = () => {
    if (index + 1 >= total) {
      if (correct >= passMark) fireConfetti();
      setPhase('result');
      return;
    }
    setIndex((i) => i + 1);
    setSubmitted(false);
    setFeedback(null);
  };

  const startRun = () => {
    setIndex(0);
    setSubmitted(false);
    setFeedback(null);
    setCorrect(0);
    setPhase('quiz');
  };

  const tryAgain = () => {
    setRound((r) => r + 1); // regenerate a fresh set
    startRun();
  };

  if (phase === 'intro') {
    return (
      <Card>
        <div className="text-center">
          <div className="flex justify-center">
            <Chest variant="closed" className="h-20 w-auto drop-shadow-md" />
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold text-ink">Final Challenge</h2>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onExit}>
            ← Back to map
          </Button>
          <Button onClick={startRun}>Start challenge</Button>
        </div>
      </Card>
    );
  }

  if (phase === 'result') {
    return (
      <Card>
        <div className="text-center">
          <div className="flex justify-center">
            <Chest
              variant={passed ? 'open' : 'closed'}
              className={`h-20 w-auto drop-shadow-md ${passed ? 'motion-safe:animate-chest-bob' : ''}`}
            />
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold text-ink">
            {passed ? 'You did it!' : 'So close!'}
          </h2>
          <p className="nums mt-1 font-display text-lg font-bold text-brand-700">
            {correct} / {total} correct
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {passed
              ? 'You showed your skills across the map. The treasure is yours!'
              : `Get at least ${passMark} of ${total} to claim the treasure. Take another run at it!`}
          </p>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onExit}>
            ← Back to map
          </Button>
          {passed ? (
            <Button onClick={onPass}>Open the treasure</Button>
          ) : (
            <Button onClick={tryAgain}>Try again</Button>
          )}
        </div>
      </Card>
    );
  }

  if (!step || !current) {
    return null;
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-ink">Final Challenge</p>
          <p className="text-xs text-muted">
            Question {index + 1} of {total} · {current.title}
          </p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded text-sm font-semibold text-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          Back to map
        </button>
      </div>

      <ProgressDots total={total} index={index} />

      <div className="mt-4">
        <McStepView
          key={`${round}-${index}`}
          step={step}
          submitted={submitted}
          feedback={feedback}
          onSubmit={handleSubmit}
          onContinue={handleContinue}
        />
      </div>
    </Card>
  );
}

function ProgressDots({ total, index }: { total: number; index: number }) {
  return (
    <div className="mt-3 flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < index ? 'bg-brand-500' : i === index ? 'bg-gold-400' : 'bg-parchment-300'}`}
        />
      ))}
    </div>
  );
}
