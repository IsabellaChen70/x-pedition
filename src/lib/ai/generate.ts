import type { McStep } from '../../types/lesson';
import { hasOpenAiKey, isAiGenerationEnabled } from './config';
import type { ConceptId, GeneratedProblem } from './types';
import { isEquivalent, verifyProblem } from './verify';

// How long to wait for an AI-generated problem before falling back to the instant
// local generator, so a slow model never leaves the learner staring at a spinner.
const AI_GENERATION_TIMEOUT_MS = 7000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Try to get an AI-generated problem: the OpenAI key directly in local dev, else
 * the auth-gated Cloud Function in a build. Returns null on any failure (the
 * caller falls back to the verified local generator).
 */
async function aiGenerateProblem(
  concept: ConceptId,
  difficulty: Difficulty,
): Promise<GeneratedProblem | null> {
  try {
    if (hasOpenAiKey()) {
      const { generateProblemWithOpenAI } = await import('./openai');
      return await generateProblemWithOpenAI([concept], difficulty);
    }
    const { generateProblemViaFunction } = await import('./generateViaFunction');
    return await generateProblemViaFunction({ concepts: [concept], difficulty });
  } catch {
    return null;
  }
}

/** 1 = easiest, 5 = hardest. Scales numbers and forms within a concept. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const MIN_DIFFICULTY: Difficulty = 1;
export const MAX_DIFFICULTY: Difficulty = 5;
// Ordered by when each skill is taught, so a lesson's pool reads naturally.
export const CONCEPTS: ConceptId[] = ['balance', 'introX', 'solve', 'combine', 'expression'];

export function clampDifficulty(value: number): Difficulty {
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, Math.round(value))) as Difficulty;
}

/**
 * Placement: pick a starting difficulty from how well the learner did on the
 * lesson's mastery check. Acing it starts a notch higher (skip the trivial);
 * struggling starts gentler. Mitigates the cold start so the first problems fit
 * ability. `null` (no mastery data) falls back to a gentle default.
 */
export function masteryStartDifficulty(fraction: number | null): Difficulty {
  if (fraction === null) return 2;
  if (fraction >= 0.9) return 3;
  if (fraction >= 0.6) return 2;
  return 1;
}

