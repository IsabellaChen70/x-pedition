import { useRef, useState } from 'react';
import type { ScaleInteractiveStep, ScaleVisualConfig } from '../types/lesson';
import {
  canApplyRemoveFromBoth,
  removeWeightFromBothSides,
  removeWeightFromLeftOnly,
} from '../lib/scale';
import { renderPrompt } from '../lib/renderPrompt';
import BalanceScale from './BalanceScale';
import FeedbackBanner from './FeedbackBanner';
import McQuestion from './McQuestion';
import StepActions from './StepActions';
import { Button } from './ui';

type ScaleInteractiveQuestionProps = {
  step: ScaleInteractiveStep;
  submitted: boolean;
  feedback: { ok: boolean; message: string } | null;
  onApplyRemoval: (config: ScaleVisualConfig, fromBoth: boolean) => void;
  onSubmit: (mcIndex: number | null) => void;
  onContinue: () => void;
  onTryAgain: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  scaleConfig: ScaleVisualConfig;
  removalApplied: boolean;
  removedFromBoth: boolean;
  allowRetry: boolean;
  hint?: string;
};

export default function ScaleInteractiveQuestion({
  step,
  submitted,
  feedback,
  onApplyRemoval,
  onSubmit,
  onContinue,
  onTryAgain,
  onBack,
  canGoBack,
  scaleConfig,
  removalApplied,
  removedFromBoth,
  allowRetry,
  hint,
}: ScaleInteractiveQuestionProps) {
  const [selectedMcIndex, setSelectedMcIndex] = useState<number | null>(null);
  const [wobbleSignal, setWobbleSignal] = useState(0);
  const [removing, setRemoving] = useState(false);
  const submittingRef = useRef(false);

  const removeValue = step.validation.value;
  // Only offer the two "change the scale" buttons from the untouched starting
  // state; once a move is made the learner uses Reset scale to start over.
  const showScaleActions =
    !submitted && !removalApplied && canApplyRemoveFromBoth(step.visual.config, removeValue);
  const showMc = step.followUpMc && removalApplied && removedFromBoth && !submitted;
  const canCheck =
    removalApplied &&
    !submitted &&
    (!step.followUpMc || removedFromBoth) &&
    (!step.followUpMc || selectedMcIndex !== null);

  const showFeedback = feedback;

  const handleTryAgain = () => {
    setSelectedMcIndex(null);
    submittingRef.current = false;
    onTryAgain();
  };

  const handleCheck = () => {
    if (!canCheck || submittingRef.current || submitted) {
      return;
    }
    submittingRef.current = true;
    onSubmit(selectedMcIndex);
  };

  // Show the weights lifting off both pans, then actually remove them and wobble.
  const handleRemoveFromBoth = () => {
    if (removing || removalApplied) {
      return;
    }
    setRemoving(true);
    window.setTimeout(() => {
      onApplyRemoval(removeWeightFromBothSides(step.visual.config, removeValue), true);
      setWobbleSignal((signal) => signal + 1);
      setRemoving(false);
    }, 900);
  };

  return (
    <div>
      <p className="text-lg leading-relaxed text-slate-800">{renderPrompt(step.prompt)}</p>

      <div className="my-6 rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300">
        <BalanceScale
          config={scaleConfig}
          balanced={!(removalApplied && !removedFromBoth)}
          wobbleSignal={wobbleSignal}
          removingValue={removing ? removeValue : undefined}
          headroom
        />
      </div>

      {removing && (
        <p className="-mt-2 mb-2 text-center text-sm text-muted">
          Lifting {removeValue} lb off each side…
        </p>
      )}

      {showScaleActions && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-600">Change the scale:</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={removing}
              onClick={handleRemoveFromBoth}
            >
              Remove {removeValue} lb from each side
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={removing}
              onClick={() =>
                onApplyRemoval(removeWeightFromLeftOnly(step.visual.config, removeValue), false)
              }
            >
              Remove {removeValue} lb from left only
            </Button>
          </div>
        </div>
      )}

      {removalApplied && !removedFromBoth && !submitted && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Whoa, that tipped the scale over! It is heavier on one side now. Hit Reset scale, then
          take the same weight off <span className="font-bold">both</span> pans to keep it balanced.
        </p>
      )}

      {showMc && step.followUpMc && (
        <div className="mt-4">
          <p className="text-lg leading-relaxed text-slate-800">
            {renderPrompt(step.followUpMc.prompt)}
          </p>
          <McQuestion
            options={step.followUpMc.options}
            selectedIndex={selectedMcIndex}
            onSelect={setSelectedMcIndex}
          />
        </div>
      )}

      {showFeedback && (
        <FeedbackBanner variant={feedback!.ok ? 'correct' : 'incorrect'} message={feedback!.message} />
      )}

      <StepActions
        submitted={submitted}
        feedbackOk={Boolean(feedback?.ok)}
        allowRetry={allowRetry}
        checkDisabled={!canCheck}
        onCheck={handleCheck}
        onContinue={onContinue}
        onTryAgain={handleTryAgain}
        onBack={onBack}
        canGoBack={canGoBack}
        hint={hint}
      >
        {removalApplied && (
          <Button variant="secondary" onClick={handleTryAgain}>
            Reset scale
          </Button>
        )}
      </StepActions>
    </div>
  );
}
