import { useRef, useState } from 'react';
import type { ExpressionBuilderStep } from '../types/lesson';
import { renderPrompt } from '../lib/renderPrompt';
import FeedbackBanner from './FeedbackBanner';
import StepActions from './StepActions';
import { Button } from './ui';

type ExpressionBuilderQuestionProps = {
  step: ExpressionBuilderStep;
  submitted: boolean;
  feedback: { ok: boolean; message: string } | null;
  allowRetry: boolean;
  hint?: string;
  onSubmit: (tokens: string[]) => void;
  onContinue: () => void;
  onTryAgain: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
};

type TokenChip = {
  id: number;
  value: string;
};

export default function ExpressionBuilderQuestion({
  step,
  submitted,
  feedback,
  allowRetry,
  hint,
  onSubmit,
  onContinue,
  onTryAgain,
  onBack,
  canGoBack,
}: ExpressionBuilderQuestionProps) {
  const allTokens = step.tokens.map((value, id) => ({ id, value }));
  const [selectedTokenIds, setSelectedTokenIds] = useState<number[]>([]);
  const [draggingTokenId, setDraggingTokenId] = useState<number | null>(null);
  const submittingRef = useRef(false);
  const selectedTokens = selectedTokenIds
    .map((id) => allTokens.find((token) => token.id === id)?.value)
    .filter((value): value is string => Boolean(value));
  const unusedTokens = allTokens.filter((token) => !selectedTokenIds.includes(token.id));

  const showFeedback = feedback;

  const addToken = (tokenId: number) => {
    if (submitted || selectedTokenIds.includes(tokenId)) {
      return;
    }
    setSelectedTokenIds((ids) => [...ids, tokenId]);
    setDraggingTokenId(null);
  };

  const removeToken = (tokenId: number) => {
    if (submitted) {
      return;
    }
    setSelectedTokenIds((ids) => ids.filter((id) => id !== tokenId));
  };

  const handleReset = () => {
    if (submitted) {
      return;
    }
    setSelectedTokenIds([]);
    setDraggingTokenId(null);
  };

  const handleTryAgain = () => {
    setSelectedTokenIds([]);
    setDraggingTokenId(null);
    submittingRef.current = false;
    onTryAgain();
  };

  const handleCheck = () => {
    if (submittingRef.current || submitted || selectedTokens.length === 0) {
      return;
    }
    submittingRef.current = true;
    onSubmit(selectedTokens);
  };

  return (
    <div>
      <p className="text-lg leading-relaxed text-slate-800">{renderPrompt(step.prompt)}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-600">Word pieces</p>
          <div className="mt-4 flex min-h-24 flex-wrap content-start items-start gap-3">
            {unusedTokens.map((token) => (
              <TokenButton
                key={token.id}
                token={token}
                disabled={submitted}
                onAdd={addToken}
                onDragStart={setDraggingTokenId}
                onDragEnd={() => setDraggingTokenId(null)}
              />
            ))}
          </div>
        </section>

        <section
          className={`rounded-2xl border-2 border-dashed p-4 transition ${
            draggingTokenId !== null
              ? 'border-brand-500 bg-brand-50'
              : 'border-slate-300 bg-slate-50'
          }`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (draggingTokenId !== null) {
              addToken(draggingTokenId);
            }
          }}
        >
          <p className="text-sm font-medium text-slate-600">Expression</p>
          <div className="mt-4 flex min-h-24 flex-wrap items-center gap-3 rounded-xl bg-white p-3">
            {selectedTokenIds.length > 0 ? (
              selectedTokenIds.map((tokenId) => {
                const value = allTokens.find((token) => token.id === tokenId)?.value ?? '';
                return (
                  <button
                    key={tokenId}
                    type="button"
                    disabled={submitted}
                    title="Remove piece"
                    aria-label={`Remove ${value}`}
                    className={`group/token relative inline-flex min-h-12 items-center rounded-xl bg-brand-100 px-5 text-base font-semibold text-brand-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                      submitted ? 'cursor-default' : 'cursor-pointer hover:bg-brand-200'
                    }`}
                    onClick={() => removeToken(tokenId)}
                  >
                    {value}
                    <span
                      aria-hidden="true"
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[11px] leading-none text-white opacity-0 transition group-hover/token:opacity-100"
                    >
                      &times;
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-muted">Drag or tap pieces here in order.</p>
            )}
          </div>
          <p className="mt-4 rounded-xl bg-white px-4 py-3 text-center text-xl font-semibold text-slate-900">
            {selectedTokens.length > 0 ? selectedTokens.join(' ') : '?'}
          </p>
        </section>
      </div>

      {showFeedback && (
        <FeedbackBanner variant={feedback!.ok ? 'correct' : 'incorrect'} message={feedback!.message} />
      )}

      <StepActions
        submitted={submitted}
        feedbackOk={Boolean(feedback?.ok)}
        allowRetry={allowRetry}
        checkDisabled={selectedTokens.length === 0}
        onCheck={handleCheck}
        onContinue={onContinue}
        onTryAgain={handleTryAgain}
        onBack={onBack}
        canGoBack={canGoBack}
        hint={hint}
      >
        {!submitted && selectedTokenIds.length > 0 ? (
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={handleReset}>
            Reset
          </Button>
        ) : null}
      </StepActions>
    </div>
  );
}

function TokenButton({
  token,
  disabled,
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  token: TokenChip;
  disabled: boolean;
  onAdd: (id: number) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      className="min-h-12 cursor-grab rounded-xl bg-brand-600 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation"
      onClick={() => onAdd(token.id)}
      onDragStart={() => onDragStart(token.id)}
      onDragEnd={onDragEnd}
    >
      {token.value}
    </button>
  );
}
