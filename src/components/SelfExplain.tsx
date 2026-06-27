import { useRef, useState } from 'react';
import { hasOpenAiKey } from '../lib/ai/config';
import { recordReflection } from '../lib/progress';
import type { Step } from '../types/lesson';
import { Button } from './ui';

/** Minimum characters for a genuine attempt (light anti-gaming). */
const MIN_CHARS = 12;
const XP_PER_REFLECTION = 10;

/** The canonical reasoning used to ground the AI judge (never shown to the learner). */
function canonicalReasoning(step: Step): string {
  return step.type === 'concept' ? '' : step.feedback.correct;
}

/**
 * "Convince Me" self-explanation, shown inline below a correctly answered
 * reflect/mastery question. The learner must write something (no skip), gets a
 * grounded verdict, and on a weak answer can revise, but Continue is always
 * available, so the AI never traps anyone on a question they already solved.
 * Rewards effort (XP) once. Grounded in the self-explanation effect.
 */
export default function SelfExplain({
  step,
  userId,
  courseId,
  onDone,
  onReflect,
}: {
  step: Step;
  userId: string;
  courseId: string;
  onDone: () => void;
  /** Save the learner's typed explanation so it can be shown later in review. */
  onReflect?: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const [stage, setStage] = useState<'input' | 'judging' | 'result'>('input');
  const [message, setMessage] = useState('');
  const [judged, setJudged] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [twist, setTwist] = useState('');
  const [followUpStage, setFollowUpStage] = useState<'ask' | 'checking' | 'done'>('ask');
  const [followUpMessage, setFollowUpMessage] = useState('');
  const awarded = useRef(false);
  const followUpAwarded = useRef(false);

  const prompt = step.type === 'concept' ? '' : step.prompt;
  const reasoning = canonicalReasoning(step);
  // An authored "what if" transfer twist for this question (Convince-Me follow-up).
  // Its answer + why are authored, so AI feedback is grounded and never wrong.
  const followUp = step.type === 'concept' ? undefined : step.followUp;
  const ready = text.trim().length >= MIN_CHARS;

  const handleSubmit = async () => {
    if (!ready) {
      return;
    }
    // Persist what they wrote (latest submit wins) so review can show it later.
    onReflect?.(text.trim());
    setStage('judging');
    let aiMessage: string | null = null;
    let isAccepted = false;
    let wasJudged = false;
    // Local dev uses the OpenAI key directly (fast); the deployed app calls the
    // auth-gated Cloud Function so the key stays server-side. Either returns null
    // on failure, in which case we show the neutral fallback below.
    try {
      const result = hasOpenAiKey()
        ? await (await import('../lib/ai/openai')).judgeExplanationWithOpenAI({
            prompt,
            reasoning,
            explanation: text.trim(),
          })
        : await (await import('../lib/ai/judgeViaFunction')).judgeExplanationViaFunction({
            prompt,
            reasoning,
            explanation: text.trim(),
          });
      if (result) {
        aiMessage = result.message;
        isAccepted = result.acceptable;
        wasJudged = true;
      }
    } catch {
      // Fall back to a generic, answer-safe close on any AI failure.
    }
    // Never reveal the answer here. The judge's message is answer-safe by
    // instruction (a slight hint when off), and the no-AI fallback is generic.
    setMessage(aiMessage ?? 'Nice effort putting your thinking into words.');
    setAccepted(isAccepted);
    setJudged(wasJudged);
    setStage('result');
    // Effort earns XP once, even across revisions; a genuine attempt is enough.
    if (!awarded.current) {
      awarded.current = true;
      void recordReflection(userId, courseId).catch(() => {
        // Best-effort reward; never block the learner on a flaky network.
      });
    }
  };

  // The follow-up "what if" is itself graded. AI feedback is GROUNDED in the
  // authored answer + why, so it can confirm right/wrong and share the idea
  // without doing the math itself. A genuine reply earns its own reflection XP;
  // skipping just continues, no penalty. No long-form minimum here: valid answers
  // (like "heavier" or "2x - 1") are short, so any non-empty reply can submit.
  const followUpReady = twist.trim().length > 0;
  const handleFollowUpSubmit = async () => {
    if (!followUpReady || followUpStage === 'checking' || !followUp) {
      return;
    }
    setFollowUpStage('checking');
    let fb: string | null = null;
    try {
      const payload = {
        question: followUp.prompt,
        answer: followUp.answer,
        why: followUp.why,
        response: twist.trim(),
      };
      const result = hasOpenAiKey()
        ? await (await import('../lib/ai/openai')).respondToFollowUp(payload)
        : await (await import('../lib/ai/judgeViaFunction')).respondToFollowUpViaFunction(payload);
      if (result) {
        fb = result.message;
      }
    } catch {
      // Fall back to the authored reason, which is always correct, so the
      // learner still gets the right idea even with AI off or unreachable.
    }
    setFollowUpMessage(fb ?? followUp.why);
    setFollowUpStage('done');
    if (!followUpAwarded.current) {
      followUpAwarded.current = true;
      void recordReflection(userId, courseId).catch(() => {});
    }
  };

  if (stage === 'result') {
    const needsRetry = judged && !accepted;
    const heading = accepted
      ? 'Nice thinking!'
      : needsRetry
        ? 'Not quite, try once more'
        : 'Thanks for explaining!';
    return (
      <div className="mt-4 w-full">
        <p className="font-display text-lg font-bold text-ink">{heading}</p>
        <p
          className={`mt-2 rounded-xl border px-4 py-3 text-sm leading-relaxed text-ink ${
            needsRetry ? 'border-gold-400/60 bg-gold-400/10' : 'border-brand-100 bg-brand-50'
          }`}
        >
          {message}
        </p>
        <p className="mt-2 text-sm font-semibold text-gold-700">+{XP_PER_REFLECTION} XP</p>
        {accepted && followUp && (
          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-brand-800">One more to think about</p>
              <span className="shrink-0 rounded-full bg-gold-400/30 px-2 py-0.5 text-xs font-bold text-gold-700">
                +{XP_PER_REFLECTION} XP
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink">{followUp.prompt}</p>
            {followUpStage === 'done' ? (
              <p className="mt-2 rounded-lg border border-brand-100 bg-parchment-50 px-3 py-2 text-sm leading-relaxed text-ink">
                {followUpMessage}
              </p>
            ) : (
              <>
                <textarea
                  value={twist}
                  onChange={(event) => setTwist(event.target.value)}
                  rows={2}
                  placeholder="Type your thinking…"
                  disabled={followUpStage === 'checking'}
                  className="mt-2 w-full resize-none rounded-lg border-2 border-parchment-300 bg-parchment-50 px-3 py-2 text-sm leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                />
                <div className="mt-2 flex items-center justify-end">
                  <Button
                    size="sm"
                    onClick={() => void handleFollowUpSubmit()}
                    disabled={!followUpReady || followUpStage === 'checking'}
                  >
                    {followUpStage === 'checking' ? 'Checking\u2026' : 'Submit'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        <div className="mt-4 flex items-center justify-end gap-3">
          {needsRetry ? (
            <>
              <Button variant="ghost" onClick={onDone}>
                Continue anyway
              </Button>
              <Button onClick={() => setStage('input')}>Try again</Button>
            </>
          ) : (
            <Button onClick={onDone}>Continue</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 w-full">
      <p className="font-display text-lg font-bold text-ink">Explain your thinking</p>
      <p className="mt-1 text-sm text-muted">In a sentence, why does your answer work?</p>
      <div className="relative mt-3">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder="I knew it because..."
          disabled={stage === 'judging'}
          className="w-full resize-none rounded-xl border-2 border-parchment-300 bg-parchment-50 px-4 pb-7 pt-3 text-sm leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        />
        <span
          className={`pointer-events-none absolute bottom-2 right-3 text-xs font-semibold ${
            ready ? 'text-emerald-600' : 'text-muted'
          }`}
          aria-live="polite"
        >
          {Math.min(text.trim().length, MIN_CHARS)}/{MIN_CHARS}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-end">
        <Button onClick={() => void handleSubmit()} disabled={!ready || stage === 'judging'}>
          {stage === 'judging' ? 'Checking\u2026' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