// A clean first-try win only counts toward leveling UP if it came reasonably
// quickly. A slow, hesitant correct answer means the learner is near their edge,
// so the dig holds the level (keeping success near the ~85% sweet spot) instead
// of pushing harder. Pure + tested; the dig passes in the elapsed response time.
export const CONFIDENT_WIN_MS = 20000;
export function isConfidentWin(responseMs: number): boolean {
  return responseMs >= 0 && responseMs <= CONFIDENT_WIN_MS;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `gen-${Date.now().toString(36)}-${idCounter}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function coin(): boolean {
  return Math.random() < 0.5;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Three distinct non-negative wrong numbers near `value` (plus salient extras). */
function numericDistractors(value: number, extras: number[] = []): number[] {
  const out: number[] = [];
  for (const candidate of [...extras, value + 1, value - 1, value + 2, value + 3, value - 2, value + 4]) {
    if (candidate >= 0 && candidate !== value && !out.includes(candidate)) {
      out.push(candidate);
    }
    if (out.length === 3) break;
  }
  return out;
}

function term(coeff: number, variable = 'x'): string {
  if (coeff === 1) return variable;
  if (coeff === -1) return `-${variable}`;
  return `${coeff}${variable}`;
}

function linear(coeff: number, constant: number, variable = 'x'): string {
  if (coeff === 0) return `${constant}`;
  const t = term(coeff, variable);
  if (constant === 0) return t;
  return constant > 0 ? `${t} + ${constant}` : `${t} - ${Math.abs(constant)}`;
}

// --- shared assembly --------------------------------------------------------

/** A numeric-answer problem (options are plain numbers), checked by solving. */
function solveProblem(
  concept: ConceptId,
  prompt: string,
  equation: string,
  solution: number,
  feedback: { correct: string; incorrect: string[] },
  extras: number[] = [],
  steps?: string[],
): GeneratedProblem {
  const rhs = Number(equation.split('=')[1]);
  const values = shuffle([solution, ...numericDistractors(solution, [rhs, ...extras])]);
  const options = values.map((value) => String(value));
  return {
    id: nextId(),
    concept,
    prompt,
    options,
    correctIndex: values.indexOf(solution),
    feedback,
    steps,
    check: { kind: 'solves', equation, variable: 'x' },
  };
}

/** A weight problem (options are "N lb"), checked by recomputed value. */
function valueProblem(
  concept: ConceptId,
  prompt: string,
  value: number,
  extras: number[],
  feedback: { correct: string; incorrect: string[] },
  steps?: string[],
  model?: { total: number; count: number; extra?: number },
): GeneratedProblem {
  const values = shuffle([value, ...numericDistractors(value, extras)]);
  const options = values.map((v) => `${v} lb`);
  return {
    id: nextId(),
    concept,
    prompt,
    options,
    correctIndex: values.indexOf(value),
    feedback,
    steps,
    check: model
      ? { kind: 'value', value, total: model.total, count: model.count, extra: model.extra ?? 0 }
      : { kind: 'value', value },
  };
}

/** An expression problem, checked by equivalence; keeps only non-equal distractors. */
function equivalentProblem(
  concept: ConceptId,
  prompt: string,
  source: string,
  canonical: string,
  candidateDistractors: string[],
  feedback: { correct: string; incorrect: string[] },
  steps?: string[],
): GeneratedProblem {
  const distractors: string[] = [];
  for (const candidate of candidateDistractors) {
    if (candidate === canonical || distractors.includes(candidate)) continue;
    if (isEquivalent(candidate, source, 'x')) continue;
    distractors.push(candidate);
    if (distractors.length === 3) break;
  }
  const values = shuffle([canonical, ...distractors]);
  return {
    id: nextId(),
    concept,
    prompt,
    options: values,
    correctIndex: values.indexOf(canonical),
    feedback,
    steps,
    check: { kind: 'equivalent', expression: source, variable: 'x' },
  };
}

// --- balance (lesson 1): no x, balance-scale weights -----------------------

const SHAPES = ['circle', 'triangle', 'square', 'box'];

function plural(shape: string): string {
  return shape === 'box' ? 'boxes' : `${shape}s`;
}

function buildBalance(difficulty: Difficulty): GeneratedProblem {
  const big = difficulty >= 3;
  const shape = pick(SHAPES);
  const perShape = randomInt(2, big ? 9 : 6);
  const feedback = {
    correct: 'Right, share the weight equally (after taking off any extra).',
    incorrect: [
      'Not quite. Take any extra weight off both sides first, then split the rest equally.',
      'How much does ONE shape weigh? Divide the shapes\u2019 weight by how many there are.',
    ],
  };

  if (coin()) {
    const count = randomInt(2, big ? 5 : 3);
    const total = count * perShape;
    return valueProblem(
      'balance',
      `${count} identical ${plural(shape)} balance ${total} pounds. How much does one ${shape} weigh?`,
      perShape,
      [total, total - count],
      feedback,
      [`Share the weight equally: ${total} ÷ ${count} = ${perShape} lb.`],
      { total, count, extra: 0 },
    );
  }

  const count = randomInt(1, big ? 3 : 2);
  const extra = randomInt(1, 9);
  const total = count * perShape + extra;
  const prompt =
    count === 1
      ? `A mystery block plus a ${extra}-pound weight balances ${total} pounds. How much does the block weigh?`
      : `${count} identical ${plural(shape)} plus a ${extra}-pound weight balance ${total} pounds. How much does one ${shape} weigh?`;
  const steps =
    count === 1
      ? [`Take the ${extra} lb off both sides: ${total} − ${extra} = ${perShape} lb.`]
      : [
          `Take the ${extra} lb off both sides: ${total} − ${extra} = ${total - extra}.`,
          `Share equally: ${total - extra} ÷ ${count} = ${perShape} lb.`,
        ];
  // Misconception distractors: used the total, grabbed the known weight, or
  // (for the block) added instead of subtracting.
  const wrongs = count === 1 ? [total, extra, total + extra] : [total, total - extra, extra];
  return valueProblem('balance', prompt, perShape, wrongs, feedback, steps, { total, count, extra });
}

// --- introX (lesson 2): meet x ---------------------------------------------

function buildIntroX(difficulty: Difficulty): GeneratedProblem {
  const cap = difficulty >= 3 ? 12 : 8;
  const x = randomInt(2, cap);

  if (coin()) {
    const n = randomInt(1, 9);
    return solveProblem('introX', `x + ${n} = ${x + n}. What is x?`, `x + ${n} = ${x + n}`, x, {
      correct: `Yes, x = ${x}.`,
      incorrect: [`Take ${n} off both sides to get x by itself.`],
    }, [n]);
  }
  return solveProblem('introX', `Two x blocks balance ${2 * x} pounds. What is one x?`, `2x = ${2 * x}`, x, {
    correct: `Right, one x is ${x}.`,
    incorrect: ['Two equal x blocks split the total evenly. Halve it.'],
  });
}

// --- solve (lesson 3): one-step equations ----------------------------------

function buildSolve(difficulty: Difficulty): GeneratedProblem {
  const x = randomInt(1, difficulty >= 3 ? 12 : 9);
  const feedback = {
    correct: `Correct, x = ${x}.`,
    incorrect: [
      'Not quite. Undo the operation on x, the same move on both sides.',
      'Work backward to get x by itself.',
    ],
  };
  const form = randomInt(0, 2);
  if (form === 0) {
    // Distractor `a` = grabbed the number; rhs (auto) = answered the total.
    const a = randomInt(1, difficulty >= 3 ? 15 : 9);
    return solveProblem('solve', `x + ${a} = ${x + a}. x equals...`, `x + ${a} = ${x + a}`, x, feedback, [a]);
  }
  if (form === 1) {
    const a = randomInt(1, x);
    return solveProblem('solve', `x - ${a} = ${x - a}. x equals...`, `x - ${a} = ${x - a}`, x, feedback, [a]);
  }
  // Distractor `n` (the coefficient) and rhs (the product) model divide slips.
  const n = randomInt(2, 5);
  return solveProblem('solve', `${n}x = ${n * x}. x equals...`, `${n}x = ${n * x}`, x, feedback, [n]);
}

// --- combine (lesson 4): combine like terms / two-step ---------------------

function buildCombineSimplify(difficulty: Difficulty): GeneratedProblem {
  const big = difficulty >= 4;
  const a = randomInt(1, big ? 5 : 3);
  const c = randomInt(1, big ? 5 : 3);
  const b = randomInt(1, 9);
  const coeff = a + c;

  const source = `${term(a)} + ${b} + ${term(c)}`;
  const canonical = linear(coeff, b);
  const candidates = [
    linear(coeff, 0),
    `${coeff + b}x`,
    linear(a * c, b),
    linear(coeff + 1, b),
    linear(coeff, b + 1),
    linear(coeff - 1, b),
  ];
  return equivalentProblem(
    'combine',
    `Simplify:  ${source}`,
    source,
    canonical,
    candidates,
    {
      correct: 'Nice, combine like terms: x-terms together, numbers together.',
      incorrect: [
        'Not quite. Combine only like terms: x-terms with x-terms, numbers with numbers.',
        "Add the x-terms' coefficients, and add the plain numbers separately.",
      ],
    },
    [`Add the x-terms: ${term(a)} + ${term(c)} = ${term(coeff)}.`, `Keep the + ${b}.`, `So: ${canonical}.`],
  );
}

function buildCombineSolve(difficulty: Difficulty): GeneratedProblem {
  const x = randomInt(1, difficulty >= 4 ? 9 : 6);
  const a = randomInt(1, 3);
  const c = randomInt(1, 3);
  const coeff = a + c;
  const b = randomInt(1, 9);
  const total = coeff * x + b;
  return solveProblem(
    'combine',
    `${term(a)} + ${term(c)} + ${b} = ${total}. What is x?`,
    `${a}x + ${c}x + ${b} = ${total}`,
    x,
    {
      correct: `Right, combine the x's, then solve: x = ${x}.`,
      incorrect: [
        'First combine the x-terms, then undo the number added.',
        'Group the x blocks, take the extra off both sides, then split.',
      ],
    },
    // `total - b` = the value before dividing (a "forgot to divide" slip).
    [total - b],
    [
      `Combine the x-terms: ${term(a)} + ${term(c)} = ${term(coeff)}, so ${term(coeff)} + ${b} = ${total}.`,
      `Subtract ${b}: ${term(coeff)} = ${total - b}.`,
      `Divide by ${coeff}: x = ${x}.`,
    ],
  );
}

