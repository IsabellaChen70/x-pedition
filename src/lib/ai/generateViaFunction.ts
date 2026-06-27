import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { parseGeneratedProblem } from './problemParse';
import type { ConceptId, GeneratedProblem } from './types';

type GenerateContext = { concepts: ConceptId[]; difficulty: number };

/**
 * Generate a practice problem via the server-side Cloud Function (which holds the
 * OpenAI key). The server returns the raw problem JSON; we parse it here, and the
 * caller still verifies it with the math engine + curriculum guard. Null on any
 * failure so the caller falls back to the local generator.
 */
export async function generateProblemViaFunction(
  context: GenerateContext,
): Promise<GeneratedProblem | null> {
  try {
    const call = httpsCallable<GenerateContext, { problem: unknown }>(functions, 'generatePractice');
    const { data } = await call(context);
    return data?.problem ? parseGeneratedProblem(data.problem, 'ai') : null;
  } catch {
    return null;
  }
}
