type McQuestionProps = {
  options: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
  showResult?: boolean;
  correctIndex?: number;
};

export default function McQuestion({
  options,
  selectedIndex,
  onSelect,
  disabled = false,
  showResult = false,
  correctIndex,
}: McQuestionProps) {
  return (
    <div className="mt-6 flex flex-col gap-3" role="listbox" aria-label="Answer choices">
      {options.map((option, index) => {
        const isSelected = selectedIndex === index;
        const isCorrect = showResult && correctIndex === index;
        // A wrong answer gets a calm, neutral amber wash, never a red "X": it
        // reads as "let's look again", not a punishment.
        const isWrong = showResult && isSelected && correctIndex !== index;

        let style =
          'flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ';
        if (isCorrect) {
          style += 'border-emerald-500 bg-emerald-50 text-emerald-900';
        } else if (isWrong) {
          style += 'border-amber-400 bg-amber-50 text-amber-900';
        } else if (isSelected) {
          style += 'border-brand-600 bg-brand-50 text-brand-900';
        } else {
          style += 'border-parchment-300 bg-parchment-50 text-ink hover:border-brand-400 hover:bg-brand-50';
        }

        return (
          <button
            key={index}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={disabled}
            className={style}
            onClick={() => onSelect(index)}
          >
            <span>{option}</span>
            {/* A shape, not just a color, marks the result so it reads without
                relying on color alone. */}
            {isCorrect && (
              <span className="shrink-0 text-emerald-600">
                <CheckMark />
                <span className="sr-only">Correct answer</span>
              </span>
            )}
            {isWrong && (
              <span className="shrink-0 text-amber-600">
                <RetryMark />
                <span className="sr-only">Your answer, worth another look</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

// A "give it another go" arrow rather than an X, so a wrong choice never reads as
// a scolding mark.
function RetryMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
    </svg>
  );
}
