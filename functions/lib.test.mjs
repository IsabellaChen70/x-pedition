import { describe, expect, it } from 'vitest';
import lib from './lib.js';

const { CONCEPT_RULES, buildGenerationPrompt, safeJsonParse } = lib;

describe('buildGenerationPrompt', () => {
  it('includes the rule text for each requested concept', () => {
    const prompt = buildGenerationPrompt(['solve', 'combine'], 3);
    expect(prompt).toContain('- solve:');
    expect(prompt).toContain(CONCEPT_RULES.solve);
    expect(prompt).toContain('- combine:');
    expect(prompt).toContain(CONCEPT_RULES.combine);
  });

  it('states the difficulty and the single-correct-option contract', () => {
    const prompt = buildGenerationPrompt(['balance'], 4);
    expect(prompt).toContain('Difficulty: 4 of 5');
    expect(prompt).toContain('Exactly 4 options');
    expect(prompt).toContain('exactly one correct');
  });

  it('tolerates an unknown concept without inserting "undefined"', () => {
    const prompt = buildGenerationPrompt(['mystery'], 2);
    expect(prompt).toContain('- mystery:');
    expect(prompt).not.toContain('undefined');
  });
});

describe('safeJsonParse (JSON-parse fallback)', () => {
  it('parses a well-formed JSON object', () => {
    expect(safeJsonParse('{"acceptable":true,"feedback":"Nice work"}')).toEqual({
      acceptable: true,
      feedback: 'Nice work',
    });
  });

  it('returns null instead of throwing on empty, null, or malformed input', () => {
    expect(safeJsonParse('')).toBeNull();
    expect(safeJsonParse(null)).toBeNull();
    expect(safeJsonParse(undefined)).toBeNull();
    expect(safeJsonParse('not json at all')).toBeNull();
    expect(safeJsonParse('{ "oops": ')).toBeNull();
  });
});
