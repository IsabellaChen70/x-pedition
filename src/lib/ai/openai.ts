/**
 * OpenAI provider for the self-explanation judge, DEV ONLY.
 *
 * An OpenAI API key is a SECRET and must never ship in a public client bundle, so
 * every path here is gated on `import.meta.env.DEV`. In a production build the
 * `import.meta.env.DEV` guard folds to `false`, so the bundler strips this code
 * (and the inlined key) entirely; deployed builds call the auth-gated Cloud
 * Functions instead. For local testing the key lives in `.env.local` (gitignored).
 * Do NOT deploy with `VITE_OPENAI_API_KEY` set.
 */

import { buildGenerationPrompt, parseGeneratedProblem, PROBLEM_JSON_SCHEMA } from './problemParse';
import type { ConceptId, GeneratedProblem } from './types';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/** The key, but only on the local dev server (null in any production build). */
function devKey(): string | null {
  if (!import.meta.env.DEV) {
    return null;
  }
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  return key ? key : null;
}

type ChatOptions = {
  /** Strict structured outputs schema (guarantees exact keys). */
  jsonSchema?: object;
  /** Reasoning budget: 'none' is fastest/cheapest for simple structured tasks. */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
};

/**
 * Call OpenAI chat completions expecting a JSON object back; null on any failure.
 * Pass `jsonSchema` for strict structured outputs and `reasoningEffort` to trade
 * reasoning depth for speed/cost (simple structured generation uses 'none').
 */
async function chatJson(system: string, user: string, options: ChatOptions = {}): Promise<unknown | null> {
  const key = devKey();
  if (!key) {
    return null;
  }
  const model = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5.4';
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
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
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * Judge a learner's free-text self-explanation with OpenAI: a lenient verdict plus
 * one encouraging sentence, grounded in the canonical reasoning and never stating
 * the answer. Returns null on any failure.
 */
export async function judgeExplanationWithOpenAI(context: {
  prompt: string;
  reasoning: string;
  explanation: string;
}): Promise<{ acceptable: boolean; message: string } | null> {
  const system =
    'You are a warm middle-school math coach judging a 7th grader\u2019s written explanation of a problem they already solved correctly. Set acceptable to true ONLY if the explanation covers the full reasoning for why it works, including every key step. Set acceptable to false if it leaves out a step, is a guess, only restates the answer or the numbers, is off topic, or does not say why. Informal wording is fine as long as the full reasoning is there. Reply ONLY as JSON of the form {"acceptable": boolean, "feedback": string}. The feedback is one short, encouraging sentence. If acceptable, affirm their specific idea. If they explained part but left out a step (for example, they combined the terms but did not say what to do with the result), affirm what they got and describe the missing step as the next move to add, in words and never with a number. If it is a guess or completely off, give just the smallest nudge and invite them to try again. Never state or hint at an answer. Teach the way this course does: use the balance idea (whatever you do to one side you do to the other to keep it equal) and undoing an operation to get the variable by itself, in plain concrete words a 7th grader uses; never use vague jargon like "cancel", "cancel out", "get rid of", or "move it over". No emojis, no em dashes.';
  const user = [
    `Problem: ${context.prompt}`,
    `A correct way to reason about it: ${context.reasoning}`,
    `The student's explanation: "${context.explanation}"`,
  ].join('\n');

  const parsed = (await chatJson(system, user)) as
    | { acceptable?: unknown; feedback?: unknown }
    | null;
  if (!parsed) {
    return null;
  }
  const message = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '';
  if (message.length === 0) {
    return null;
  }
  return { acceptable: parsed.acceptable === true, message };
}

/**
 * Give feedback on a learner's answer to an authored "what if" follow-up. The
 * correct answer and reason are AUTHORED (passed in), so we hand them to the model
 * as ground truth: it can confirm right/wrong and share the idea without ever
 * doing, and possibly botching, the math itself. Returns null on any failure.
 */
export async function respondToFollowUp(context: {
  question: string;
  answer: string;
  why: string;
  response: string;
}): Promise<{ message: string } | null> {
  const system =
    'You are a warm middle-school math coach giving feedback on a 7th grader\u2019s answer to a quick "what if" question. You are GIVEN the correct answer and the reason it is correct; treat them as ground truth and never contradict them. Reply ONLY as JSON of the form {"feedback": string}. Write one or two short, encouraging sentences: if the student\u2019s answer matches the correct answer, affirm it warmly; if it does not, gently tell them what the answer actually is. Then explain why in plain, concrete words a 7th grader uses, based on the given reason. Use the course\u2019s balance idea (do the same to both sides to keep it equal) and undoing each operation to get the variable by itself; never use vague jargon like "cancel", "cancel out", "get rid of", or "move it over". No emojis, no em dashes.';
  const user = [
    `Question: ${context.question}`,
    `The correct answer: ${context.answer}`,
    `Why it is correct: ${context.why}`,
    `The student's answer: "${context.response}"`,
  ].join('\n');
  const parsed = (await chatJson(system, user)) as { feedback?: unknown } | null;
  if (!parsed) {
    return null;
  }
  const message = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '';
  return message ? { message } : null;
}

/**
 * Generate a practice problem with OpenAI (DEV ONLY). Returns a parsed problem or
 * null; the caller still verifies it with the math engine + curriculum guard and
 * falls back to the local generator, so AI can never surface a wrong problem.
 */
export async function generateProblemWithOpenAI(
  concepts: ConceptId[],
  difficulty: number,
): Promise<GeneratedProblem | null> {
  const system =
    'You are an expert middle-school math item writer. You output ONLY one JSON object for a single multiple-choice practice problem, matching the schema. Every problem must be mathematically correct and solvable, with exactly one correct option. For the check fields, fill the ones the checkKind needs (solves -> equation+variable; equivalent -> expression+variable; value -> value) and set the rest to null.';
  const parsed = await chatJson(system, buildGenerationPrompt(concepts, difficulty), {
    jsonSchema: PROBLEM_JSON_SCHEMA,
    reasoningEffort: 'none',
  });
  return parsed ? parseGeneratedProblem(parsed, 'ai') : null;
}
