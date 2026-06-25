import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ConceptInteraction, ConceptStep, ScaleVisualConfig } from '../types/lesson';
import { renderPrompt } from '../lib/renderPrompt';
import { removeWeightFromBothSides } from '../lib/scale';
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
  const allRevealed = revealed >= total;

  return (
    <div className="mt-4 space-y-3">
      {interaction.steps.slice(0, revealed).map((revealStep, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">

          <p className="leading-relaxed text-slate-700">{renderPrompt(revealStep.text)}</p>
          {revealStep.visual && revealStep.visual.type === 'scale' && (
            <div className="mt-3">
              <BalanceScale config={revealStep.visual.config} />
            </div>
          )}
        </div>
      ))}
      <ConceptActionBar onBack={onBack} canGoBack={canGoBack}>
        {allRevealed ? (
          <Button onClick={onContinue}>{continueLabel ?? 'Got it'}</Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setRevealed((current) => Math.min(total, current + 1))}
          >
            {interaction.revealLabel ?? 'Show me'}
          </Button>
        )}
      </ConceptActionBar>
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
          <Button disabled={removing} onClick={playRemoval}>
            {removing ? `Lifting ${interaction.value} lb off each side…` : interaction.actionLabel}
          </Button>
        )}
      </ConceptActionBar>
    </div>
  );
}
