type FeedbackBannerProps = {
  variant: 'correct' | 'incorrect';
  message: string;
};

/**
 * The shared answer feedback for every question type. A wrong answer is calm and
 * amber, paired with a "let's look again" idea icon, never a red X: color is
 * never the only signal, and nothing here reads as a scolding.
 */
export default function FeedbackBanner({ variant, message }: FeedbackBannerProps) {
  const correct = variant === 'correct';
  const styles = correct
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-amber-200 bg-amber-50 text-amber-950';

  return (
    <div
      className={`mt-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed sm:text-base ${styles}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`mt-0.5 shrink-0 ${correct ? 'text-emerald-600' : 'text-amber-600'}`}
        aria-hidden="true"
      >
        {correct ? <CheckIcon /> : <IdeaIcon />}
      </span>
      <span>{message}</span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IdeaIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.2 1 2.5h6c0-1.3.3-1.9 1-2.5A6 6 0 0 0 12 3z" />
    </svg>
  );
}
