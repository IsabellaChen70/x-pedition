import { useMemo, useRef, useState } from 'react';
import type { EqualShareStep } from '../types/lesson';
import { renderPrompt } from '../lib/renderPrompt';
import FeedbackBanner from './FeedbackBanner';
import StepActions from './StepActions';
import { Button } from './ui';

type EqualShareQuestionProps = {
  step: EqualShareStep;
  submitted: boolean;
  feedback: { ok: boolean; message: string } | null;
  allowRetry: boolean;
  hint?: string;
  onSubmit: (groupCounts: number[]) => void;
  onContinue: () => void;
  onTryAgain: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
};

export default function EqualShareQuestion({
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
}: EqualShareQuestionProps) {
  const { totalItems, groupCount, itemLabel, groupLabel } = step.validation;
  const [assignments, setAssignments] = useState<Array<number | null>>(
    () => Array.from({ length: totalItems }, () => null),
  );
  const [selectedChipId, setSelectedChipId] = useState<number | null>(null);
  const [draggingChipId, setDraggingChipId] = useState<number | null>(null);
  const submittingRef = useRef(false);

  const groupCounts = useMemo(
    () => Array.from({ length: groupCount }, (_, groupIndex) => (
      assignments.filter((assignment) => assignment === groupIndex).length
    )),
    [assignments, groupCount],
  );

  const unassignedChipIds = assignments
    .map((assignment, chipId) => (assignment === null ? chipId : null))
    .filter((chipId): chipId is number => chipId !== null);

  const hasPlacements = assignments.some((assignment) => assignment !== null);

  const showFeedback = feedback;

  // Assign a chip to a group. Intentionally does not guard on the chip's current
  // assignment so a chip already in a box can be dragged straight to another box.
  const assignChip = (chipId: number, groupIndex: number) => {
    if (submitted) {
      return;
    }
    setAssignments((current) => current.map((assignment, index) => (
      index === chipId ? groupIndex : assignment
    )));
    setSelectedChipId(null);
    setDraggingChipId(null);
  };

  const removeChipFromGroup = (chipId: number) => {
    if (submitted) {
      return;
    }
    setAssignments((current) => current.map((assignment, index) => (
      index === chipId ? null : assignment
    )));
  };

  const handleReset = () => {
    if (submitted) {
      return;
    }
    setAssignments(Array.from({ length: totalItems }, () => null));
    setSelectedChipId(null);
    setDraggingChipId(null);
  };

  const handleTryAgain = () => {
    setAssignments(Array.from({ length: totalItems }, () => null));
    setSelectedChipId(null);
    setDraggingChipId(null);
    submittingRef.current = false;
    onTryAgain();
  };

  const handleCheck = () => {
    if (submittingRef.current || submitted || groupCounts.every((count) => count === 0)) {
      return;
    }
    submittingRef.current = true;
    onSubmit(groupCounts);
  };

  return (
    <div>
      <p className="text-lg leading-relaxed text-slate-800">{renderPrompt(step.prompt)}</p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex min-h-20 flex-wrap gap-2 rounded-xl bg-slate-50 p-3">
          {unassignedChipIds.map((chipId) => (
            <Chip
              key={chipId}
              id={chipId}
              label={itemLabel}
              selected={selectedChipId === chipId}
              disabled={submitted}
              onSelect={setSelectedChipId}
              onDragStart={setDraggingChipId}
              onDragEnd={() => setDraggingChipId(null)}
            />
          ))}
          {unassignedChipIds.length === 0 && (
            <p className="text-sm text-muted">All chips have been shared.</p>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: groupCount }, (_, groupIndex) => {
            const chipsInGroup = assignments
              .map((assignment, chipId) => (assignment === groupIndex ? chipId : null))
              .filter((chipId): chipId is number => chipId !== null);

            return (
              <div
                key={groupIndex}
                role="button"
                tabIndex={submitted ? -1 : 0}
                aria-disabled={submitted}
                aria-label={`${groupLabel} ${groupIndex + 1}`}
                className={`min-h-36 rounded-2xl border-2 border-dashed p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                  !submitted && (draggingChipId !== null || selectedChipId !== null)
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-300 bg-white'
                } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                onClick={() => {
                  if (selectedChipId !== null) {
                    assignChip(selectedChipId, groupIndex);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (selectedChipId !== null) {
                      assignChip(selectedChipId, groupIndex);
                    }
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingChipId !== null) {
                    assignChip(draggingChipId, groupIndex);
                  }
                }}
              >
                <p className="text-sm font-semibold text-slate-700">
                  {groupLabel} {groupIndex + 1}
                </p>
                <div className="mt-3 flex min-h-16 flex-wrap gap-2">
                  {chipsInGroup.map((chipId) => (
                    <button
                      key={chipId}
                      type="button"
                      draggable={!submitted}
                      disabled={submitted}
                      title="Remove from group"
                      aria-label={`Remove ${itemLabel} from ${groupLabel} ${groupIndex + 1}`}
                      className="group/chip inline-flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1 rounded-lg bg-amber-100 px-2 text-sm font-bold text-amber-900 transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeChipFromGroup(chipId);
                      }}
                      onDragStart={(event) => {
                        event.stopPropagation();
                        setDraggingChipId(chipId);
                      }}
                      onDragEnd={() => setDraggingChipId(null)}
                    >
                      <span>{itemLabel}</span>
                      <span
                        aria-hidden="true"
                        className="text-amber-700 opacity-0 transition group-hover/chip:opacity-100"
                      >
                        &times;
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-800">
                  {groupCounts[groupIndex]} in this group
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {showFeedback && (
        <FeedbackBanner variant={feedback!.ok ? 'correct' : 'incorrect'} message={feedback!.message} />
      )}

      <StepActions
        submitted={submitted}
        feedbackOk={Boolean(feedback?.ok)}
        allowRetry={allowRetry}
        checkDisabled={groupCounts.every((count) => count === 0)}
        onCheck={handleCheck}
        onContinue={onContinue}
        onTryAgain={handleTryAgain}
        onBack={onBack}
        canGoBack={canGoBack}
        hint={hint}
      >
        {!submitted && hasPlacements ? (
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={handleReset}>
            Reset
          </Button>
        ) : null}
      </StepActions>
    </div>
  );
}

function Chip({
  id,
  label,
  selected,
  disabled,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  id: number;
  label: string;
  selected: boolean;
  disabled: boolean;
  onSelect: (id: number) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      className={`min-h-10 min-w-10 cursor-grab rounded-lg px-3 text-sm font-bold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        selected
          ? 'bg-brand-600 text-white ring-2 ring-brand-200'
          : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
      } disabled:cursor-not-allowed disabled:opacity-60`}
      onClick={() => onSelect(id)}
      onDragStart={() => onDragStart(id)}
      onDragEnd={onDragEnd}
    >
      {label}
    </button>
  );
}