function buildCombine(difficulty: Difficulty): GeneratedProblem {
  return coin() ? buildCombineSimplify(difficulty) : buildCombineSolve(difficulty);
}

// --- expression (lesson 5): words -> expression ----------------------------

type Phrase = { phrase: string; coeff: number; constant: number };

function buildExpression(difficulty: Difficulty): GeneratedProblem {
  const a = randomInt(2, difficulty >= 3 ? 9 : 5);
  const n = randomInt(1, difficulty >= 3 ? 12 : 9);
  const easy: Phrase[] = [
    { phrase: `${a} times a number`, coeff: a, constant: 0 },
    { phrase: `a number plus ${n}`, coeff: 1, constant: n },
    { phrase: `a number minus ${n}`, coeff: 1, constant: -n },
  ];
  const hard: Phrase[] = [
    { phrase: `${n} more than ${a} times a number`, coeff: a, constant: n },
    { phrase: `${n} less than ${a} times a number`, coeff: a, constant: -n },
  ];
  const choice = pick(difficulty <= 2 ? easy : hard);
  const canonical = linear(choice.coeff, choice.constant);
  const candidates = [
    linear(choice.coeff, -choice.constant),
    linear(choice.constant === 0 ? 1 : Math.abs(choice.constant), choice.coeff),
    linear(choice.coeff + 1, choice.constant),
    linear(choice.coeff, choice.constant + 1),
    term(choice.coeff),
    linear(1, choice.coeff),
  ];
  const steps = [
    choice.coeff === 1 ? '"a number" → x.' : `"${choice.coeff} times a number" → ${choice.coeff}x.`,
  ];
  if (choice.constant > 0) {
    steps.push(`"${choice.constant} more" → add ${choice.constant}.`, `So: ${canonical}.`);
  } else if (choice.constant < 0) {
    steps.push(`"${-choice.constant} less" → subtract ${-choice.constant}.`, `So: ${canonical}.`);
  }
  return equivalentProblem(
    'expression',
    `Write an expression:  "${choice.phrase}."`,
    canonical,
    canonical,
    candidates,
    {
      correct: 'Exactly, that matches the words.',
      incorrect: [
        'Not quite. Match each part of the sentence to a piece of the expression.',
        '"Times a number" is the number in front of x; the plain number is added or subtracted.',
      ],
    },
    steps,
  );
}

