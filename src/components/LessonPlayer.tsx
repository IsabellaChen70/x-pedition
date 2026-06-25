import { useCallback, useEffect, useMemo, useState } from 'react';
import { getNextLesson } from '../lib/content';
import {
  countMasteryCorrect,
  masteryPass,
  MASTERY_TOTAL,
} from '../lib/mastery';
import {
  completeLessonProgress,
  getCourseProgress,
  saveLessonProgress,
} from '../lib/progress';
import type { LessonAnswerRecord, LessonProgressSnapshot } from '../lib/progress';
import {
  getStepsForPhase,
  validateEqualShare,
  validateExpressionBuilder,
  validateMcStep,
  validateScaleInteractive,
  validateTileCombine,
} from '../lib/validation';
import type { TileGrouping } from '../lib/validation';
import type {
  EqualShareStep,
  Lesson,
  ScaleInteractiveStep,
  ScaleVisualConfig,
  Step,
} from '../types/lesson';
import EqualShareQuestion from './EqualShareQuestion';
import ExpressionBuilderQuestion from './ExpressionBuilderQuestion';
import { Alert, Button, Card } from './ui';
import ConceptCard from './ConceptCard';
import LessonComplete from './LessonComplete';
import LessonProgress from './LessonProgress';
import LessonReview from './LessonReview';
import McStepView from './McStepView';
import ScaleInteractiveQuestion from './ScaleInteractiveQuestion';
import TileCombineQuestion from './TileCombineQuestion';

type LessonPlayerProps = {
  lesson: Lesson;
  userId: string;
  courseId: string;
  firstLessonId: string;
};

type Phase = 'scaffolded' | 'mastery';

