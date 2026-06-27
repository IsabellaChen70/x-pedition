import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  ConceptInteraction,
  ConceptRevealStep,
  ConceptStep,
  ScaleVisualConfig,
} from '../types/lesson';
import { renderPrompt } from '../lib/renderPrompt';
import { removeWeightFromBothSides } from '../lib/scale';
import { cn } from '../lib/cn';
import BalanceScale from './BalanceScale';
import { Button } from './ui';

type ConceptCardProps = {
  step: ConceptStep;
  onContinue: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
};

export default function ConceptCard({ step, onContinue, onBack, canGoBack }: ConceptCardProps) {
  return (
    <div className="rounded-2xl border-2 border-brand-100 bg-brand-50/40 p-5 sm:p-6">
      <p className="text-sm font-medium uppercase tracking-wide text-brand-600">Learn</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-900">{step.title}</h2>
      <p className="mt-2 leading-relaxed text-slate-700">{renderPrompt(step.body)}</p>

      {step.interaction ? (
        <ConceptInteractionView
          interaction={step.interaction}
          continueLabel={step.continueLabel}
          onContinue={onContinue}
          onBack={onBack}
          canGoBack={canGoBack}
        />
      ) : (
        <div className="mt-4">
          {step.visual && step.visual.type === 'scale' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <BalanceScale config={step.visual.config} />
            </div>
          )}
          <ConceptActionBar onBack={onBack} canGoBack={canGoBack}>
            <Button onClick={onContinue}>{step.continueLabel ?? 'Got it'}</Button>
          </ConceptActionBar>
        </div>
      )}
    </div>
  );
}

