/**
 * Server-side OpenAI judge for the self-explanation ("Convince Me") feature.
 *
 * The OpenAI key is a secret and must never reach the browser, so the deployed
 * app calls THIS callable function instead of OpenAI directly. The key lives only
 * in a Firebase secret (set via `firebase functions:secrets:set OPENAI_API_KEY`)
 * and is read at runtime here. Protections:
 *  - requires a signed-in Firebase user (the app gates everything behind auth),
 *  - capped at a few instances so it can't scale up and run a bill,
 *  - returns an empty message on any failure, so the client falls back to a
 *    neutral encouraging close (the app never breaks if the judge is unavailable).
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const MODEL = 'gpt-5.4';
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Mirrors PROBLEM_JSON_SCHEMA in src/lib/ai/problemParse.ts (server copy).
const PROBLEM_JSON_SCHEMA = {
  name: 'practice_problem',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'concept', 'prompt', 'options', 'correctIndex', 'feedbackCorrect',
      'feedbackIncorrect', 'steps', 'checkKind', 'equation', 'expression', 'variable', 'value',
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
};

/** Call OpenAI chat completions expecting a JSON object; returns parsed object or null. */
async function openAiJson(system, user, options = {}) {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: options.jsonSchema
          ? { type: 'json_schema', json_schema: options.jsonSchema }
          : { type: 'json_object' },
        ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      logger.warn('OpenAI returned non-OK', res.status);
      return null;
    }
    const body = await res.json();
    const text = body && body.choices && body.choices[0] && body.choices[0].message
      ? body.choices[0].message.content
      : null;
    return text ? JSON.parse(text) : null;
  } catch (error) {
    logger.error('openAiJson failed', error);
    return null;
  }
}

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

const GENERATION_SYSTEM =
  'You are an expert middle-school math item writer. You output ONLY one JSON object for a single multiple-choice practice problem, matching the schema. Every problem must be mathematically correct and solvable, with exactly one correct option. For the check fields, fill the ones the checkKind needs (solves -> equation+variable; equivalent -> expression+variable; value -> value) and set the rest to null.';

const FOLLOWUP_SYSTEM =
  'You are a warm middle-school math coach giving feedback on a 7th grader\u2019s answer to a quick "what if" question. You are GIVEN the correct answer and the reason it is correct; treat them as ground truth and never contradict them. Reply ONLY as JSON of the form {"feedback": string}. Write one or two short, encouraging sentences: if the student\u2019s answer matches the correct answer, affirm it warmly; if it does not, gently tell them what the answer actually is. Then explain why in plain, concrete words a 7th grader uses, based on the given reason. Use the course\u2019s balance idea (do the same to both sides to keep it equal) and undoing each operation to get the variable by itself; never use vague jargon like "cancel", "cancel out", "get rid of", or "move it over". No emojis, no em dashes.';

const SYSTEM =
  'You are a warm middle-school math coach judging a 7th grader\u2019s written explanation of a problem they already solved correctly. Set acceptable to true ONLY if the explanation covers the full reasoning for why it works, including every key step. Set acceptable to false if it leaves out a step, is a guess, only restates the answer or the numbers, is off topic, or does not say why. Informal wording is fine as long as the full reasoning is there. Reply ONLY as JSON of the form {"acceptable": boolean, "feedback": string}. The feedback is one short, encouraging sentence. If acceptable, affirm their specific idea. If they explained part but left out a step (for example, they combined the terms but did not say what to do with the result), affirm what they got and describe the missing step as the next move to add, in words and never with a number. If it is a guess or completely off, give just the smallest nudge and invite them to try again. Never state or hint at an answer. Teach the way this course does: use the balance idea (whatever you do to one side you do to the other to keep it equal) and undoing an operation to get the variable by itself, in plain concrete words a 7th grader uses; never use vague jargon like "cancel", "cancel out", "get rid of", or "move it over". No emojis, no em dashes.';

