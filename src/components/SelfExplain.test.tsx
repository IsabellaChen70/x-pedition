// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// AI off (the production default on Spark): no direct OpenAI key, and the callable
// judge is unreachable and returns null. Mock the progress write so the component
// never pulls in Firestore.
vi.mock('../lib/ai/config', () => ({ hasOpenAiKey: () => false }));
vi.mock('../lib/ai/judgeViaFunction', () => ({
  judgeExplanationViaFunction: vi.fn().mockResolvedValue(null),
  respondToFollowUpViaFunction: vi.fn().mockResolvedValue(null),
}));
vi.mock('../lib/progress', () => ({
  recordReflection: vi.fn().mockResolvedValue(undefined),
}));

import SelfExplain from './SelfExplain';
import { recordReflection } from '../lib/progress';
import type { Step } from '../types/lesson';

afterEach(cleanup);

const step = {
  id: 'm1',
  type: 'mc',
  prompt: 'Why does x = 4 solve x + 3 = 7?',
  options: [],
  correctIndex: 0,
  feedback: { correct: 'Subtract 3 from both sides.', incorrect: [] },
  followUp: {
    prompt: 'What if it were x + 5 = 7?',
    answer: '2',
    why: 'Subtract 5 from both sides to get x by itself.',
  },
} as unknown as Step;

describe('SelfExplain with AI off', () => {
  it('shows the authored follow-up after a genuine explanation, without the judge', async () => {
    render(<SelfExplain step={step} userId="u1" courseId="c1" onDone={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('I knew it because...'), {
      target: { value: 'You take three off both sides so it stays balanced and x is alone.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    // The authored "what if" appears even though the judge returned nothing. Use a
    // generous timeout so a cold first run (fresh transforms after npm ci in CI)
    // doesn't flake on the default 1s.
    await waitFor(
      () => expect(screen.getByText('What if it were x + 5 = 7?')).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(recordReflection).toHaveBeenCalled();
  });
});