const BUILDERS: Record<ConceptId, (difficulty: Difficulty) => GeneratedProblem> = {
  balance: buildBalance,
  introX: buildIntroX,
  solve: buildSolve,
  combine: buildCombine,
  expression: buildExpression,
};

/** A hand-checked problem used only if generation ever fails to verify. */
function fallbackProblem(): GeneratedProblem {
  return {
    id: nextId(),
    concept: 'balance',
    prompt: '3 identical circles balance 12 pounds. How much does one circle weigh?',
    options: ['3 lb', '4 lb', '6 lb', '12 lb'],
    correctIndex: 1,
    feedback: {
      correct: 'Right, 12 shared among 3 is 4 each.',
      incorrect: ['Divide the total weight by how many circles there are.'],
    },
    steps: ['Share the weight equally: 12 ÷ 3 = 4 lb.'],
    check: { kind: 'value', value: 4, total: 12, count: 3, extra: 0 },
  };
}

/**
 * Build a verified problem locally (no network) for a concept at a difficulty.
 * Every candidate runs through the same math.js verifier the AI output uses, so
 * this can never emit an unsolvable, ambiguous, or wrong problem. Serves as the
 * offline fallback and lets the loop be tested before Gemini is provisioned.
 */
export function generateLocalProblem(concept: ConceptId = 'solve', difficulty: Difficulty = 3): GeneratedProblem {
  const build = BUILDERS[concept] ?? buildSolve;
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = build(difficulty);
    if (verifyProblem(candidate).ok) {
      return candidate;
    }
  }
  return fallbackProblem();
}

