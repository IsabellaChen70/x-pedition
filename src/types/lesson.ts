export type ShapeKind = 'triangle' | 'circle' | 'square' | 'box';

export type ScaleItem =
  | { kind: 'shape'; shape: ShapeKind; count: number }
  | { kind: 'weight'; value: number }
  | { kind: 'unknown'; label?: string };

export type ScaleVisualConfig = {
  left: ScaleItem[];
  right: ScaleItem[];
};

export type VisualConfig =
  | { type: 'scale'; config: ScaleVisualConfig }
  | { type: 'none' };

type StepFeedback = {
  correct: string;
  incorrect: string[];
};

/**
 * An authored "what if" transfer question shown after a strong self-explanation
 * (Convince-Me follow-up). The `answer` and `why` are authored, so they are
 * deterministically correct; AI feedback on the learner's reply is GROUNDED in
 * them and can never assert wrong math. `why` is also the reliable AI-off reveal.
 */
export type StepFollowUp = {
  prompt: string;
  answer: string;
  why: string;
};

type ScaleValidation = {
  action: 'remove_from_both';
  value: number;
  expectedUnknown: number;
};

export type McStep = {
  id: string;
  type: 'mc';
  /** After a correct answer, invite the learner to explain their reasoning (rewarded, never blocks). */
  reflect?: boolean;
  prompt: string;
  visual?: VisualConfig;
  options: string[];
  correctIndex: number;
  /** A single conceptual hint (legacy). Prefer `hints` for targeted escalation. */
  hint?: string;
  /** Targeted, escalating, answer-safe hints for THIS question (Hint 1..3). */
  hints?: string[];
  feedback: StepFeedback;
  followUp?: StepFollowUp;
};

type FollowUpMc = {
  prompt: string;
  options: string[];
  correctIndex: number;
  feedback: StepFeedback;
};

export type ScaleInteractiveStep = {
  id: string;
  type: 'scale_interactive';
  /** After a correct answer, invite the learner to explain their reasoning (rewarded, never blocks). */
  reflect?: boolean;
  prompt: string;
  visual: VisualConfig & { type: 'scale' };
  validation: ScaleValidation;
  followUpMc?: FollowUpMc;
  /** A single conceptual hint (legacy). Prefer `hints` for targeted escalation. */
  hint?: string;
  /** Targeted, escalating, answer-safe hints for THIS question (Hint 1..3). */
  hints?: string[];
  feedback: StepFeedback;
  followUp?: StepFollowUp;
};

export type TileCombineStep = {
  id: string;
  type: 'tile_combine';
  /** After a correct answer, invite the learner to explain their reasoning (rewarded, never blocks). */
  reflect?: boolean;
  prompt: string;
  visual: VisualConfig;
  validation: {
    totalTiles: number;
    targetCount: number;
    targetLabel: string;
    tileLabel?: string;
    /** Optional non-like term that must be left OUT of the combine box. */
    distractorLabel?: string;
  };
  /** A single conceptual hint (legacy). Prefer `hints` for targeted escalation. */
  hint?: string;
  /** Targeted, escalating, answer-safe hints for THIS question (Hint 1..3). */
  hints?: string[];
  feedback: StepFeedback;
  followUp?: StepFollowUp;
};

export type EqualShareStep = {
  id: string;
  type: 'equal_share';
  /** After a correct answer, invite the learner to explain their reasoning (rewarded, never blocks). */
  reflect?: boolean;
  prompt: string;
  visual: VisualConfig;
  validation: {
    totalItems: number;
    groupCount: number;
    targetPerGroup: number;
    itemLabel: string;
    groupLabel: string;
    correctAnswer: string;
  };
  /** A single conceptual hint (legacy). Prefer `hints` for targeted escalation. */
  hint?: string;
  /** Targeted, escalating, answer-safe hints for THIS question (Hint 1..3). */
  hints?: string[];
  feedback: StepFeedback;
  followUp?: StepFollowUp;
};

export type ExpressionBuilderStep = {
  id: string;
  type: 'expression_builder';
  /** After a correct answer, invite the learner to explain their reasoning (rewarded, never blocks). */
  reflect?: boolean;
  prompt: string;
  visual: VisualConfig;
  tokens: string[];
  validation: {
    expectedTokens: string[];
    correctAnswer: string;
  };
  /** A single conceptual hint (legacy). Prefer `hints` for targeted escalation. */
  hint?: string;
  /** Targeted, escalating, answer-safe hints for THIS question (Hint 1..3). */
  hints?: string[];
  feedback: StepFeedback;
  followUp?: StepFollowUp;
};

/**
 * A light, unscored "engage before you advance" beat on a single reveal step,
 * so the learner does one quick thing instead of tapping straight through.
 * Optional and backward compatible: a reveal step with no `gate` advances as before.
 *
 * The learner completes a sentence by tapping word chips into its blanks.
 */
export type ConceptStepGate = {
  type: 'fill';
  /** A sentence with one or more blanks marked by exactly `___` (three underscores), in order. */
  template: string;
  /** The correct word for each blank, in order; length must equal the count of `___` in template. */
  answers: string[];
  /** Optional distractor words added to the shuffled chip bank. */
  extras?: string[];
  /** Teaching nudge shown if the blanks are filled wrong, it should TEACH the idea (the learner may not know it yet), not just say "wrong". */
  hint?: string;
};

export type ConceptRevealStep = {
  text: string;
  visual?: VisualConfig;
  gate?: ConceptStepGate;
};

/** A quick "guess the result" beat shown before a scale demo plays. Optional. */
export type ConceptScalePredict = {
  prompt: string;
  options: string[];
  answerIndex: number;
};

export type ConceptInteraction =
  | {
      type: 'reveal';
      steps: ConceptRevealStep[];
      revealLabel?: string;
    }
  | {
      type: 'scale_demo';
      config: ScaleVisualConfig;
      value: number;
      actionLabel: string;
      resultCaption: string;
      predict?: ConceptScalePredict;
    };

/**
 * A short, interactive teaching page shown before practice (Brilliant-style):
 * a brief concept with either a tap-to-reveal worked example or a hands-on
 * "try the move" balance-scale demo. Not scored.
 */
export type ConceptStep = {
  id: string;
  type: 'concept';
  title: string;
  body: string;
  visual?: VisualConfig;
  interaction?: ConceptInteraction;
  continueLabel?: string;
};

export type Step =
  | McStep
  | ScaleInteractiveStep
  | TileCombineStep
  | EqualShareStep
  | ExpressionBuilderStep
  | ConceptStep;

type LessonPhases = {
  scaffolded: Step[];
  mastery: Step[];
};

export type Lesson = {
  id: string;
  title: string;
  description: string;
  phases: LessonPhases;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  lessonOrder: string[];
  lessons: Record<string, { title: string; description: string }>;
};