export default function LessonPlayer({ lesson, userId, courseId, firstLessonId }: LessonPlayerProps) {
  const [phase, setPhase] = useState<Phase>('scaffolded');
  const [masteryIntro, setMasteryIntro] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [finished, setFinished] = useState(false);
  const [lessonPassed, setLessonPassed] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [masteryResults, setMasteryResults] = useState<Record<string, boolean>>({});
  const [answerHistory, setAnswerHistory] = useState<Record<string, LessonAnswerRecord>>({});
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  const [scaleConfig, setScaleConfig] = useState<ScaleVisualConfig | null>(null);
  const [removalApplied, setRemovalApplied] = useState(false);
  const [removedFromBoth, setRemovedFromBoth] = useState(false);

  const allMasteryIds = useMemo(
    () => lesson.phases.mastery.map((s) => s.id),
    [lesson.phases.mastery],
  );
  const nextLesson = useMemo(() => getNextLesson(lesson.id), [lesson.id]);

  const buildProgressSnapshot = useCallback(
    (overrides: Partial<LessonProgressSnapshot> = {}): LessonProgressSnapshot => ({
      phase,
      stepIndex,
      masteryResults,
      finished,
      passed: lessonPassed,
      answerHistory,
      ...overrides,
    }),
    [
      answerHistory,
      finished,
      lessonPassed,
      masteryResults,
      phase,
      stepIndex,
    ],
  );

  const persistProgress = useCallback(
    async (snapshot: LessonProgressSnapshot) => {
      try {
        setProgressError(null);
        await saveLessonProgress(userId, courseId, lesson.id, snapshot);
      } catch {
        setProgressError('Progress is not saving right now. You can keep working, but refresh may lose your place.');
      }
    },
    [courseId, lesson.id, userId],
  );

  const persistCompletion = useCallback(
    async (snapshot: LessonProgressSnapshot) => {
      try {
        setProgressError(null);
        await completeLessonProgress(
          userId,
          courseId,
          lesson.id,
          snapshot,
          nextLesson?.id ?? null,
        );
      } catch {
        setProgressError('Lesson finished locally, but progress did not save. Check Firestore setup.');
      }
    },
    [courseId, lesson.id, nextLesson?.id, userId],
  );

  useEffect(() => {
    let active = true;

    async function loadProgress() {
      try {
        setProgressLoaded(false);
        setProgressError(null);
        const progress = await getCourseProgress(userId, courseId, firstLessonId);
        const saved = progress.lessons[lesson.id];
        if (!active) {
          return;
        }

        if (saved) {
          setPhase(saved.phase);
          setStepIndex(saved.stepIndex);
          setMasteryResults(saved.masteryResults ?? {});
          setFinished(saved.finished);
          setLessonPassed(saved.passed);
          setReviewMode(saved.finished);
          setAnswerHistory(saved.answerHistory ?? {});
        } else {
          setPhase('scaffolded');
          setStepIndex(0);
          setMasteryResults({});
          setFinished(false);
          setLessonPassed(false);
          setReviewMode(false);
          setAnswerHistory({});
        }
      } catch {
        if (active) {
          setProgressError('Could not load saved progress. Make sure Firestore is enabled.');
        }
      } finally {
        if (active) {
          setProgressLoaded(true);
        }
      }
    }

    void loadProgress();

    return () => {
      active = false;
    };
  }, [courseId, firstLessonId, lesson.id, userId]);

  const steps = useMemo(
    () => getStepsForPhase(lesson, phase),
    [lesson, phase],
  );

  const step: Step | undefined = steps[stepIndex];

  const resetStepState = useCallback(() => {
    setSubmitted(false);
    setFeedback(null);
    setScaleConfig(null);
    setRemovalApplied(false);
    setRemovedFromBoth(false);
  }, []);

  const evaluateMastery = useCallback(() => {
    // Mastery is a single, no-retry check; practice already gives the second tries.
    const correctCount = countMasteryCorrect(allMasteryIds, masteryResults);
    const passed = masteryPass(correctCount);
    setLessonPassed(passed);
    setFinished(true);
    void persistCompletion(buildProgressSnapshot({ finished: true, passed }));
  }, [allMasteryIds, buildProgressSnapshot, masteryResults, persistCompletion]);

  const goToNextStep = useCallback(() => {
    resetStepState();
    if (stepIndex + 1 < steps.length) {
      const nextStepIndex = stepIndex + 1;
      setStepIndex(nextStepIndex);
      void persistProgress(buildProgressSnapshot({ stepIndex: nextStepIndex }));
      return;
    }

    if (phase === 'scaffolded') {
      setPhase('mastery');
      setStepIndex(0);
      // Gate the shift to the mastery check so the change in stakes is a clear moment.
      setMasteryIntro(true);
      void persistProgress(buildProgressSnapshot({
        phase: 'mastery',
        stepIndex: 0,
      }));
      return;
    }

    evaluateMastery();
  }, [
    buildProgressSnapshot,
    evaluateMastery,
    persistProgress,
    phase,
    resetStepState,
    stepIndex,
    steps.length,
  ]);

  const recordMasteryResult = useCallback(
    (stepId: string, ok: boolean) => {
      if (phase !== 'mastery') {
        return;
      }
      setMasteryResults((prev) => ({ ...prev, [stepId]: ok }));
    },
    [phase],
  );

  const recordAnswer = useCallback(
    (record: Omit<LessonAnswerRecord, 'phase' | 'attempts'>) => {
      const previousAttempts = answerHistory[record.stepId]?.attempts ?? [];
      const nextHistory = {
        ...answerHistory,
        [record.stepId]: {
          ...record,
          phase,
          attempts: [...previousAttempts, record.answer],
        },
      };
      setAnswerHistory(nextHistory);
      return nextHistory;
    },
    [answerHistory, phase],
  );

  const handleMcSubmit = (selectedIndex: number) => {
    if (step?.type !== 'mc') {
      return;
    }
    const result = validateMcStep(step, selectedIndex);
    setFeedback({ ok: result.ok, message: result.message });
    setSubmitted(true);
    const nextAnswerHistory = recordAnswer({
      stepId: step.id,
      ok: result.ok,
      answer: step.options[selectedIndex] ?? 'No answer',
      correctAnswer: step.options[step.correctIndex] ?? 'Correct answer unavailable',
    });
    void persistProgress(buildProgressSnapshot({ answerHistory: nextAnswerHistory }));
    recordMasteryResult(step.id, result.ok);
  };

  const handleScaleSubmit = (mcIndex: number | null) => {
    if (step?.type !== 'scale_interactive') {
      return;
    }
    const result = validateScaleInteractive(step, {
      removed: removalApplied,
      removedFromBoth,
      mcIndex,
    });
    setFeedback({ ok: result.ok, message: result.message });
    setSubmitted(true);
    const nextAnswerHistory = recordAnswer({
      stepId: step.id,
      ok: result.ok,
      answer: getScaleAnswerLabel(step, mcIndex),
      correctAnswer: getScaleCorrectAnswerLabel(step),
    });
    void persistProgress(buildProgressSnapshot({ answerHistory: nextAnswerHistory }));
    recordMasteryResult(step.id, result.ok);
  };

  const handleTileSubmit = (grouped: TileGrouping) => {
    if (step?.type !== 'tile_combine') {
      return;
    }
    const result = validateTileCombine(step, grouped);
    setFeedback({ ok: result.ok, message: result.message });
    setSubmitted(true);
    const nextAnswerHistory = recordAnswer({
      stepId: step.id,
      ok: result.ok,
      answer: getTileAnswerLabel(step, grouped),
      correctAnswer: step.validation.targetLabel,
    });
    void persistProgress(buildProgressSnapshot({ answerHistory: nextAnswerHistory }));
    recordMasteryResult(step.id, result.ok);
  };

  const handleEqualShareSubmit = (groupCounts: number[]) => {
    if (step?.type !== 'equal_share') {
      return;
    }
    const result = validateEqualShare(step, groupCounts);
    setFeedback({ ok: result.ok, message: result.message });
    setSubmitted(true);
    const nextAnswerHistory = recordAnswer({
      stepId: step.id,
      ok: result.ok,
      answer: getEqualShareAnswerLabel(step, groupCounts),
      correctAnswer: step.validation.correctAnswer,
    });
    void persistProgress(buildProgressSnapshot({ answerHistory: nextAnswerHistory }));
    recordMasteryResult(step.id, result.ok);
  };

  const handleExpressionSubmit = (tokens: string[]) => {
    if (step?.type !== 'expression_builder') {
      return;
    }
    const result = validateExpressionBuilder(step, tokens);
    setFeedback({ ok: result.ok, message: result.message });
    setSubmitted(true);
    const nextAnswerHistory = recordAnswer({
      stepId: step.id,
      ok: result.ok,
      answer: tokens.join(' '),
      correctAnswer: step.validation.correctAnswer,
    });
    void persistProgress(buildProgressSnapshot({ answerHistory: nextAnswerHistory }));
    recordMasteryResult(step.id, result.ok);
  };

  const handleScaleTryAgain = () => {
    setSubmitted(false);
    setFeedback(null);
    setScaleConfig(null);
    setRemovalApplied(false);
    setRemovedFromBoth(false);
  };

  const handleTryAgain = () => {
    setSubmitted(false);
    setFeedback(null);
  };

  // Step back through the practice/teaching phase only; the mastery check stays one-way.
  const canGoBack = phase === 'scaffolded' && stepIndex > 0 && !finished;
  const handleBack = () => {
    if (!canGoBack) {
      return;
    }
    const previousIndex = stepIndex - 1;
    resetStepState();
    setStepIndex(previousIndex);
    void persistProgress(buildProgressSnapshot({ stepIndex: previousIndex }));
  };

  const handleScaleRemoval = (config: ScaleVisualConfig, fromBoth: boolean) => {
    setScaleConfig(config);
    setRemovalApplied(true);
    setRemovedFromBoth(fromBoth);
  };

  const handleRestartLesson = () => {
    const snapshot = buildProgressSnapshot({
      phase: 'scaffolded',
      stepIndex: 0,
      masteryResults: {},
      finished: false,
      passed: false,
      answerHistory: {},
    });
    setPhase('scaffolded');
    setMasteryIntro(false);
    setStepIndex(0);
    setSubmitted(false);
    setFeedback(null);
    setFinished(false);
    setLessonPassed(false);
    setReviewMode(false);
    setMasteryResults({});
    setAnswerHistory({});
    setScaleConfig(null);
    setRemovalApplied(false);
    setRemovedFromBoth(false);
    void persistProgress(snapshot);
  };

  if (!progressLoaded) {
    return (
      <Card padding="lg" className="text-center text-muted">
        Loading saved progress...
      </Card>
    );
  }

  if (finished) {
    const masteryCorrect = countMasteryCorrect(allMasteryIds, masteryResults);
    if (reviewMode) {
      return (
        <LessonReview
          lesson={lesson}
          answerHistory={answerHistory}
          onRestart={handleRestartLesson}
        />
      );
    }

    return (
      <>
        {progressError && (
          <Alert variant="warning" className="mb-4">
            {progressError}
          </Alert>
        )}
        <LessonComplete
          lessonTitle={lesson.title}
          masteryCorrect={masteryCorrect}
          masteryTotal={MASTERY_TOTAL}
          passed={lessonPassed}
          nextLesson={nextLesson ?? undefined}
          onReview={() => setReviewMode(true)}
          onRestart={handleRestartLesson}
        />
      </>
    );
  }

  if (masteryIntro) {
    return (
      <div>
        {progressError && (
          <Alert variant="warning" className="mb-4">
            {progressError}
          </Alert>
        )}
        <MasteryIntro onBegin={() => setMasteryIntro(false)} />
      </div>
    );
  }

  if (!step) {
    return <p className="text-muted">No step found.</p>;
  }

  const displayScaleConfig =
    step.type === 'scale_interactive' ? (scaleConfig ?? step.visual.config) : null;

  const isScaffolded = phase === 'scaffolded';
  const stepHint = 'hint' in step ? step.hint : undefined;

  return (
    <div>
      {progressError && (
        <Alert variant="warning" className="mb-4">
          {progressError}
        </Alert>
      )}

      <LessonProgress
        phase={phase}
        stepIndex={stepIndex}
        totalSteps={steps.length}
        label={step.type === 'concept' ? 'Learn' : undefined}
      />

      {step.type === 'concept' && (
        <ConceptCard
          key={`${phase}-${step.id}`}
          step={step}
          onContinue={goToNextStep}
          onBack={handleBack}
          canGoBack={canGoBack}
        />
      )}

      {step.type !== 'concept' && (
        <Card padding="lg">
      {step.type === 'mc' && (
        <McStepView
          key={`${phase}-${step.id}`}
          step={step}
          submitted={submitted}
          feedback={feedback}
          onSubmit={handleMcSubmit}
          onContinue={goToNextStep}
          allowRetry={isScaffolded}
          onTryAgain={handleTryAgain}
          onBack={handleBack}
          canGoBack={canGoBack}
          hint={isScaffolded ? stepHint : undefined}
        />
      )}

      {step.type === 'scale_interactive' && displayScaleConfig && (
        <ScaleInteractiveQuestion
          key={`${phase}-${step.id}`}
          step={step}
          submitted={submitted}
          feedback={feedback}
          scaleConfig={displayScaleConfig}
          removalApplied={removalApplied}
          removedFromBoth={removedFromBoth}
          allowRetry={isScaffolded}
          onApplyRemoval={handleScaleRemoval}
          onSubmit={handleScaleSubmit}
          onContinue={goToNextStep}
          onTryAgain={handleScaleTryAgain}
          onBack={handleBack}
          canGoBack={canGoBack}
          hint={isScaffolded ? stepHint : undefined}
        />
      )}

      {step.type === 'tile_combine' && (
        <TileCombineQuestion
          key={`${phase}-${step.id}`}
          step={step}
          submitted={submitted}
          feedback={feedback}
          allowRetry={isScaffolded}
          onSubmit={handleTileSubmit}
          onContinue={goToNextStep}
          onTryAgain={handleTryAgain}
          onBack={handleBack}
          canGoBack={canGoBack}
          hint={isScaffolded ? stepHint : undefined}
        />
      )}

      {step.type === 'equal_share' && (
        <EqualShareQuestion
          key={`${phase}-${step.id}`}
          step={step}
          submitted={submitted}
          feedback={feedback}
          allowRetry={isScaffolded}
          onSubmit={handleEqualShareSubmit}
          onContinue={goToNextStep}
          onTryAgain={handleTryAgain}
          onBack={handleBack}
          canGoBack={canGoBack}
          hint={isScaffolded ? stepHint : undefined}
        />
      )}

      {step.type === 'expression_builder' && (
        <ExpressionBuilderQuestion
          key={`${phase}-${step.id}`}
          step={step}
          submitted={submitted}
          feedback={feedback}
          allowRetry={isScaffolded}
          onSubmit={handleExpressionSubmit}
          onContinue={goToNextStep}
          onTryAgain={handleTryAgain}
          onBack={handleBack}
          canGoBack={canGoBack}
          hint={isScaffolded ? stepHint : undefined}
        />
      )}
        </Card>
      )}
    </div>
  );
}

