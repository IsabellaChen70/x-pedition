'use strict';

// Pure, dependency-free helpers shared by the callable functions in index.js.
// They live here (separate from the firebase-functions runtime imports) so they
// can be unit-tested without loading the Cloud Functions environment.

// Mirrors src/lib/ai/problemParse.ts CONCEPT_RULES (kept in sync by hand; this is
// the server copy since Cloud Functions cannot import from the web src tree).
const CONCEPT_RULES = {
  balance:
    'Balance-scale problems with shapes and pounds. NEVER use the letter x or any variable. Ask how much one shape weighs. checkKind must be "value".',
  introX:
    'Gentle first problems with x: either "x + n = total" or "two x blocks balance total". checkKind "solves".',
  solve: 'One-step equations in x: x + a = b, x - a = b, or n*x = b. checkKind "solves".',
  combine:
    'Combine like terms (simplify like "2x + 3 + x", checkKind "equivalent") OR a two-step "a*x + b*x + c = total" (checkKind "solves").',
  expression:
    'Translate a short phrase into an expression like "3x + 2" or "x - 5". Use ONLY addition/subtraction and a whole-number coefficient on x; NO division, fractions, parentheses, or x in a denominator. checkKind "equivalent" with the correct expression.',
};

function buildGenerationPrompt(concepts, difficulty) {
  const rules = concepts.map((c) => `- ${c}: ${CONCEPT_RULES[c] || ''}`).join('\n');
  return [
    'Generate ONE multiple-choice algebra practice problem for a 7th grader.',
    'Pick exactly one of these concepts and follow its rule strictly:',
    rules,
    `Difficulty: ${difficulty} of 5 (1 = easiest, 5 = hardest). Scale the numbers to match.`,
    'Requirements:',
    '- Exactly 4 options; exactly one correct (set correctIndex 0-3).',
    '- The 3 wrong options must be plausible MISCONCEPTIONS (used the total, forgot to divide, sign slip), not random.',
    '- Option formatting by checkKind:',
    '  - solves: every option is JUST the numeric value of the variable, like "5" or "-3". Do NOT write "x = 5" or any letter.',
    '  - value: every option is a number, optionally with a unit, like "4" or "4 lb".',
    '  - equivalent: every option is an algebra expression, like "3x" or "x + 3".',
    '- 1-3 short worked "steps" that lead to the answer.',
    '- "feedbackCorrect": one upbeat line. "feedbackIncorrect": 1-2 hints that do NOT give away the answer.',
    '- Fill the machine check (checkKind plus equation/expression/variable/value) so the marked-correct option exactly satisfies it. For solves give the full equation like "2x + 3 = 11"; for equivalent give the correct expression; for value give the numeric answer.',
    '- Use the balance idea and undoing operations; never vague jargon like "cancel" or "get rid of". No emojis, no em dashes.',
  ].join('\n');
}

/**
 * Parse a JSON string, returning null instead of throwing on empty or malformed
 * input. This is the JSON-parse fallback the callables rely on: a non-JSON model
 * reply (or none at all) becomes null, and the caller returns its neutral
 * fallback rather than erroring the request.
 */
function safeJsonParse(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

module.exports = { CONCEPT_RULES, buildGenerationPrompt, safeJsonParse };
