// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TileCombineQuestion from './TileCombineQuestion';
import type { TileCombineStep } from '../types/lesson';

afterEach(cleanup);

const step: TileCombineStep = {
  id: 's1',
  type: 'tile_combine',
  prompt: 'Combine the like terms.',
  visual: { type: 'none' },
  validation: { totalTiles: 3, targetCount: 3, targetLabel: '3x', tileLabel: 'x' },
  feedback: { correct: 'Nice.', incorrect: ['Look again.'] },
};

function renderStep(onSubmit = vi.fn()) {
  render(
    <TileCombineQuestion
      step={step}
      submitted={false}
      feedback={null}
      allowRetry
      onSubmit={onSubmit}
      onContinue={vi.fn()}
      onTryAgain={vi.fn()}
    />,
  );
  return onSubmit;
}

describe('TileCombineQuestion', () => {
  it('marks a tapped tray tile as pressed (aria-pressed)', () => {
    renderStep();
    const tile = screen.getAllByRole('button', { name: 'Select x tile' })[0];
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(tile);
    expect(tile).toHaveAttribute('aria-pressed', 'true');
  });

  it('tapping tiles into the combine box builds the readout and submits the grouping', () => {
    const onSubmit = renderStep();
    // Tap each remaining tray tile, then tap the combine drop zone to place it.
    for (let placed = 0; placed < 3; placed += 1) {
      fireEvent.click(screen.getAllByRole('button', { name: 'Select x tile' })[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Combine the x terms' }));
    }
    // The "Simplified" readout reflects the three combined x tiles.
    expect(screen.getByText('3x')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onSubmit).toHaveBeenCalledWith({ xCombined: 3, constantsKept: 0, misplaced: 0 });
  });
});
