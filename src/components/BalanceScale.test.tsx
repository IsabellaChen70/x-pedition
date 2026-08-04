// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BalanceScale from './BalanceScale';

afterEach(cleanup);

describe('BalanceScale', () => {
  it('describes both pans in the accessible label', () => {
    render(
      <BalanceScale
        config={{
          left: [{ kind: 'unknown', label: 'x' }, { kind: 'weight', value: 2 }],
          right: [{ kind: 'weight', value: 5 }],
        }}
      />,
    );
    const label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('x + 2 lb');
    expect(label).toContain('5 lb');
  });
});