function getScaleAnswerLabel(step: ScaleInteractiveStep, mcIndex: number | null): string {
  if (step.followUpMc) {
    const choice = mcIndex === null ? null : step.followUpMc.options[mcIndex];
    return choice
      ? `Removed ${step.validation.value} lb from both sides, then chose ${choice}`
      : `Removed ${step.validation.value} lb from both sides`;
  }

  return `Removed ${step.validation.value} lb from both sides`;
}

function getScaleCorrectAnswerLabel(step: ScaleInteractiveStep): string {
  if (step.followUpMc) {
    return step.followUpMc.options[step.followUpMc.correctIndex] ??
      `${step.validation.expectedUnknown}`;
  }

  return `${step.validation.expectedUnknown}`;
}

function getTileAnswerLabel(
  step: Extract<Step, { type: 'tile_combine' }>,
  grouped: TileGrouping,
): string {
  if (grouped.misplaced > 0) {
    return 'Sorted a tile into the wrong box';
  }
  const tileLabel = step.validation.tileLabel ?? 'x';
  const xPart = grouped.xCombined > 0 ? `${grouped.xCombined}${tileLabel}` : '';
  const constPart =
    grouped.constantsKept > 0 && step.validation.distractorLabel
      ? step.validation.distractorLabel
      : '';
  return [xPart, constPart].filter(Boolean).join(' + ') || 'No tiles placed';
}

