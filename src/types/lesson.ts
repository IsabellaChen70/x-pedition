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

type StepExplanation = {
  title: string;
  body: string;
};

type ScaleValidation = {
  action: 'remove_from_both';
  value: number;
  expectedUnknown: number;
};

export type McStep = {
  id: string;
  type: 'mc';
  prompt: string;
  visual?: VisualConfig;
  options: string[];
  correctIndex: number;
  hint?: string;
  feedback: StepFeedback;
  explanation?: StepExplanation;
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
  prompt: string;
  visual: VisualConfig & { type: 'scale' };
  validation: ScaleValidation;
  followUpMc?: FollowUpMc;
  hint?: string;
  feedback: StepFeedback;
  explanation?: StepExplanation;
};

export type TileCombineStep = {
  id: string;
  type: 'tile_combine';
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
  hint?: string;
  feedback: StepFeedback;
  explanation?: StepExplanation;
};

export type EqualShareStep = {
  id: string;
  type: 'equal_share';
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
  hint?: string;
  feedback: StepFeedback;
  explanation?: StepExplanation;
};

export type ExpressionBuilderStep = {
  id: string;
  type: 'expression_builder';
  prompt: string;
  visual: VisualConfig;
  tokens: string[];
  validation: {
    expectedTokens: string[];
    correctAnswer: string;
  };
  hint?: string;
  feedback: StepFeedback;
  explanation?: StepExplanation;
};

type ConceptRevealStep = {
  text: string;
  visual?: VisualConfig;
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
