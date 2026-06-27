import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fireConfetti } from '../lib/confetti';
import {
  clampDifficulty,
  generateLocalProblem,
  generateProblem,
  isConfidentWin,
  masteryStartDifficulty,
  pickNextConcept,
  toMcStep,
} from '../lib/ai/generate';
import type { Difficulty } from '../lib/ai/generate';
import { CONCEPT_LABELS, conceptsForLesson } from '../lib/ai/concepts';
import { bumpSessionWeakness, rankConceptMistakes } from '../lib/ai/adaptive';
import { explainWrongChoice, solutionSteps } from '../lib/ai/solution';
import type { ConceptId, GeneratedProblem } from '../lib/ai/types';
import { getCourse } from '../lib/content';
import { getPracticeSetup, recordPracticeSession } from '../lib/progress';
import type { PracticeSetup } from '../lib/progress';
import { validateMcStep } from '../lib/validation';
import McStepView from './McStepView';
import { Button, Card } from './ui';

type PracticeSessionProps = {
  userId: string;
  courseId: string;
  /** The lesson practice was launched from; scopes which skills are interleaved. */
  lessonId: string;
  onExit: () => void;
};

const START_DIFFICULTY: Difficulty = 2;
// Clean first-try wins in a row before the level goes up. A plain win-up/miss-down
// rule converges on ~50% success (the failure frontier); a short streak holds
// success near the ~80-85% sweet spot the 85% Rule (Wilson et al., 2019) and
// desirable-difficulty research identify as optimal for learning and motivation.
const LEVEL_UP_STREAK = 3;
// Wrong guesses on a single problem before the level eases down. One miss (a
// 2nd-try solve) is fine and never demotes; repeated guessing does.
const WRONG_GUESSES_TO_EASE = 2;
// Misses on one problem before a no-penalty "Skip this one" appears, so a stuck
// learner can move on to a fresh problem without ever being shown the answer.
const MISSES_BEFORE_SKIP = 2;
// Problems in a finite "Daily Treasure Dig", long enough that the adaptive
// ramp pushes into harder levels, while staying a quick daily habit.
const DAILY_GOAL = 8;
// Each solved problem is worth this much XP toward the player's level.
const XP_PER_SOLVE = 10;

type Mode = 'choose' | 'daily' | 'endless';

/** Resume one level below the learner's best (gentle warm-up / early win). */
function resumeDifficulty(bestLevel: number): Difficulty {
  return bestLevel >= 2 ? clampDifficulty(bestLevel - 1) : START_DIFFICULTY;
}

/**
 * The adaptive starting difficulty from a single saved-state read: returning
 * practitioners resume just below their best; first-timers are placed by how they
 * did on the lesson's mastery check. Pure.
 */
function placeDifficulty(setup: PracticeSetup): Difficulty {
  return setup.bestLevel >= 2
    ? resumeDifficulty(setup.bestLevel)
    : masteryStartDifficulty(setup.masteryFraction);
}

/**
 * The practice feature: pick a mode, then run an adaptive loop of math-verified
 * equations. Never touches mastery or saved lesson progress; it only writes its
 * own practice stats (solved count, best level, daily-dig streak).
 */
export default function PracticeSession({
  userId,
  courseId,
  lessonId,
  onExit,
}: PracticeSessionProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const concepts = useMemo(() => conceptsForLesson(lessonId), [lessonId]);
  const scopeTitle = getCourse().lessons[lessonId]?.title ?? '';

  // Prewarm placement + weakness in ONE Firestore read while the learner reads the
  // mode cards, so entering a dig is instant. Doesn't depend on the chosen mode.
  const setupRef = useRef<Promise<PracticeSetup> | null>(null);
  useEffect(() => {
    if (setupRef.current) return;
    setupRef.current = getPracticeSetup(userId, courseId, lessonId, concepts);
  }, [userId, courseId, lessonId, concepts]);

  if (mode === 'choose') {
    return (
      <ModeChooser
        scopeTitle={scopeTitle}
        onDaily={() => setMode('daily')}
        onEndless={() => setMode('endless')}
        onExit={onExit}
      />
    );
  }

  return (
    <PracticeRunner
      goal={mode === 'daily' ? DAILY_GOAL : null}
      concepts={concepts}
      scopeTitle={scopeTitle}
      userId={userId}
      courseId={courseId}
      lessonId={lessonId}
      setup={setupRef.current}
      onExit={onExit}
    />
  );
}