function getEqualShareAnswerLabel(step: EqualShareStep, groupCounts: number[]): string {
  return groupCounts
    .map((count, index) => `${step.validation.groupLabel} ${index + 1}: ${count}`)
    .join(', ');
}

/** The gate between practice and the mastery check, so the change in stakes lands. */
function MasteryIntro({ onBegin }: { onBegin: () => void }) {
  return (
    <Card padding="lg" className="text-center motion-safe:animate-dialog-in">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-400 text-ink shadow-sm">
        <FlagIcon />
      </div>
      <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-brand-700">
        Practice complete
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold text-ink">Mastery check</h2>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        You finished the practice. Time to show what you've got.
      </p>
      <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm font-medium text-ink">
        <li className="flex items-center gap-2">
          <Bullet /> No hints this time
        </li>
        <li className="flex items-center gap-2">
          <Bullet /> One try per question
        </li>
        <li className="flex items-center gap-2">
          <Bullet /> Get 2 of 3 right to pass
        </li>
      </ul>
      <Button onClick={onBegin} className="mt-6">
        Start mastery check
      </Button>
    </Card>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      <path d="M6 3v18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6 4h11l-3 3.5L17 11H6z" fill="currentColor" />
    </svg>
  );
}

function Bullet() {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" aria-hidden="true" />;
}

