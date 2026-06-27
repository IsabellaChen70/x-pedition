import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

type JudgeContext = { prompt: string; reasoning: string; explanation: string };
type JudgeResult = { acceptable: boolean; message: string };

/**
 * Judge a self-explanation via the server-side Cloud Function (which holds the
 * OpenAI key). Used on the deployed site, where the key must never reach the
 * browser. Returns null on any failure so the caller shows the neutral fallback.
 */
export async function judgeExplanationViaFunction(
  context: JudgeContext,
): Promise<JudgeResult | null> {
  try {
    const call = httpsCallable<JudgeContext, JudgeResult>(functions, 'judgeExplanation');
    const { data } = await call(context);
    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    return message ? { acceptable: data.acceptable === true, message } : null;
  } catch {
    return null;
  }
}

type FollowUpContext = { question: string; answer: string; why: string; response: string };

/** Feedback on a follow-up answer via the Cloud Function. Null on failure. */
export async function respondToFollowUpViaFunction(
  context: FollowUpContext,
): Promise<{ message: string } | null> {
  try {
    const call = httpsCallable<FollowUpContext, { message: string }>(functions, 'followUpFeedback');
    const { data } = await call(context);
    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    return message ? { message } : null;
  } catch {
    return null;
  }
}
