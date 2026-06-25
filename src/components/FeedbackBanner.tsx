type FeedbackBannerProps = {
  variant: 'correct' | 'incorrect';
  message: string;
};

export default function FeedbackBanner({ variant, message }: FeedbackBannerProps) {
  const styles = {
    correct: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    incorrect: 'border-amber-200 bg-amber-50 text-amber-950',
  }[variant];

  return (
    <div
      className={`mt-6 rounded-xl border px-4 py-3 text-sm leading-relaxed sm:text-base ${styles}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