function ConceptActionBar({
  onBack,
  canGoBack,
  children,
}: {
  onBack?: () => void;
  canGoBack?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center">
        {onBack && canGoBack ? (
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
            ← Back
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

function ConceptInteractionView({
  interaction,
  continueLabel,
  onContinue,
  onBack,
  canGoBack,
}: {
  interaction: ConceptInteraction;
  continueLabel?: string;
  onContinue: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}) {
  if (interaction.type === 'reveal') {
    return (
      <RevealInteraction
        interaction={interaction}
        continueLabel={continueLabel}
        onContinue={onContinue}
        onBack={onBack}
        canGoBack={canGoBack}
      />
    );
  }
  return (
    <ScaleDemoInteraction
      interaction={interaction}
      continueLabel={continueLabel}
      onContinue={onContinue}
      onBack={onBack}
      canGoBack={canGoBack}
    />
  );
}

function RevealInteraction({
  interaction,
  continueLabel,
  onContinue,
  onBack,
  canGoBack,
}: {
  interaction: Extract<ConceptInteraction, { type: 'reveal' }>;
  continueLabel?: string;
  onContinue: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}) {
  const total = interaction.steps.length;
  const [revealed, setRevealed] = useState(1);
  const [engaged, setEngaged] = useState<Set<number>>(() => new Set());
  const allRevealed = revealed >= total;

  const markEngaged = (index: number) =>
    setEngaged((current) => {
      if (current.has(index)) {
        return current;
      }
      const next = new Set(current);
      next.add(index);
      return next;
    });

  // The newest revealed card is the one the learner has to engage with before the
  // advance control appears. Ungated steps (no `gate`) count as engaged at once,
  // which keeps existing tap-through lessons behaving exactly as before.
  const currentIndex = revealed - 1;
  const currentStep = interaction.steps[currentIndex];
  const currentEngaged = !currentStep?.gate || engaged.has(currentIndex);

  return (
    <div className="mt-4 space-y-3">
      {interaction.steps.slice(0, revealed).map((revealStep, index) => (
        <RevealStepCard key={index} index={index} step={revealStep} onEngage={markEngaged} />
      ))}
      <ConceptActionBar onBack={onBack} canGoBack={canGoBack}>
        {currentEngaged &&
          (allRevealed ? (
            <Button onClick={onContinue}>{continueLabel ?? 'Got it'}</Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setRevealed((current) => Math.min(total, current + 1))}
            >
              {interaction.revealLabel ?? 'Show me'}
            </Button>
          ))}
      </ConceptActionBar>
    </div>
  );
}

function RevealStepCard({
  step,
  index,
  onEngage,
}: {
  step: ConceptRevealStep;
  index: number;
  onEngage: (index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="leading-relaxed text-slate-700">{renderPrompt(step.text)}</p>
      {step.visual && step.visual.type === 'scale' && (
        <div className="mt-3">
          <BalanceScale config={step.visual.config} />
        </div>
      )}
      {step.gate && (
        <div className="mt-3">
          <FillBlankGate gate={step.gate} onSolve={() => onEngage(index)} />
        </div>
      )}
    </div>
  );
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Fill-in-the-blank takeaway: the learner taps word chips into the blanks of a
 * sentence. Tapping a chip drops it into the first empty blank; tapping a filled
 * blank sends its word back to the bank. Once every blank matches `answers` in
 * order it locks and calls `onSolve`. Wrong picks are nudged, never blocked, and
 * the correct words always stay in the bank.
 */
function FillBlankGate({
  gate,
  onSolve,
}: {
  gate: NonNullable<ConceptRevealStep['gate']>;
  onSolve: () => void;
}) {
  const segments = useMemo(() => gate.template.split('___'), [gate.template]);
  const blankCount = segments.length - 1;

  // Build the shuffled bank once: each chip keeps a stable id so duplicate words
  // (e.g. an answer that also appears as an extra) stay individually trackable.
  const chips = useMemo(
    () => shuffle([...gate.answers, ...(gate.extras ?? [])]).map((word, id) => ({ id, word })),
    [gate.answers, gate.extras],
  );

  const [slots, setSlots] = useState<(number | null)[]>(() => Array(blankCount).fill(null));
  const [locked, setLocked] = useState(false);
  const [draggingChipId, setDraggingChipId] = useState<number | null>(null);

  const wordOf = (chipId: number | null) =>
    chipId === null ? null : (chips.find((chip) => chip.id === chipId)?.word ?? null);

  const isComplete = slots.every((slot) => slot !== null);
  // If the sentence were right it would already be locked, so any complete-but-
  // unlocked state means at least one blank is wrong.
  const wrongFilled = isComplete && !locked;
  const isWrongSlot = (index: number) => wrongFilled && wordOf(slots[index]) !== gate.answers[index];

  const available = chips.filter((chip) => !slots.includes(chip.id));

  // Tap places into the first empty blank; a drag drop targets a specific blank
  // (replacing whatever was there, which returns to the bank).
  const placeChip = (chipId: number, targetSlot?: number) => {
    if (locked || slots.includes(chipId)) return;
    const slotIndex = targetSlot ?? slots.indexOf(null);
    if (slotIndex < 0) return;
    const next = [...slots];
    next[slotIndex] = chipId;
    setSlots(next);
    if (next.every((slot) => slot !== null) && next.every((id, i) => wordOf(id) === gate.answers[i])) {
      setLocked(true);
      onSolve();
    }
  };

  const dropOnSlot = (index: number) => {
    if (draggingChipId === null) return;
    placeChip(draggingChipId, index);
    setDraggingChipId(null);
  };

  const clearSlot = (index: number) => {
    if (locked || slots[index] === null) return;
    setSlots((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
  };

  const renderSlot = (index: number) => {
    const chipId = slots[index];
    if (chipId === null) {
      return (
        <span
          key={`slot-${index}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            dropOnSlot(index);
          }}
          className={cn(
            'inline-flex min-h-11 min-w-[3.5rem] items-center justify-center rounded-lg border-2 border-dashed align-middle transition',
            draggingChipId !== null ? 'border-brand-500 bg-brand-50' : 'border-brand-300 bg-parchment-50',
          )}
        />
      );
    }
    return (
      <button
        key={`slot-${index}`}
        type="button"
        disabled={locked}
        onClick={() => clearSlot(index)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          dropOnSlot(index);
        }}
        className={cn(
          'min-h-11 rounded-lg border-2 px-3 py-1 align-middle text-sm font-semibold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          locked
            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
            : isWrongSlot(index)
              ? 'border-amber-400 bg-amber-50 text-amber-900'
              : 'border-brand-400 bg-brand-50 text-brand-900 hover:border-brand-500',
        )}
      >
        {wordOf(chipId)}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {!locked && (
        <p className="text-sm font-medium text-slate-700">
          Tap or drag the words to finish the sentence.
        </p>
      )}
      <p
        className={cn(
          'flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-xl border-2 px-4 py-3 leading-relaxed transition',
          locked
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 motion-safe:animate-dialog-in'
            : 'border-parchment-300 bg-parchment-50 text-slate-800',
        )}
      >
        {segments.map((segment, index) => (
          <Fragment key={`seg-${index}`}>
            {segment ? <span>{renderPrompt(segment)}</span> : null}
            {index < blankCount ? renderSlot(index) : null}
          </Fragment>
        ))}
      </p>
      {!locked && available.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {available.map((chip) => (
            <button
              key={chip.id}
              type="button"
              draggable
              onClick={() => placeChip(chip.id)}
              onDragStart={() => setDraggingChipId(chip.id)}
              onDragEnd={() => setDraggingChipId(null)}
              className="min-h-11 cursor-grab rounded-xl border-2 border-parchment-300 bg-parchment-50 px-4 py-2 text-sm font-semibold text-ink transition touch-manipulation hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:cursor-grabbing"
            >
              {chip.word}
            </button>
          ))}
        </div>
      )}
      {wrongFilled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          {gate.hint ? (
            <>
              <p>
                <span className="font-semibold">Hint: </span>
                {renderPrompt(gate.hint)}
              </p>
              <p className="mt-1 font-medium text-amber-700">Now tap a word to swap it.</p>
            </>
          ) : (
            <p className="font-medium text-amber-700">Not quite, tap a word to swap it.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ScaleDemoInteraction({
  interaction,
  continueLabel,
  onContinue,
  onBack,
  canGoBack,
}: {
  interaction: Extract<ConceptInteraction, { type: 'scale_demo' }>;
  continueLabel?: string;
  onContinue: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}) {
  const [config, setConfig] = useState<ScaleVisualConfig>(interaction.config);
  const [tried, setTried] = useState(false);
  const [wobbleSignal, setWobbleSignal] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [guess, setGuess] = useState<number | null>(null);

  const predict = interaction.predict;
  // When a "predict the result" beat is present, the learner has to commit to a
  // guess before the lift-off plays; the animation then checks their guess.
  const needsGuess = Boolean(predict) && guess === null;

  // Play (or replay) the lift-off from the starting position, so the subtraction
  // can be watched as many times as needed before moving on.
  const playRemoval = () => {
    if (removing) {
      return;
    }
    setConfig(interaction.config);
    setTried(false);
    setRemoving(true);
    window.setTimeout(() => {
      setConfig(removeWeightFromBothSides(interaction.config, interaction.value));
      setTried(true);
      setWobbleSignal((signal) => signal + 1);
      setRemoving(false);
    }, 900);
  };

  return (
    <div className="mt-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <BalanceScale
          config={config}
          balanced
          wobbleSignal={wobbleSignal}
          removingValue={removing ? interaction.value : undefined}
        />
      </div>
      {predict && (
        <div className="mt-3">
          <p className="text-sm font-medium text-slate-700">{renderPrompt(predict.prompt)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {predict.options.map((option, index) => {
              const isAnswer = tried && index === predict.answerIndex;
              const isWrongGuess = tried && guess === index && index !== predict.answerIndex;
              const isPicked = !tried && guess === index;
              const isMuted = (removing || tried) && !isAnswer && !isWrongGuess && !isPicked;
              return (
                <button
                  key={index}
                  type="button"
                  disabled={removing || tried}
                  onClick={() => setGuess(index)}
                  className={cn(
                    'min-h-11 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                    isAnswer
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : isWrongGuess
                        ? 'border-amber-400 bg-amber-50 text-amber-900'
                        : isPicked
                          ? 'border-brand-600 bg-brand-50 text-brand-900'
                          : 'border-parchment-300 bg-parchment-50 text-ink hover:border-brand-400 hover:bg-brand-50',
                    isMuted && 'opacity-60',
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {tried && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {renderPrompt(interaction.resultCaption)}
        </p>
      )}
      <ConceptActionBar onBack={onBack} canGoBack={canGoBack}>
        {tried ? (
          <>
            <Button variant="secondary" disabled={removing} onClick={playRemoval}>
              Show me again
            </Button>
            <Button onClick={onContinue}>{continueLabel ?? 'Got it'}</Button>
          </>
        ) : (
          <Button disabled={removing || needsGuess} onClick={playRemoval}>
            {removing ? `Lifting ${interaction.value} lb off each side…` : interaction.actionLabel}
          </Button>
        )}
      </ConceptActionBar>
    </div>
  );
}
