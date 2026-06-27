import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { renderPrompt } from '../lib/renderPrompt';
import { Button } from './ui';

export type StepHint = {
  /** Escalating hint levels: L1 conceptual nudge, L2 the move, L3 next step.
   * Deterministic and answer-safe, so they reveal instantly. */
  levels: string[];
};

type StepActionsProps = {
  submitted: boolean;
  feedbackOk: boolean;
  allowRetry: boolean;
  checkDisabled?: boolean;
  onCheck: () => void;
  onContinue: () => void;
  onTryAgain: () => void;
  /** Go to the previous step (rendered bottom-left). */
  onBack?: () => void;
  canGoBack?: boolean;
  /** Escalating Socratic hints, offered during the attempt (scaffolded only). */
  hint?: StepHint;
  /** Inline content shown in place of Continue after a correct answer (the
   * self-explanation prompt). When present, it replaces the forward action. */
  reflectSlot?: ReactNode;
  /** A quiet control shown on the left of the action bar, on the same row as the
   * primary button (e.g. practice's "Show me how"). */
  secondaryAction?: ReactNode;
  /** Extra controls rendered next to the primary action while unsubmitted (e.g. a reset button). */
  children?: ReactNode;
};

/**
 * Bottom action bar for every question type. Back (quiet) sits bottom-left;
 * the escalating Get Hint control and the primary forward action (Check /
 * Continue / Try again) sit bottom-right, so help is right where the eye is.
 * Revealed hints stack above the bar so the learner keeps the full progression.
 */
export default function StepActions({
  submitted,
  feedbackOk,
  allowRetry,
  checkDisabled = false,
  onCheck,
  onContinue,
  onTryAgain,
  onBack,
  canGoBack = false,
  hint,
  reflectSlot,
  secondaryAction,
  children,
}: StepActionsProps) {
  const [revealed, setRevealed] = useState<string[]>([]);

  let primary: ReactNode = null;
  if (!submitted) {
    primary = (
      <Button disabled={checkDisabled} onClick={onCheck}>
        Check
      </Button>
    );
  } else if (feedbackOk) {
    primary = <Button onClick={onContinue}>Continue</Button>;
  } else if (allowRetry) {
    primary = <Button onClick={onTryAgain}>Try again</Button>;
  } else {
    primary = <Button onClick={onContinue}>Continue</Button>;
  }

  const levels = hint?.levels ?? [];
  // When the hint set changes (e.g. a detected misconception swaps the generic
  // levels for misconception-specific fix-steps), start the reveal fresh so the
  // new hints are reachable instead of being hidden behind stale ones.
  const levelsKey = levels.join('|');
  useEffect(() => {
    setRevealed([]);
  }, [levelsKey]);

  // Hints stay available through the attempt and after a wrong try, but not once correct.
  const hintsOpen = levels.length > 0 && !(submitted && feedbackOk);
  const hasMore = revealed.length < levels.length;

  const revealNext = () => {
    const next = levels[revealed.length];
    if (next === undefined) {
      return;
    }
    setRevealed((prev) => [...prev, next]);
  };

  // After a correct answer, an inline reflection prompt replaces the Continue action.
  const showReflect = submitted && feedbackOk && Boolean(reflectSlot);

  return (
    <>
      {revealed.length > 0 && (
        <div className="mt-4 space-y-2">
          {revealed.map((text, index) => (
            <p
              key={index}
              className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900"
            >
              <span className="font-semibold">Hint {index + 1}: </span>
              {renderPrompt(text)}
            </p>
          ))}
        </div>
      )}
      {showReflect && reflectSlot}
      {!showReflect && (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && canGoBack ? (
            <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
              ← Back
            </Button>
          ) : null}
          {secondaryAction}
        </div>
        <div className="flex items-center gap-3">
          {!submitted && children}
          {hintsOpen && hasMore ? (
            <Button variant="outline" onClick={revealNext}>
              <span className="inline-flex items-center gap-1.5">
                <KeyIcon className="h-4 w-4" />
                {revealed.length === 0 ? 'Get hint' : 'Another hint'}
              </span>
            </Button>
          ) : null}
          {primary}
        </div>
      </div>
      )}
    </>
  );
}

function KeyIcon({ className }: { className?: string }) {
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
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l9 9" />
      <path d="M16 16l2-2" />
      <path d="M19 19l2-2" />
    </svg>
  );
}
