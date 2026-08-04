// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import StepActions from './StepActions';

afterEach(cleanup);

const baseProps = {
  submitted: false,
  feedbackOk: false,
  allowRetry: true,
  onCheck: vi.fn(),
  onContinue: vi.fn(),
  onTryAgain: vi.fn(),
};

describe('StepActions', () => {
  it('disables Check when nothing is chosen and runs the handler once enabled', () => {
    const onCheck = vi.fn();
    const { rerender } = render(<StepActions {...baseProps} onCheck={onCheck} checkDisabled />);
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();

    rerender(<StepActions {...baseProps} onCheck={onCheck} checkDisabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('shows Continue (not Check) after a correct answer', () => {
    render(<StepActions {...baseProps} submitted feedbackOk />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument();
  });

  it('reveals escalating hints one level at a time', () => {
    render(<StepActions {...baseProps} hint={{ levels: ['First nudge', 'Second nudge'] }} />);
    expect(screen.queryByText('First nudge')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /get hint/i }));
    expect(screen.getByText('First nudge')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /another hint/i }));
    expect(screen.getByText('Second nudge')).toBeInTheDocument();
  });
});
