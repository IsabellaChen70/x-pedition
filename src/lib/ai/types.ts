/**
 * The kinds of practice problems the generator can produce, one family per
 * lesson skill, so a dig only ever uses notation the learner has been taught:
 * - balance:    lesson 1, find a weight on a balance scale (no "x")
 * - introX:     lesson 2, meet x (lone x, x + n, two x blocks)
 * - solve:      lesson 3, one-step equations (x + a, x - a, nx)
 * - combine:    lesson 4, combine like terms / two-step
 * - expression: lesson 5, translate words into an expression
 */
export type ConceptId = 'balance' | 'introX' | 'solve' | 'combine' | 'expression';

/**
 * How a generated problem is checked against the math itself, never the model's
 * word.
 * - solves:     each option is a number; exactly one must solve the equation.
 * - equivalent: each option is an expression; exactly one must equal `expression`.
 * - value:      each option is a number (maybe with a unit like "lb"); exactly
 *               one must equal `value` (used for balance word problems).
 */
export type ProblemCheck =
  | { kind: 'solves'; equation: string; variable: string }
  | { kind: 'equivalent'; expression: string; variable: string }
  | {
      kind: 'value';
      value: number;
      /** Equal-share model for balance word problems (value = (total − extra) ÷
       * count), so a wrong choice can be explained against the real scenario. */
      total?: number;
      count?: number;
      extra?: number;
    };

/**
 * A Phase 2 AI-generated practice problem. A flat, structured object (not raw
 * text) so it can be emitted via structured output and verified with an engine
 * (math.js) before a learner ever sees it. Rendered as multiple choice.
 */
export type GeneratedProblem = {
  id: string;
  concept: ConceptId;
  /** Learner-facing prompt, including the scenario/equation/phrase to act on. */
  prompt: string;
  /** 3-5 answer choices. */
  options: string[];
  correctIndex: number;
  feedback: {
    correct: string;
    incorrect: string[];
  };
  /** Optional worked-solution steps, a faded worked example shown on demand. */
  steps?: string[];
  /** The engine-checkable source of truth used to verify the options. */
  check: ProblemCheck;
};

/**
 * Identifiers for the misconceptions the deterministic detector can recognize
 * from a learner's wrong answer, mapped to this app's actual interactions
 * (balance, tiles, equal-share, expression-builder).
 */
export type MisconceptionId =
  | 'one-side-only' // changed only one side of the balance
  | 'wrong-operation' // used the wrong inverse / op
  | 'combined-unlike-terms' // added x-terms and plain numbers together
  | 'miscount' // counted the tiles/items wrong
  | 'uneven-share' // didn't split equally
  | 'wrong-coefficient' // wrong number in front of x
  | 'missing-constant' // dropped the + / - constant
  | 'arithmetic-slip'; // right method, small arithmetic error

/**
 * A library entry describing one misconception: how to talk about it, plus a
 * deterministic, answer-safe hint escalation (index 0 = Hint 1 ... up to Hint 3).
 */
export type Misconception = {
  id: MisconceptionId;
  name: string;
  description: string;
  /** Short, answer-safe explanation written for a 7th grader. */
  explanation: string;
  /** Deterministic hint escalation; never reveals the answer. */
  hintProgression: string[];
};