function ModeChooser({
  scopeTitle,
  onDaily,
  onEndless,
  onExit,
}: {
  scopeTitle: string;
  onDaily: () => void;
  onEndless: () => void;
  onExit: () => void;
}) {
  return (
    <Card padding="lg">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-xl font-bold text-ink">Practice</p>
        <Button variant="ghost" size="sm" onClick={onExit}>
          Done
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">
        {scopeTitle ? `Skills up to ${scopeTitle}.` : 'Practice your skills.'}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onDaily}
          className="rounded-2xl border-2 border-gold-500 bg-gold-400/15 p-4 text-left transition hover:bg-gold-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <p className="font-display text-lg font-bold text-ink">Daily Treasure Dig</p>
          <p className="mt-1 text-sm text-muted">Solve {DAILY_GOAL} to keep your streak.</p>
        </button>
        <button
          type="button"
          onClick={onEndless}
          className="rounded-2xl border-2 border-parchment-300 bg-parchment-50 p-4 text-left transition hover:bg-parchment-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <p className="font-display text-lg font-bold text-ink">Free practice</p>
          <p className="mt-1 text-sm text-muted">Practice as long as you like.</p>
        </button>
      </div>
    </Card>
  );
}

function PracticeRunner({
  goal,
  concepts,
  scopeTitle,
  userId,
  courseId,
  lessonId,
  setup,
  onExit,
}: {
  goal: number | null;
  concepts: ConceptId[];
  scopeTitle: string;
  userId: string;
  courseId: string;
  lessonId: string;
  setup: Promise<PracticeSetup> | null;
  onExit: () => void;
}) {
  const [problem, setProblem] = useState<GeneratedProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [solved, setSolved] = useState(0);
  const [shownDifficulty, setShownDifficulty] = useState<Difficulty>(START_DIFFICULTY);
  const [peakLevel, setPeakLevel] = useState<Difficulty>(START_DIFFICULTY);
  const [complete, setComplete] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const nextDifficulty = useRef<Difficulty>(START_DIFFICULTY);
  const lastConcept = useRef<ConceptId | null>(null);
  const correctStreak = useRef(0);
  const wrongAttempts = useRef(0);
  const easedThisProblem = useRef(false);
  // When the current problem first appeared on screen, used to gauge how
  // confident a correct answer was (effort-aware difficulty).
  const shownAt = useRef(Date.now());
  // Per-skill weakness (0..1) derived from mastery results, so the dig leans
  // toward the skills the learner struggles with most (adaptive path).
  const weakness = useRef<Partial<Record<ConceptId, number>>>({});
  // Distinct problems missed per concept this session, for the "what to revisit"
  // nudge on the completion screen. Mirrored into state at completion to render.
  const mistakes = useRef<Partial<Record<ConceptId, number>>>({});
  const [revisit, setRevisit] = useState<{ concept: ConceptId; count: number }[]>([]);
  // How many solves we've already persisted, so we only ever write the delta.
  const recordedSolved = useRef(0);
  // The next problem, generated in the background while the learner reads
  // feedback, so advancing is instant and no "generating" screen appears.
  const prefetchPromise = useRef<Promise<GeneratedProblem> | null>(null);
  const prefetchResult = useRef<GeneratedProblem | null>(null);
  // Difficulty the prefetched problem was built for, so a level change between
  // prefetch and advance discards it (instant local fills in instead).
  const prefetchDifficulty = useRef<Difficulty>(START_DIFFICULTY);

  const resetForNewProblem = useCallback(() => {
    setSubmitted(false);
    setFeedback(null);
    setShowSteps(false);
    wrongAttempts.current = 0;
    easedThisProblem.current = false;
  }, []);

  // Pick the next concept (interleaved) and generate at the current difficulty.
  const buildNext = useCallback((): Promise<GeneratedProblem> => {
    const concept = pickNextConcept(concepts, lastConcept.current, weakness.current);
    lastConcept.current = concept;
    return generateProblem(concept, nextDifficulty.current);
  }, [concepts]);

  // Kick off AI generation of the next problem in the background (after submit,
  // when the difficulty is settled), so advancing can swap it in with no wait.
  const startPrefetch = useCallback(() => {
    const difficulty = nextDifficulty.current;
    const pending = buildNext();
    prefetchPromise.current = pending;
    prefetchDifficulty.current = difficulty;
    prefetchResult.current = null;
    pending
      .then((ahead) => {
        if (prefetchPromise.current === pending) prefetchResult.current = ahead;
      })
      .catch(() => {
        // Ignore: advancing falls back to an instant local problem.
      });
  }, [buildNext]);

  // Show a fresh problem INSTANTLY from the verified local generator (no network).
  // The dig never blocks on AI: AI problems only appear when prefetch already has
  // one ready (see advanceToNext); otherwise this keeps the dig fast.
  const showInstantProblem = useCallback(() => {
    const concept = pickNextConcept(concepts, lastConcept.current, weakness.current);
    lastConcept.current = concept;
    const next = generateLocalProblem(concept, nextDifficulty.current);
    resetForNewProblem();
    setProblem(next);
    setShownDifficulty(nextDifficulty.current);
    setPeakLevel((peak) => (nextDifficulty.current > peak ? nextDifficulty.current : peak));
    setLoading(false);
  }, [concepts, resetForNewProblem]);

  // On entry: apply the prewarmed placement + weakness (one Firestore read, usually
  // already resolved while the learner read the mode cards), then show the FIRST
  // problem instantly from the local generator. AI variety phases in from the next
  // problem via prefetch, fully hidden behind reading time.
  useEffect(() => {
    let active = true;
    void (async () => {
      const loaded = await (setup ?? getPracticeSetup(userId, courseId, lessonId, concepts)).catch(
        () => null,
      );
      if (!active) return;
      if (loaded) {
        weakness.current = loaded.weakness;
        nextDifficulty.current = placeDifficulty(loaded);
        setPeakLevel(nextDifficulty.current);
      }
      showInstantProblem();
    })();
    return () => {
      active = false;
    };
  }, [userId, courseId, lessonId, concepts, setup, showInstantProblem]);

  // Restart the response timer each time a fresh problem is shown.
  useEffect(() => {
    shownAt.current = Date.now();
  }, [problem]);

  const persist = useCallback(
    (completedDig: boolean, solvedNow: number, peak: Difficulty) => {
      const delta = solvedNow - recordedSolved.current;
      if (delta <= 0 && !completedDig) return;
      recordedSolved.current = solvedNow;
      void recordPracticeSession(userId, courseId, {
        solved: Math.max(0, delta),
        peakLevel: peak,
        completedDig,
      });
    },
    [userId, courseId],
  );

  const step = problem ? toMcStep(problem) : null;

  const handleSubmit = (index: number) => {
    if (!step) return;
    const result = validateMcStep(step, index);
    // On a wrong answer, show ONE explanation: the specific, answer-safe diagnosis
    // of THIS choice (deterministic, grounded in the actual math), falling back to
    // the generated hint only if a specific one can't be formed.
    const message =
      result.ok || !problem
        ? result.message
        : explainWrongChoice(problem, index) ?? result.message;
    setFeedback({ ok: result.ok, message });
    setSubmitted(true);

    if (result.ok) {
      setSolved((count) => count + 1);
      // A clean first-try win advances the climb only if it was reasonably quick
      // (effort-aware): a slow, hesitant correct answer holds the level instead of
      // ramping, and a 2nd-try win resets the streak. It never demotes here.
      const confident = isConfidentWin(Date.now() - shownAt.current);
      if (wrongAttempts.current === 0 && confident) {
        correctStreak.current += 1;
        if (correctStreak.current >= LEVEL_UP_STREAK) {
          correctStreak.current = 0;
          nextDifficulty.current = clampDifficulty(nextDifficulty.current + 1);
        }
      } else if (wrongAttempts.current > 0) {
        correctStreak.current = 0;
      }
      // Prefetch the next problem now (difficulty is settled) so Continue is instant.
      startPrefetch();
      return;
    }

    // Wrong attempt: one miss is fine, but repeated guessing on the same problem
    // eases the level down (at most once per problem). Also nudge the dig toward
    // this skill for the rest of the session (adaptive path).
    correctStreak.current = 0;
    const firstMissOnThisProblem = wrongAttempts.current === 0;
    wrongAttempts.current += 1;
    if (problem) {
      weakness.current = bumpSessionWeakness(weakness.current, problem.concept);
      // Count each problem missed once (not every guess) for the revisit nudge.
      if (firstMissOnThisProblem) {
        mistakes.current[problem.concept] = (mistakes.current[problem.concept] ?? 0) + 1;
      }
    }
    if (wrongAttempts.current >= WRONG_GUESSES_TO_EASE && !easedThisProblem.current) {
      easedThisProblem.current = true;
      nextDifficulty.current = clampDifficulty(nextDifficulty.current - 1);
    }
    // Once "Skip this one" is about to appear, prewarm the next (eased) problem so
    // skipping is instant with no "generating" flash.
    if (wrongAttempts.current === MISSES_BEFORE_SKIP) {
      startPrefetch();
    }
  };

  // Move to the next problem. Use the prefetched AI problem only if it finished in
  // time AND still matches the current difficulty; otherwise show an instant local
  // one (the dig never waits on the network). Never reveals the current answer.
  const advanceToNext = () => {
    const ready = prefetchResult.current;
    const usable = ready && prefetchDifficulty.current === nextDifficulty.current;
    prefetchResult.current = null;
    prefetchPromise.current = null;
    if (usable) {
      resetForNewProblem();
      setProblem(ready);
      setShownDifficulty(nextDifficulty.current);
      setPeakLevel((peak) => (nextDifficulty.current > peak ? nextDifficulty.current : peak));
    } else {
      showInstantProblem();
    }
  };

  const handleContinue = () => {
    const solvedNow = solved;
    if (goal !== null && solvedNow >= goal) {
      fireConfetti();
      persist(true, solvedNow, peakLevel);
      setRevisit(rankConceptMistakes(mistakes.current));
      prefetchPromise.current = null;
      prefetchResult.current = null;
      setComplete(true);
      return;
    }
    advanceToNext();
  };

  // No-penalty skip: move on without solving and without showing the answer. The
  // dig still needs its quota of solved problems, so a skip just swaps the puzzle.
  const handleSkip = () => {
    advanceToNext();
  };

  const handleDone = () => {
    persist(false, solved, peakLevel);
    onExit();
  };

  const restart = () => {
    const resume = resumeDifficulty(peakLevel);
    nextDifficulty.current = resume;
    correctStreak.current = 0;
    recordedSolved.current = 0;
    mistakes.current = {};
    setRevisit([]);
    prefetchPromise.current = null;
    prefetchResult.current = null;
    setSolved(0);
    setPeakLevel(resume);
    setComplete(false);
    showInstantProblem();
  };

  if (complete) {
    return (
      <Card padding="lg" className="text-center motion-safe:animate-dialog-in">
        <p className="font-display text-2xl font-bold text-ink">Today's dig is done!</p>
        <p className="mt-2 text-muted">
          You solved {solved} {solved === 1 ? 'problem' : 'problems'} and reached Depth {peakLevel}.
        </p>
        <p className="mt-1 text-sm font-semibold text-gold-700">+{solved * XP_PER_SOLVE} XP</p>
        {revisit.length > 0 && (
          <div className="mx-auto mt-5 max-w-sm rounded-xl border border-parchment-300 bg-parchment-50 px-4 py-3 text-left">
            <p className="text-sm font-semibold text-ink">What to revisit</p>
            <ul className="mt-2 space-y-1">
              {revisit.map((item) => (
                <li key={item.concept} className="text-sm leading-relaxed text-ink/80">
                  <span className="font-semibold text-ink">{CONCEPT_LABELS[item.concept]}</span>
                  <span className="text-muted">
                    {' '}
                    · missed {item.count} {item.count === 1 ? 'problem' : 'problems'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={restart}>Dig again</Button>
          <Button variant="outline" onClick={handleDone}>
            Done
          </Button>
        </div>
      </Card>
    );
  }

  const title = goal !== null ? 'Daily Treasure Dig' : 'Free practice';
  const progress = goal !== null ? `${Math.min(solved, goal)} of ${goal}` : `Solved: ${solved}`;

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold text-ink">{title}</p>
          <p className="mt-0.5 text-sm text-muted">
            {progress}
            {scopeTitle ? ` · up to ${scopeTitle}` : ''}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDone}>
          Done
        </Button>
      </div>

      <LevelMeter level={shownDifficulty} />

      {loading || !step ? (
        <p className="mt-8 text-center text-muted">Getting your first problem…</p>
      ) : (
        <div className="mt-4">
          <McStepView
            key={step.id}
            step={step}
            submitted={submitted}
            feedback={feedback}
            onSubmit={handleSubmit}
            onContinue={handleContinue}
            allowRetry
            onTryAgain={() => {
              setSubmitted(false);
              setFeedback(null);
              setShowSteps(false);
            }}
            secondaryAction={
              // The worked solution names the answer, so it's a review you only
              // unlock AFTER solving correctly, never a way to peek while stuck.
              submitted &&
              problem &&
              feedback?.ok &&
              solutionSteps(problem).length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowSteps((value) => !value)}
                  className="inline-flex items-center gap-1.5 rounded py-1 text-base font-semibold text-brand-700 underline decoration-2 underline-offset-4 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  {showSteps ? 'Hide steps' : 'Show me how'}
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className={`h-4 w-4 transition-transform ${showSteps ? 'rotate-180' : ''}`}
                  >
                    <path
                      d="M4 6l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : submitted &&
                problem &&
                !feedback?.ok &&
                wrongAttempts.current >= MISSES_BEFORE_SKIP ? (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="rounded py-1 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  Skip this one
                </button>
              ) : undefined
            }
          />
          {submitted && problem && showSteps && <WorkedSolution steps={solutionSteps(problem)} />}
        </div>
      )}
    </Card>
  );
}

function LevelMeter({ level }: { level: Difficulty }) {
  return (
    <div className="mt-3 flex items-center gap-2" aria-label={`Depth ${level} of 5`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Depth</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((tick) => (
          <span
            key={tick}
            aria-hidden="true"
            className={`h-2 w-5 rounded-full ${tick <= level ? 'bg-gold-500' : 'bg-parchment-300'}`}
          />
        ))}
      </div>
    </div>
  );
}

/** The faded worked example's steps, revealed below the actions when toggled on
 * (the "Show me how" toggle itself lives in the action bar). */
function WorkedSolution({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="mt-3 space-y-2 rounded-xl border border-brand-100 bg-brand-50 px-5 py-4 text-base leading-relaxed text-brand-900">
      {steps.map((stepText, index) => (
        <li key={index} className="flex gap-2.5">
          <span className="font-semibold text-brand-700">{index + 1}.</span>
          <span>{stepText}</span>
        </li>
      ))}
    </ol>
  );
}
