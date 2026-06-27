import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { TileCombineStep } from '../types/lesson';
import type { TileGrouping } from '../lib/validation';
import { renderPrompt } from '../lib/renderPrompt';
import FeedbackBanner from './FeedbackBanner';
import StepActions, { type StepHint } from './StepActions';
import { Button } from './ui';

type Zone = 'x' | 'const';
type TileDef = { id: number; label: string; kind: Zone };

type TileCombineQuestionProps = {
  step: TileCombineStep;
  submitted: boolean;
  feedback: { ok: boolean; message: string } | null;
  allowRetry: boolean;
  hint?: StepHint;
  onSubmit: (grouped: TileGrouping) => void;
  onContinue: () => void;
  onTryAgain: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
};

function chipClasses(kind: Zone, selected: boolean): string {
  const color =
    kind === 'x'
      ? 'bg-brand-600 text-white'
      : 'border-2 border-amber-400 bg-amber-100 text-amber-900';
  const ring = selected ? ' ring-2 ring-brand-300' : '';
  return `flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold shadow-sm transition ${color}${ring}`;
}

export default function TileCombineQuestion({
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
}: TileCombineQuestionProps) {
  const tileLabel = step.validation.tileLabel ?? 'x';
  const constantLabel = step.validation.distractorLabel;

  const tiles: TileDef[] = [
    ...Array.from({ length: step.validation.totalTiles }, (_, index) => ({
      id: index,
      label: tileLabel,
      kind: 'x' as const,
    })),
    ...(constantLabel
      ? [{ id: step.validation.totalTiles, label: constantLabel, kind: 'const' as const }]
      : []),
  ];

  const [zoneByTile, setZoneByTile] = useState<Record<number, Zone>>({});
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [draggingTileId, setDraggingTileId] = useState<number | null>(null);
  const submittingRef = useRef(false);

  const trayTiles = tiles.filter((tile) => zoneByTile[tile.id] === undefined);
  const inZone = (zone: Zone) => tiles.filter((tile) => zoneByTile[tile.id] === zone);
  const xZone = inZone('x');
  const constZone = inZone('const');

  const xCount = xZone.filter((tile) => tile.kind === 'x').length;
  const constantsKept = constZone.filter((tile) => tile.kind === 'const').length;
  const misplaced =
    xZone.filter((tile) => tile.kind === 'const').length +
    constZone.filter((tile) => tile.kind === 'x').length;
  const placedCount = Object.keys(zoneByTile).length;

  // Per-box chips show the coefficient; a single x reads as "x", not "1x".
  const xTerm = xCount === 0 ? '' : xCount === 1 ? tileLabel : `${xCount}${tileLabel}`;
  const constTerm = constantsKept > 0 && constantLabel ? constantLabel : '';
  // The combined readout always shows both parts with a 0 placeholder, so it
  // builds up as you sort: "x + 0", then "3x + 0", then "3x + 3".
  const xReadout = xCount === 0 ? '0' : xTerm;
  const constReadout = constTerm || '0';
  const expression =
    placedCount === 0
      ? '?'
      : constantLabel
        ? `${xReadout} + ${constReadout}`
        : xReadout;

  const showFeedback = feedback;

  const placeTile = (tileId: number, zone: Zone) => {
    if (submitted) {
      return;
    }
    setZoneByTile((prev) => ({ ...prev, [tileId]: zone }));
    setSelectedTileId(null);
    setDraggingTileId(null);
  };

  const returnTile = (tileId: number) => {
    if (submitted) {
      return;
    }
    setZoneByTile((prev) => {
      const next = { ...prev };
      delete next[tileId];
      return next;
    });
  };

  const handleReset = () => {
    if (submitted) {
      return;
    }
    setZoneByTile({});
    setSelectedTileId(null);
    setDraggingTileId(null);
  };

  // Keep the learner's tile placement on a retry so they can adjust what they have
  // instead of starting over. The explicit Reset button still clears all.
  const handleTryAgain = () => {
    setSelectedTileId(null);
    setDraggingTileId(null);
    submittingRef.current = false;
    onTryAgain();
  };

  const handleCheck = () => {
    if (submittingRef.current || submitted || placedCount === 0) {
      return;
    }
    submittingRef.current = true;
    onSubmit({ xCombined: xCount, constantsKept, misplaced });
  };

  const zoneActive = draggingTileId !== null || selectedTileId !== null;

  return (
    <div>
      <p className="text-lg leading-relaxed text-slate-800">{renderPrompt(step.prompt)}</p>

      <div className="mt-6 space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-600">Tiles</p>
          <div className="mt-3 flex min-h-20 flex-wrap gap-3">
            {trayTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                draggable={!submitted}
                disabled={submitted}
                className={`${chipClasses(tile.kind, selectedTileId === tile.id)} cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation`}
                onClick={() => setSelectedTileId((id) => (id === tile.id ? null : tile.id))}
                onDragStart={() => setDraggingTileId(tile.id)}
                onDragEnd={() => setDraggingTileId(null)}
              >
                {tile.label}
              </button>
            ))}
            {trayTiles.length === 0 && <p className="text-sm text-muted">Every tile is sorted.</p>}
          </div>
        </section>

        <div className="space-y-1">
          <DropZone
            label={`Combine the ${tileLabel} terms`}
            active={zoneActive}
            disabled={submitted}
            onPlace={() => {
              if (selectedTileId !== null) placeTile(selectedTileId, 'x');
            }}
            onDropTile={() => {
              if (draggingTileId !== null) placeTile(draggingTileId, 'x');
            }}
            readout={xTerm || null}
          >
            {xZone.length > 0 ? (
              xZone.map((tile) => (
                <PlacedChip
                  key={tile.id}
                  tile={tile}
                  disabled={submitted}
                  onRemove={() => returnTile(tile.id)}
                  onDragStart={() => setDraggingTileId(tile.id)}
                  onDragEnd={() => setDraggingTileId(null)}
                />
              ))
            ) : (
              <p className="text-sm text-muted">Drop the {tileLabel} tiles here to combine them.</p>
            )}
          </DropZone>

          {constantLabel && (
            <>
              <div aria-hidden="true" className="flex justify-center py-1">
                <span className="font-display text-3xl font-bold leading-none text-ink">+</span>
              </div>
              <DropZone
                label="Keep the number on its own"
                active={zoneActive}
                disabled={submitted}
                onPlace={() => {
                  if (selectedTileId !== null) placeTile(selectedTileId, 'const');
                }}
                onDropTile={() => {
                  if (draggingTileId !== null) placeTile(draggingTileId, 'const');
                }}
                readout={constTerm || null}
              >
                {constZone.length > 0 ? (
                  constZone.map((tile) => (
                    <PlacedChip
                      key={tile.id}
                      tile={tile}
                      disabled={submitted}
                      onRemove={() => returnTile(tile.id)}
                      onDragStart={() => setDraggingTileId(tile.id)}
                      onDragEnd={() => setDraggingTileId(null)}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted">Drop the plain number here.</p>
                )}
              </DropZone>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Simplified</p>
        <p className="nums mt-1 text-2xl font-semibold text-slate-900">{expression}</p>
      </div>

      {showFeedback && (
        <FeedbackBanner variant={feedback!.ok ? 'correct' : 'incorrect'} message={feedback!.message} />
      )}

      <StepActions
        submitted={submitted}
        feedbackOk={Boolean(feedback?.ok)}
        allowRetry={allowRetry}
        checkDisabled={placedCount === 0}
        onCheck={handleCheck}
        onContinue={onContinue}
        onTryAgain={handleTryAgain}
        onBack={onBack}
        canGoBack={canGoBack}
        hint={hint}
      >
        {!submitted && placedCount > 0 ? (
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={handleReset}>
            Reset
          </Button>
        ) : null}
      </StepActions>
    </div>
  );
}

function DropZone({
  label,
  active,
  disabled,
  onPlace,
  onDropTile,
  readout,
  children,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPlace: () => void;
  onDropTile: () => void;
  readout: string | null;
  children: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={label}
      className={`w-full rounded-2xl border-2 border-dashed p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        active ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50'
      } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
      onClick={onPlace}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPlace();
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropTile();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        {readout && (
          <span className="nums rounded-lg bg-white px-3 py-1 text-base font-semibold text-slate-900">
            = {readout}
          </span>
        )}
      </div>
      <div className="mt-3 flex min-h-16 flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function PlacedChip({
  tile,
  disabled,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  tile: TileDef;
  disabled: boolean;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      title="Remove tile"
      aria-label={`Remove ${tile.label} tile`}
      className={`group/chip relative ${chipClasses(tile.kind, false)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        disabled ? 'cursor-default' : 'cursor-pointer'
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
      onDragStart={(event) => {
        event.stopPropagation();
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      {tile.label}
      <span
        aria-hidden="true"
        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[11px] leading-none text-white opacity-0 transition group-hover/chip:opacity-100"
      >
        &times;
      </span>
    </button>
  );
}
