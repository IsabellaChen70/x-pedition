---
name: lesson-author
description: >-
  Author or edit lessons for the X-pedition algebra app (the
  content/lessons/*.json files). Use when adding a new lesson, writing or
  revising questions, hints, or explanations, or filling in a course section.
  Covers the lesson JSON structure, the available step types, the learner-
  persona tone rules, and how to validate the content.
---

# Lesson Author

Authoring and editing the algebra lessons in this repo. Lessons are JSON files
in `content/lessons/`, registered in `content/course.json`, validated by
`scripts/validate-content.mjs`, and rendered by the components in `src/components/`.

## Before writing: read the source of truth

The exact schema lives in the code, so match it rather than guessing:

1. Read an existing lesson end to end, e.g. `content/lessons/lesson-01.json`
   (balance-scale intro) and `content/lessons/lesson-05.json` (expressions).
2. Read `scripts/validate-content.mjs` for the allowed step types and required fields.
3. Read `content/course.json` for how lessons are titled and ordered.

## Lesson shape

Each lesson is `{ id, title, description, phases: { scaffolded: [...], mastery: [...] } }`.

- `scaffolded` is the teach-and-practice phase: it may mix `concept` teaching
  steps with question steps, and questions allow a hint, retries, and an explanation.
- `mastery` is the graded check: three questions, no hints, one try each, two of
  three to pass. Keep mastery questions self-contained (no `concept`, no `hint`).

## Step types

Pick the type that fits the idea (see existing lessons for the exact fields):

- `concept` — a teaching card; optional `interaction` (`reveal` tap-through or `scale_demo`).
- `mc` — multiple choice; `options`, `correctIndex`, optional `visual` (`scale` or `none`).
- `scale_interactive` — balance-scale solve (remove weight from both sides), optional `followUpMc`.
- `tile_combine` — sort tiles into an x-terms box and a constant box (combining like terms).
- `equal_share` — split items equally into groups (division intuition).
- `expression_builder` — drag tokens to build an expression (addition is accepted in any order).

Use `"visual": { "type": "none" }` only put a balance `scale` visual on questions
that are actually equations to balance, never on a plain simplify/identify question.

## Register the lesson

Add the new lesson to `content/course.json`: append its id to `lessonOrder` and add
a `lessons[<id>]` entry with a short `title` and `description`.

## Tone and pedagogy (persona: an anxious ~12-13 year old)

- Warm, encouraging, plain language. Never use an em dash. Labels are plain labels, no marketing words.
- Hints guide thinking and never give the answer (no "the answer is 5", no goal number that reveals it).
- Wrong-answer feedback explains the idea so the learner reasons it out next time;
  it must not state the correct answer or rely on a visual that shows it.
- Correct-answer feedback briefly reinforces why it works.

## Validate (always, until clean)

```bash
npm run validate:content
npm test
```

Fix every reported issue and re-run until both pass, then `npm run build` to be safe.
