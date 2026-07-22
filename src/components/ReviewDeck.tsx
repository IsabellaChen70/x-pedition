import { useEffect, useState } from 'react';
import { generateProblem, toMcStep } from '../lib/ai/generate';
import type { GeneratedProblem } from '../lib/ai/types';
import { CONCEPT_LABELS } from '../lib/ai/concepts';
import { getMisconception } from '../lib/ai/misconception';
import { explainWrongChoice } from '../lib/ai/solution';
import { validateMcStep } from '../lib/validation';
import type { MistakeLogEntry } from '../lib/mistakes';
import McStepView from './McStepView';
import { Button, Card } from './ui';

type ReviewDeckProps = {
  mistakes: MistakeLogEntry[];
  /** Persist that an entry has been cleared (retried successfully or dismissed). */
  onResolve: (id: string) => void;
  onClose: () => void;
};

// Review problems start gentle: these are ideas the learner tripped on, so a
// second win should be reachable, not another wall.
const REVIEW_DIFFICULTY = 2;

/**
 * The Review deck: a short, encouraging set of problems worth another look. Each
 * card names the skill and (when we inferred it) the idea to revisit, then lets
 * the learner try a freshly generated equivalent problem for that skill. Clearing
 * one removes it, so the deck shrinks as things click, never growing into a wall
 * of past failures.
 */
export default function ReviewDeck({ mistakes, onResolve, onClose }: ReviewDeckProps) {
  // Snapshot the active entry so resolving it (which drops it from `mistakes`)
  // doesn't yank the retry view out from under the learner mid-problem.
  const [active, setActive] = useState<MistakeLogEntry | null>(null);

  if (active) {
    return (
      <ReviewRetry
        key={active.id}
        entry={active}
        onCleared={() => onResolve(active.id)}
        onBack={() => setActive(null)}
      />
    );
  }

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Review deck</h2>
          <p className="mt-1 text-sm text-muted">
            Problems worth another look. Trying them again is how they stick.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>

      {mistakes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-parchment-300 bg-parchment-100 px-5 py-8 text-center">
          <p className="font-display text-lg font-semibold text-ink">You're all caught up</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Problems you miss land here so you can try them again later.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {mistakes.map((entry) => (
            <MistakeCard
              key={entry.id}
              entry={entry}
              onRetry={() => setActive(entry)}
              onClear={() => onResolve(entry.id)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function MistakeCard({
  entry,
  onRetry,
  onClear,
}: {
  entry: MistakeLogEntry;
  onRetry: () => void;
  onClear: () => void;
}) {
  const why = entry.misconceptionId ? getMisconception(entry.misconceptionId)?.explanation : null;

  return (
    <li className="rounded-2xl border border-parchment-300 bg-parchment-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">
            {CONCEPT_LABELS[entry.concept]}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink/70">
            {why ?? 'Give a problem like this another go when you have a minute.'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onRetry}>
          Try a similar problem
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </li>
  );
}

function ReviewRetry({
  entry,
  onCleared,
  onBack,
}: {
  entry: MistakeLogEntry;
  onCleared: () => void;
  onBack: () => void;
}) {
  const [problem, setProblem] = useState<GeneratedProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void generateProblem(entry.concept, REVIEW_DIFFICULTY).then((next) => {
      if (active) {
        setProblem(next);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [entry.concept]);

  const step = problem ? toMcStep(problem) : null;

  const handleSubmit = (index: number) => {
    if (!step || !problem) {
      return;
    }
    const result = validateMcStep(step, index);
    const message = result.ok
      ? result.message
      : explainWrongChoice(problem, index) ?? result.message;
    setFeedback({ ok: result.ok, message });
    setSubmitted(true);
    if (result.ok && !cleared) {
      setCleared(true);
      onCleared();
    }
  };

  const conceptLabel = CONCEPT_LABELS[entry.concept];

  if (cleared) {
    return (
      <Card padding="lg" className="text-center motion-safe:animate-dialog-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
          <CheckIcon />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold text-ink">That one's cleared</h2>
        <p className="mx-auto mt-1 max-w-sm text-muted">
          Nice work coming back to it. That's how {conceptLabel.toLowerCase()} gets easier.
        </p>
        <Button className="mt-6" onClick={onBack}>
          Back to review deck
        </Button>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Review</p>
          <h2 className="font-display text-xl font-bold text-ink">Try one like it: {conceptLabel}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>

      {loading || !step ? (
        <p className="mt-8 text-center text-muted">Finding a fresh problem...</p>
      ) : (
        <div className="mt-4">
          <McStepView
            key={step.id}
            step={step}
            submitted={submitted}
            feedback={feedback}
            allowRetry
            onSubmit={handleSubmit}
            onContinue={onBack}
            onTryAgain={() => {
              setSubmitted(false);
              setFeedback(null);
            }}
          />
        </div>
      )}
    </Card>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
