import { describe, expect, it } from 'vitest';
import {
  addMistakeToLog,
  lessonMistakeId,
  MISTAKE_LOG_CAP,
  normalizeMistakeLog,
  practiceMistakeId,
  removeMistakeFromLog,
} from './mistakes';
import type { MistakeLogEntry } from './mistakes';

function entry(overrides: Partial<MistakeLogEntry> = {}): MistakeLogEntry {
  return {
    id: 'l:lesson-01:s1',
    concept: 'balance',
    misconceptionId: 'one-side-only',
    prompt: 'Find the weight.',
    wrongAnswer: '5 lb',
    correctAnswer: '6 lb',
    lessonId: 'lesson-01',
    source: 'lesson',
    at: 1000,
    ...overrides,
  };
}

describe('mistake ids', () => {
  it('builds a stable per-step id for lesson misses', () => {
    expect(lessonMistakeId('lesson-03', 's2')).toBe('l:lesson-03:s2');
  });

  it('builds one rolling id per concept for practice misses', () => {
    expect(practiceMistakeId('solve')).toBe('p:solve');
  });
});

describe('addMistakeToLog', () => {
  it('prepends the newest miss', () => {
    const log = [entry({ id: 'a', at: 1 })];
    const next = addMistakeToLog(log, entry({ id: 'b', at: 2 }));
    expect(next.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('updates a re-missed problem in place instead of duplicating it', () => {
    const log = [entry({ id: 'l:lesson-01:s1', wrongAnswer: '5 lb', at: 1 })];
    const next = addMistakeToLog(log, entry({ id: 'l:lesson-01:s1', wrongAnswer: '4 lb', at: 2 }));
    expect(next).toHaveLength(1);
    expect(next[0].wrongAnswer).toBe('4 lb');
    expect(next[0].at).toBe(2);
  });

  it('caps to the most recent entries', () => {
    let log: MistakeLogEntry[] = [];
    for (let i = 0; i < MISTAKE_LOG_CAP + 5; i++) {
      log = addMistakeToLog(log, entry({ id: `id-${i}`, at: i }));
    }
    expect(log).toHaveLength(MISTAKE_LOG_CAP);
    // The oldest ones fell off; the newest survive.
    expect(log[0].id).toBe(`id-${MISTAKE_LOG_CAP + 4}`);
    expect(log.some((e) => e.id === 'id-0')).toBe(false);
  });

  it('respects a custom cap', () => {
    const log = addMistakeToLog(
      addMistakeToLog([], entry({ id: 'a', at: 1 }), 1),
      entry({ id: 'b', at: 2 }),
      1,
    );
    expect(log.map((e) => e.id)).toEqual(['b']);
  });
});

describe('removeMistakeFromLog', () => {
  it('removes the cleared entry and leaves the rest', () => {
    const log = [entry({ id: 'a' }), entry({ id: 'b' })];
    expect(removeMistakeFromLog(log, 'a').map((e) => e.id)).toEqual(['b']);
  });

  it('is a no-op when the id is absent', () => {
    const log = [entry({ id: 'a' })];
    expect(removeMistakeFromLog(log, 'missing')).toEqual(log);
  });
});

describe('normalizeMistakeLog', () => {
  it('reads a legacy/missing log as empty', () => {
    expect(normalizeMistakeLog(undefined)).toEqual([]);
    expect(normalizeMistakeLog(null)).toEqual([]);
    expect(normalizeMistakeLog('nope')).toEqual([]);
  });

  it('drops entries without a valid concept or id', () => {
    const result = normalizeMistakeLog([
      entry({ id: 'ok', concept: 'solve' }),
      { id: 'bad-concept', concept: 'not-real' },
      { concept: 'solve' }, // missing id
    ]);
    expect(result.map((e) => e.id)).toEqual(['ok']);
  });

  it('fills safe defaults for missing optional fields', () => {
    const [row] = normalizeMistakeLog([{ id: 'x', concept: 'introX' }]);
    expect(row.misconceptionId).toBeNull();
    expect(row.prompt).toBe('');
    expect(row.source).toBe('lesson');
    expect(row.at).toBe(0);
  });

  it('returns entries newest first and capped', () => {
    const result = normalizeMistakeLog(
      [entry({ id: 'old', at: 1 }), entry({ id: 'new', at: 9 })],
      1,
    );
    expect(result.map((e) => e.id)).toEqual(['new']);
  });
});