exports.judgeExplanation = onCall(
  { secrets: [OPENAI_API_KEY], maxInstances: 5, region: 'us-central1' },
  async (request) => {
    // Only signed-in users of the app can call this (keeps the key + spend protected).
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to use the tutor.');
    }

    const data = request.data || {};
    const explanation = typeof data.explanation === 'string' ? data.explanation.trim() : '';
    if (explanation.length === 0) {
      throw new HttpsError('invalid-argument', 'An explanation is required.');
    }

    const user = [
      `Problem: ${typeof data.prompt === 'string' ? data.prompt : ''}`,
      `A correct way to reason about it: ${typeof data.reasoning === 'string' ? data.reasoning : ''}`,
      `The student's explanation: "${explanation}"`,
    ].join('\n');

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
        },
        body: JSON.stringify({
          model: MODEL,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!response.ok) {
        logger.warn('OpenAI returned non-OK', response.status);
        return { acceptable: false, message: '' };
      }
      const body = await response.json();
      const text = body && body.choices && body.choices[0] && body.choices[0].message
        ? body.choices[0].message.content
        : null;
      const parsed = text ? JSON.parse(text) : null;
      const message = parsed && typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '';
      if (!message) {
        return { acceptable: false, message: '' };
      }
      return { acceptable: parsed.acceptable === true, message };
    } catch (error) {
      logger.error('judgeExplanation failed', error);
      // Client treats an empty message as "no judge", and shows a friendly fallback.
      return { acceptable: false, message: '' };
    }
  },
);

/**
 * Give feedback on a learner's answer to a "what if" follow-up question. Same
 * protections as judgeExplanation. Returns an empty message on any failure so the
 * client shows a friendly fallback.
 */
exports.followUpFeedback = onCall(
  { secrets: [OPENAI_API_KEY], maxInstances: 5, region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to use the tutor.');
    }
    const data = request.data || {};
    const response = typeof data.response === 'string' ? data.response.trim() : '';
    if (response.length === 0) {
      throw new HttpsError('invalid-argument', 'A response is required.');
    }
    const question = typeof data.question === 'string' ? data.question : '';
    const answer = typeof data.answer === 'string' ? data.answer : '';
    const why = typeof data.why === 'string' ? data.why : '';
    const user = [
      `Question: ${question}`,
      `The correct answer: ${answer}`,
      `Why it is correct: ${why}`,
      `The student's answer: "${response}"`,
    ].join('\n');

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
        },
        body: JSON.stringify({
          model: MODEL,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: FOLLOWUP_SYSTEM },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) {
        logger.warn('OpenAI returned non-OK (followUp)', res.status);
        return { message: '' };
      }
      const body = await res.json();
      const text = body && body.choices && body.choices[0] && body.choices[0].message
        ? body.choices[0].message.content
        : null;
      const parsed = text ? JSON.parse(text) : null;
      const message = parsed && typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '';
      return { message };
    } catch (error) {
      logger.error('followUpFeedback failed', error);
      return { message: '' };
    }
  },
);

/**
 * Generate a practice problem with OpenAI. Returns the raw JSON object for the
 * client to parse + verify with its math engine (the server does not verify; the
 * client rejects anything that fails its check and falls back to local). Returns
 * an empty object on any failure.
 */
exports.generatePractice = onCall(
  { secrets: [OPENAI_API_KEY], maxInstances: 5, region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to practice.');
    }
    const data = request.data || {};
    const concepts = Array.isArray(data.concepts) ? data.concepts.filter((c) => typeof c === 'string') : [];
    const difficulty = typeof data.difficulty === 'number' ? data.difficulty : 3;
    if (concepts.length === 0) {
      throw new HttpsError('invalid-argument', 'At least one concept is required.');
    }
    const parsed = await openAiJson(GENERATION_SYSTEM, buildGenerationPrompt(concepts, difficulty), {
      jsonSchema: PROBLEM_JSON_SCHEMA,
      reasoningEffort: 'none',
    });
    return { problem: parsed || null };
  },
);
