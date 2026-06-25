import { useState } from 'react';
import type { ReactNode } from 'react';
import { renderPrompt } from '../lib/renderPrompt';
import { Button } from './ui';

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
  /** Optional hint, offered as a quiet control beside Back during the attempt. */
  hint?: string;
  /** Extra controls rendered next to the primary action while unsubmitted (e.g. a reset button). */
  children?: ReactNode;
};

/**
 * Bottom action bar for every question type. Back (quiet) sits bottom-left;
 * Hint and the primary forward action (Check / Continue / Try again) sit
 * bottom-right, so help is right where the eye is when deciding to check.
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
  children,
}: StepActionsProps) {
  const [hintRevealed, setHintRevealed] = useState(false);

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

  const showHintButton = Boolean(hint) && !hintRevealed && !submitted;

  return (
    <>
      {hint && hintRevealed && (
        <p className="mt-4 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900">
          {renderPrompt(hint)}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center">
          {onBack && canGoBack ? (
            <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
              ← Back
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {!submitted && children}
          {showHintButton ? (
            <Button variant="outline" onClick={() => setHintRevealed(true)}>
              <span className="inline-flex items-center gap-1.5">
                <KeyIcon className="h-4 w-4" />
                Hint
              </span>
            </Button>
          ) : null}
          {primary}
        </div>
      </div>
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
