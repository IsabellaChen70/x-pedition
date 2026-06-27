import type { GeneratedProblem, ProblemCheck } from './types';

/**
 * The flat JSON shape an LLM returns for a generated problem (structured output).
 * Kept provider-agnostic so the OpenAI and Gemini paths share one parser/validator.
 */
export type RawProblem = {
  concept: GeneratedProblem['concept'];
  prompt: string;
  options: string[];
  correctIndex: number;
  feedbackCorrect: string;
  feedbackIncorrect: string[];
  steps: string[];
  checkKind: 'solves' | 'equivalent' | 'value';
  equation?: string;
  expression?: string;
  variable?: string;
  value?: number;
};

function toCheck(raw: RawProblem): ProblemCheck | null {
  if (raw.checkKind === 'solves' && raw.equation) {
    return { kind: 'solves', equation: raw.equation, variable: raw.variable || 'x' };
  }
  if (raw.checkKind === 'equivalent' && raw.expression) {
    return { kind: 'equivalent', expression: raw.expression, variable: raw.variable || 'x' };
  }
  if (raw.checkKind === 'value' && typeof raw.value === 'number') {
    return { kind: 'value', value: raw.value };
  }
  return null;
}

/**
 * Validate + normalize a raw LLM problem into a GeneratedProblem, or null if it's
 * malformed. Pure (no engine check here): the caller still runs verifyProblem and
 * the curriculum guard, so a parsed problem is structurally sound but not yet
 * trusted to be mathematically correct.
 */
export function parseGeneratedProblem(raw: unknown, idPrefix = 'ai'): GeneratedProblem | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const r = raw as Partial<RawProblem>;
  if (
    typeof r.prompt !== 'string' ||
    !r.prompt.trim() ||
    !Array.isArray(r.options) ||
    r.options.length < 3 ||
    r.options.length > 5 ||
    !r.options.every((option) => typeof option === 'string' && option.trim()) ||
    new Set(r.options).size !== r.options.length ||
    typeof r.correctIndex !== 'number' ||
    r.correctIndex < 0 ||
    r.correctIndex >= r.options.length ||
    typeof r.checkKind !== 'string'
  ) {
    return null;
  }
  const check = toCheck(r as RawProblem);
  if (!check) {
    return null;
  }
  return {
    id: `${idPrefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    concept: r.concept as GeneratedProblem['concept'],
    prompt: r.prompt,
    options: r.options,
    correctIndex: r.correctIndex,
    feedback: {
      correct: typeof r.feedbackCorrect === 'string' && r.feedbackCorrect.trim() ? r.feedbackCorrect : 'Correct!',
      incorrect:
        Array.isArray(r.feedbackIncorrect) && r.feedbackIncorrect.length > 0
          ? r.feedbackIncorrect.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
          : ['Not quite. Give it another try.'],
    },
    steps: Array.isArray(r.steps) && r.steps.length > 0 ? r.steps.filter((s): s is string => typeof s === 'string') : undefined,
    check,
  };
}

/** The instructions both providers use, so dev (OpenAI) and prod (Gemini/function) agree. */
export const CONCEPT_RULES: Record<GeneratedProblem['concept'], string> = {
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

/**
 * Strict JSON schema for OpenAI structured outputs, so the model returns EXACTLY
 * these keys (json_object mode alone lets it rename/drop fields). Strict mode
 * requires every property listed in `required`, so the conditional check fields
 * (equation/expression/variable/value) are nullable and the parser ignores nulls.
 */
export const PROBLEM_JSON_SCHEMA = {
  name: 'practice_problem',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'concept',
      'prompt',
      'options',
      'correctIndex',
      'feedbackCorrect',
      'feedbackIncorrect',
      'steps',
      'checkKind',
      'equation',
      'expression',
      'variable',
      'value',
    ],
    properties: {
      concept: { type: 'string', enum: ['balance', 'introX', 'solve', 'combine', 'expression'] },
      prompt: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } },
      correctIndex: { type: 'integer' },
      feedbackCorrect: { type: 'string' },
      feedbackIncorrect: { type: 'array', items: { type: 'string' } },
      steps: { type: 'array', items: { type: 'string' } },
      checkKind: { type: 'string', enum: ['solves', 'equivalent', 'value'] },
      equation: { type: ['string', 'null'] },
      expression: { type: ['string', 'null'] },
      variable: { type: ['string', 'null'] },
      value: { type: ['number', 'null'] },
    },
  },
} as const;

/** The shared problem-generation user prompt for a pool of concepts at a difficulty. */
export function buildGenerationPrompt(concepts: GeneratedProblem['concept'][], difficulty: number): string {
  const rules = concepts.map((concept) => `- ${concept}: ${CONCEPT_RULES[concept]}`).join('\n');
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
