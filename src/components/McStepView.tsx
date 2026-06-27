import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { McStep } from '../types/lesson';
import { renderPrompt } from '../lib/renderPrompt';
import FeedbackBanner from './FeedbackBanner';
import McQuestion from './McQuestion';
import ScaleVisual from './ScaleVisual';
import StepActions, { type StepHint } from './StepActions';

type McStepViewProps = {
  step: McStep;
  submitted: boolean;
  feedback: { ok: boolean; message: string } | null;
  onSubmit: (selectedIndex: number) => void;
  onContinue: () => void;
  allowRetry?: boolean;
  onTryAgain?: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  hint?: StepHint;
  /** Inline self-explanation prompt shown in place of Continue after a correct answer. */
  reflectSlot?: ReactNode;
  /** A quiet control on the action row (e.g. practice's "Show me how"). */
  secondaryAction?: ReactNode;
};

export default function McStepView({
  step,
  submitted,
  feedback,
  onSubmit,
  onContinue,
  allowRetry = false,
  onTryAgain,
  onBack,
  canGoBack,
  hint,
  reflectSlot,
  secondaryAction,
}: McStepViewProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>(() => step.options.map((_, index) => index));
  const submittingRef = useRef(false);

  // `selectedIndex` is a position in the shuffled display order; map back to the
  // real option index for validation and feedback.
  const displayOptions = order.map((optionIndex) => step.options[optionIndex]);
  const displayCorrectIndex = order.indexOf(step.correctIndex);
  // Only reveal the correct choice once it's answered correctly, or in the
  // (one-shot) mastery check. On a wrong practice attempt we hide it so the
  // learner has to rethink instead of copying the highlighted answer.
  const revealCorrect = submitted && (Boolean(feedback?.ok) || !allowRetry);

  const showFeedback = feedback;

  const handleTryAgain = () => {
    setSelectedIndex(null);
    setOrder((current) => shuffleOrder(current));
    submittingRef.current = false;
    onTryAgain?.();
  };

  const handleCheck = () => {
    if (selectedIndex === null || submittingRef.current || submitted) {
      return;
    }
    submittingRef.current = true;
    onSubmit(order[selectedIndex]);
  };

  return (
    <div>
      <p className="text-lg leading-relaxed text-slate-800">{renderPrompt(step.prompt)}</p>
      <ScaleVisual visual={step.visual} />
      <McQuestion
        options={displayOptions}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        disabled={submitted}
        showResult={revealCorrect}
        correctIndex={displayCorrectIndex}
      />
      {showFeedback && (
        <FeedbackBanner variant={feedback!.ok ? 'correct' : 'incorrect'} message={feedback!.message} />
      )}
      <StepActions
        submitted={submitted}
        feedbackOk={Boolean(feedback?.ok)}
        allowRetry={allowRetry}
        checkDisabled={selectedIndex === null}
        onCheck={handleCheck}
        onContinue={onContinue}
        onTryAgain={handleTryAgain}
        onBack={onBack}
        canGoBack={canGoBack}
        hint={hint}
        reflectSlot={reflectSlot}
        secondaryAction={secondaryAction}
      />
    </div>
  );
}

/** Shuffle answer positions on retry so a learner can't just re-click the same spot. */
function shuffleOrder(order: number[]): number[] {
  if (order.length < 2) {
    return order;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const shuffled = [...order];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (shuffled.some((value, index) => value !== order[index])) {
      return shuffled;
    }
  }
  return [...order].reverse();
}
