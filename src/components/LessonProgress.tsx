type LessonProgressProps = {
  phase: 'scaffolded' | 'mastery';
  stepIndex: number;
  totalSteps: number;
  label?: string;
};

/** A treasure-trail step indicator: a dot per step along a dashed route. */
export default function LessonProgress({ phase, stepIndex, totalSteps, label }: LessonProgressProps) {
  const heading = label ?? (phase === 'scaffolded' ? 'Practice' : 'Mastery check');

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-display font-semibold text-ink">{heading}</span>
        <span className="nums text-muted">
          Step {stepIndex + 1} of {totalSteps}
        </span>
      </div>
      <div className="flex items-center">
        {Array.from({ length: totalSteps }, (_, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          return (
            <div key={i} className="flex flex-1 items-center last:flex-none">
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition ${
                  current
                    ? 'border-gold-600 bg-gold-400'
                    : done
                      ? 'border-brand-600 bg-brand-500'
                      : 'border-parchment-300 bg-parchment-100'
                }`}
              />
              {i < totalSteps - 1 && (
                <span
                  className={`mx-1 h-0 flex-1 border-t-2 border-dashed ${
                    done ? 'border-brand-400' : 'border-parchment-300'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
