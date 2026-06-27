/**
 * Phase 2 feature flags. The MVP must keep working with AI off, so the app
 * reads these helpers (never inline env access) and both degrade safely.
 */

/**
 * Whether the "Keep practicing" feature is shown. Defaults ON: the practice loop
 * works offline via the verified local generator, optionally upgraded with
 * AI-generated variety. Set `VITE_PRACTICE_ENABLED=false` to hide it entirely.
 */
export function isPracticeEnabled(): boolean {
  return import.meta.env.VITE_PRACTICE_ENABLED !== 'false';
}

/**
 * Whether to call OpenAI directly with the learner's key. DEV-ONLY by design: an
 * OpenAI key is a secret, so this is true only on the local dev server, and the
 * production build folds it to false and strips the key out of the bundle. In a
 * deployed build, AI features route through the auth-gated Cloud Functions instead.
 */
export function hasOpenAiKey(): boolean {
  return import.meta.env.DEV && Boolean(import.meta.env.VITE_OPENAI_API_KEY);
}

/**
 * Whether to use an LLM to GENERATE practice problems (variety on top of the local
 * generator). OFF by default: the local generator is curriculum-aligned, verified,
 * instant, and free, and every AI problem is re-verified + curriculum-guarded with
 * a local fallback, so AI only adds variety and never correctness risk. In dev it
 * uses the OpenAI key directly; in a build it routes through the Cloud Function.
 * Set `VITE_AI_GENERATION=true` to turn on.
 */
export function isAiGenerationEnabled(): boolean {
  return import.meta.env.VITE_AI_GENERATION === 'true';
}
