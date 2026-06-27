#!/usr/bin/env node
/**
 * Validates lesson JSON files against the PRD content model.
 * Run: npm run validate:content
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const contentDir = join(root, 'content');
const lessonsDir = join(contentDir, 'lessons');

const STEP_TYPES = new Set([
  'mc',
  'scale_interactive',
  'tile_combine',
  'equal_share',
  'expression_builder',
  'concept',
]);
const errors = [];

function err(msg) {
  errors.push(msg);
}

function validateFeedback(feedback, stepId, required = true) {
  if (!feedback) {
    if (required) err(`${stepId}: missing feedback`);
    return;
  }
  if (typeof feedback.correct !== 'string' || !feedback.correct.trim()) {
    err(`${stepId}: feedback.correct must be a non-empty string`);
  }
  if (!Array.isArray(feedback.incorrect) || feedback.incorrect.length === 0) {
    err(`${stepId}: feedback.incorrect must be a non-empty array`);
  }
}

function validateFollowUp(followUp, where) {
  if (typeof followUp !== 'object' || followUp === null) {
    err(`${where}: followUp must be an object`);
    return;
  }
  for (const key of ['prompt', 'answer', 'why']) {
    if (typeof followUp[key] !== 'string' || !followUp[key].trim()) {
      err(`${where}: followUp.${key} must be a non-empty string`);
    }
  }
}

function validateConceptGate(gate, where) {
  if (!gate || gate.type !== 'fill') {
    err(`${where}: gate.type must be "fill"`);
    return;
  }
  if (typeof gate.template !== 'string' || !gate.template.trim()) {
    err(`${where}: fill gate needs a non-empty "template"`);
    return;
  }
  if (
    !Array.isArray(gate.answers) ||
    gate.answers.length === 0 ||
    !gate.answers.every((answer) => typeof answer === 'string' && answer.trim())
  ) {
    err(`${where}: fill gate "answers" must be a non-empty array of non-empty strings`);
    return;
  }
  const blankCount = gate.template.split('___').length - 1;
  if (blankCount !== gate.answers.length) {
    err(
      `${where}: fill gate template has ${blankCount} blank(s) marked by "___" but ${gate.answers.length} answer(s)`,
    );
  }
  if (
    gate.extras !== undefined &&
    (!Array.isArray(gate.extras) || !gate.extras.every((extra) => typeof extra === 'string' && extra.trim()))
  ) {
    err(`${where}: fill gate "extras" must be an array of non-empty strings`);
  }
  if (gate.hint !== undefined && (typeof gate.hint !== 'string' || !gate.hint.trim())) {
    err(`${where}: fill gate "hint" must be a non-empty string`);
  }
}

function validateConceptPredict(predict, id) {
  if (typeof predict.prompt !== 'string' || !predict.prompt.trim()) {
    err(`${id}: scale_demo predict needs a non-empty "prompt"`);
  }
  if (!Array.isArray(predict.options) || predict.options.length < 2) {
    err(`${id}: scale_demo predict needs at least 2 options`);
  }
  if (
    typeof predict.answerIndex !== 'number' ||
    predict.answerIndex < 0 ||
    predict.answerIndex >= (predict.options?.length ?? 0)
  ) {
    err(`${id}: scale_demo predict has an invalid answerIndex`);
  }
}

function validateConceptStep(step, id) {
  if (!step.title || typeof step.title !== 'string') err(`${id}: concept step needs a title`);
  if (!step.body || typeof step.body !== 'string') err(`${id}: concept step needs a body`);

  const interaction = step.interaction;
  if (!interaction) return;

  if (!['reveal', 'scale_demo'].includes(interaction.type)) {
    err(`${id}: concept interaction.type must be "reveal" or "scale_demo"`);
    return;
  }

  if (interaction.type === 'reveal') {
    if (!Array.isArray(interaction.steps) || interaction.steps.length === 0) {
      err(`${id}: reveal interaction needs a non-empty steps array`);
      return;
    }
    interaction.steps.forEach((revealStep, i) => {
      if (!revealStep || typeof revealStep.text !== 'string' || !revealStep.text.trim()) {
        err(`${id}: reveal step ${i} needs non-empty text`);
      }
      if (revealStep?.gate) validateConceptGate(revealStep.gate, `${id} reveal step ${i}`);
    });
    return;
  }

  // scale_demo
  if (interaction.predict) validateConceptPredict(interaction.predict, id);
}

function validateStep(step, phase, lessonId) {
  const id = `${lessonId}.${step.id}`;

  if (!step.id || typeof step.id !== 'string') err(`${lessonId}: step missing id`);
  if (!STEP_TYPES.has(step.type)) err(`${id}: invalid type "${step.type}"`);

  if (step.type === 'concept') {
    validateConceptStep(step, id);
    return;
  }

  if (!step.prompt || typeof step.prompt !== 'string') err(`${id}: missing prompt`);
  validateFeedback(step.feedback, id);
  if (step.followUp !== undefined) validateFollowUp(step.followUp, id);

  const hasHint = typeof step.hint === 'string' && step.hint.trim();
  const hasHints = Array.isArray(step.hints) && step.hints.length > 0;
  if (phase === 'scaffolded') {
    if (!hasHint && !hasHints) {
      err(`${id}: scaffolded step needs a "hint" or a non-empty "hints" array`);
    }
  } else if (phase === 'mastery' && (step.hint || step.hints)) {
    err(`${id}: mastery step must not have hint(s)`);
  }
  if (step.hints !== undefined) {
    if (
      !Array.isArray(step.hints) ||
      step.hints.length === 0 ||
      !step.hints.every((hint) => typeof hint === 'string' && hint.trim())
    ) {
      err(`${id}: "hints" must be a non-empty array of non-empty strings`);
    }
  }

  if (step.type === 'mc') {
    if (!Array.isArray(step.options) || step.options.length < 2) {
      err(`${id}: mc step needs at least 2 options`);
    }
    if (
      typeof step.correctIndex !== 'number' ||
      step.correctIndex < 0 ||
      step.correctIndex >= (step.options?.length ?? 0)
    ) {
      err(`${id}: mc step has invalid correctIndex`);
    }
  }

  if (step.type === 'scale_interactive') {
    if (step.visual?.type !== 'scale') err(`${id}: scale_interactive requires scale visual`);
    if (!step.validation?.action) err(`${id}: scale_interactive missing validation`);
    if (step.validation?.action === 'remove_from_both') {
      if (typeof step.validation.value !== 'number') err(`${id}: validation.value must be a number`);
      if (typeof step.validation.expectedUnknown !== 'number') {
        err(`${id}: validation.expectedUnknown must be a number`);
      }
    }
  }

  if (step.type === 'tile_combine') {
    if (typeof step.validation?.totalTiles !== 'number' || step.validation.totalTiles < 2) {
      err(`${id}: tile_combine validation.totalTiles must be a number >= 2`);
    }
    if (typeof step.validation?.targetCount !== 'number' || step.validation.targetCount < 2) {
      err(`${id}: tile_combine validation.targetCount must be a number >= 2`);
    }
    if (step.validation?.targetCount > step.validation?.totalTiles) {
      err(`${id}: tile_combine targetCount cannot exceed totalTiles`);
    }
    if (!step.validation?.targetLabel || typeof step.validation.targetLabel !== 'string') {
      err(`${id}: tile_combine validation.targetLabel must be a non-empty string`);
    }
  }

  if (step.type === 'equal_share') {
    if (typeof step.validation?.totalItems !== 'number' || step.validation.totalItems < 2) {
      err(`${id}: equal_share validation.totalItems must be a number >= 2`);
    }
    if (typeof step.validation?.groupCount !== 'number' || step.validation.groupCount < 2) {
      err(`${id}: equal_share validation.groupCount must be a number >= 2`);
    }
    if (typeof step.validation?.targetPerGroup !== 'number' || step.validation.targetPerGroup < 1) {
      err(`${id}: equal_share validation.targetPerGroup must be a number >= 1`);
    }
    if (step.validation?.totalItems !== step.validation?.groupCount * step.validation?.targetPerGroup) {
      err(`${id}: equal_share totalItems must equal groupCount * targetPerGroup`);
    }
    if (!step.validation?.itemLabel || typeof step.validation.itemLabel !== 'string') {
      err(`${id}: equal_share validation.itemLabel must be a non-empty string`);
    }
    if (!step.validation?.groupLabel || typeof step.validation.groupLabel !== 'string') {
      err(`${id}: equal_share validation.groupLabel must be a non-empty string`);
    }
    if (!step.validation?.correctAnswer || typeof step.validation.correctAnswer !== 'string') {
      err(`${id}: equal_share validation.correctAnswer must be a non-empty string`);
    }
  }

  if (step.type === 'expression_builder') {
    if (!Array.isArray(step.tokens) || step.tokens.length < 2) {
      err(`${id}: expression_builder tokens must be an array with at least 2 tokens`);
    }
    if (!Array.isArray(step.validation?.expectedTokens) || step.validation.expectedTokens.length < 2) {
      err(`${id}: expression_builder validation.expectedTokens must be an array with at least 2 tokens`);
    }
    if (!step.validation?.correctAnswer || typeof step.validation.correctAnswer !== 'string') {
      err(`${id}: expression_builder validation.correctAnswer must be a non-empty string`);
    }
  }
}

function validateLesson(lesson, filename) {
  const lessonId = lesson.id ?? filename.replace('.json', '');

  if (!lesson.id) err(`${filename}: missing lesson id`);
  if (!lesson.title) err(`${lessonId}: missing title`);
  if (!lesson.phases?.scaffolded || !lesson.phases?.mastery) {
    err(`${lessonId}: missing phases.scaffolded or phases.mastery`);
    return;
  }

  const { scaffolded, mastery } = lesson.phases;

  // Teaching (concept) pages don't count toward the question budget.
  const questionSteps = scaffolded.filter((s) => s.type !== 'concept');
  if (questionSteps.length < 3 || questionSteps.length > 5) {
    err(`${lessonId}: scaffolded should have 3–5 question steps (has ${questionSteps.length})`);
  }
  if (mastery.length !== 3) {
    err(`${lessonId}: mastery should have exactly 3 steps (has ${mastery.length})`);
  }
  // The 2nd and 3rd mastery questions are the self-explanation (reflect) moments
  // (see shouldReflect in LessonPlayer), so each must carry an authored followUp twist.
  for (const i of [1, 2]) {
    if (mastery[i] && !mastery[i].followUp) {
      err(`${lessonId}: mastery step index ${i} (reflect) is missing a followUp twist`);
    }
  }

  const hasInteractive = scaffolded.some((s) => (
    s.type === 'scale_interactive' ||
    s.type === 'tile_combine' ||
    s.type === 'equal_share' ||
    s.type === 'expression_builder'
  ));
  if (!hasInteractive) {
    err(`${lessonId}: scaffolded must include at least one interactive step`);
  }

  for (const step of scaffolded) validateStep(step, 'scaffolded', lessonId);
  for (const step of mastery) validateStep(step, 'mastery', lessonId);
}

// Validate course.json
const course = JSON.parse(readFileSync(join(contentDir, 'course.json'), 'utf8'));
if (!course.lessonOrder?.length) err('course.json: missing lessonOrder');
for (const lessonId of course.lessonOrder ?? []) {
  if (!course.lessons?.[lessonId]?.title) {
    err(`course.json: missing metadata for ${lessonId}`);
  }
}

// Validate each lesson file
const lessonFiles = readdirSync(lessonsDir).filter((f) => f.endsWith('.json'));
for (const file of lessonFiles) {
  const lesson = JSON.parse(readFileSync(join(lessonsDir, file), 'utf8'));
  validateLesson(lesson, file);
  if (course.lessonOrder && !course.lessonOrder.includes(lesson.id)) {
    err(`${lesson.id}: not listed in course.json lessonOrder`);
  }
}

for (const lessonId of course.lessonOrder ?? []) {
  if (lessonId === 'lesson-01' && !lessonFiles.includes(`${lessonId}.json`)) {
    err(`Missing required file: content/lessons/${lessonId}.json`);
  } else if (!lessonFiles.includes(`${lessonId}.json`)) {
    console.warn(`Note: ${lessonId}.json not yet authored (expected in a later PR)`);
  }
}

if (errors.length > 0) {
  console.error('Content validation failed:\n');
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}

console.log(`Content OK — ${lessonFiles.length} lesson file(s), ${course.lessonOrder.length} in course order.`);