/**
 * Public entry point: pick one concept from the pool (interleaving across the
 * lesson skills the learner has reached) and generate a verified problem at the
 * requested difficulty. Returns a Promise so the UI is already async-ready for
 * the Gemini path.
 */
export async function generateProblem(
  concept: ConceptId,
  difficulty: Difficulty = 3,
): Promise<GeneratedProblem> {
  if (isAiGenerationEnabled()) {
    try {
      const aiProblem = await withTimeout(aiGenerateProblem(concept, difficulty), AI_GENERATION_TIMEOUT_MS);
      // Trust nothing: re-verify the math and the curriculum guard before use.
      if (aiProblem && conceptAllowed(aiProblem, concept) && verifyProblem(aiProblem).ok) {
        return aiProblem;
      }
    } catch {
      // Fall through to the verified local generator.
    }
  }
  return generateLocalProblem(concept, difficulty);
}

/** Reject AI problems that drift off the requested concept or its notation. */
function conceptAllowed(problem: GeneratedProblem, expected: ConceptId): boolean {
  if (problem.concept !== expected) {
    return false;
  }
  // Curriculum guard: lesson-1 balance problems must not introduce a variable.
  if (expected === 'balance') {
    const text = `${problem.prompt} ${problem.options.join(' ')}`;
    if (problem.check.kind !== 'value' || /(?:^|[^a-z])x(?:[^a-z]|$)/i.test(text)) {
      return false;
    }
  }
  return true;
}

// How strongly the dig leans toward weak skills: a fully-missed concept gets up
// to (1 + WEAKNESS_BOOST)x its normal weight, so practice targets struggles while
// every concept still keeps a real chance (interleaving, not drilling one thing).
const WEAKNESS_BOOST = 4;

/**
 * Choose the next concept from the pool: never repeat the one just shown (when
 * there's a choice), lean toward the newest skill reached, AND lean toward the
 * skills the learner is weakest at. `weakness` maps a concept to 0..1 (1 = totally
 * missed); pass {} for the plain recency-only behavior.
 */
export function pickNextConcept(
  pool: ConceptId[],
  last: ConceptId | null,
  weakness: Partial<Record<ConceptId, number>> = {},
): ConceptId {
  if (pool.length <= 1) return pool[0] ?? 'balance';
  const candidates = pool.filter((concept) => concept !== last);
  const weights = candidates.map((concept) => {
    const recency = pool.indexOf(concept) + 1;
    const weak = Math.max(0, Math.min(1, weakness[concept] ?? 0));
    return recency * (1 + WEAKNESS_BOOST * weak);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (let index = 0; index < candidates.length; index++) {
    roll -= weights[index];
    if (roll <= 0) return candidates[index];
  }
  return candidates[candidates.length - 1];
}

/** Map a generated problem onto the McStep shape so McStepView can render it. */
export function toMcStep(problem: GeneratedProblem): McStep {
  return {
    id: problem.id,
    type: 'mc',
    prompt: problem.prompt,
    options: problem.options,
    correctIndex: problem.correctIndex,
    feedback: problem.feedback,
  };
}
