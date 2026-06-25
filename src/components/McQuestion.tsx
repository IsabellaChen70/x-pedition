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
        const isWrong = showResult && isSelected && correctIndex !== index;

        let style =
          'min-h-12 w-full rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ';
        if (isCorrect) {
          style += 'border-emerald-500 bg-emerald-50 text-emerald-900';
        } else if (isWrong) {
          style += 'border-red-400 bg-red-50 text-red-900';
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
            {option}
          </button>
        );
      })}
    </div>
  );
}
