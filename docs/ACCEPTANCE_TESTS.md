# Acceptance Tests / Manual QA Checklist

A click-through checklist for the whole app. Run it locally (`http://localhost:5173`)
or against the live site (`https://x-pedition.web.app`). Check each box as you go.

## Setup

```bash
npm install
npm run validate:content
npm test
npm run lint
npm run build
npm run dev
```

- [ ] All five commands succeed (content valid, tests pass, no lint errors, build clean).

## Auth and progress persistence

- [ ] Sign up with email/password and a display name (or use Google sign-in).
- [ ] Home greets you by first name.
- [ ] Start Lesson 1, advance a few steps, refresh the browser, confirm it resumes where you were.
- [ ] Sign out and back in; confirm the same progress is restored.
- [ ] Bad credentials show a clear, friendly error (not a raw Firebase code).

## Concept (teaching) pages

- [ ] A lesson opens on a short teaching page, not a wall of text.
- [ ] Fill-in-the-blank: tap a word chip into a blank, and also drag a chip into a blank (both work).
- [ ] A wrong fill shows a teaching hint (it teaches the idea, does not just say "wrong").
- [ ] A correct fill is accepted and you can continue.

## Scaffolded practice (each question type)

- [ ] Multiple choice: pick an answer, Check, get feedback.
- [ ] Balance scale: remove the same weight from both pans, then answer the follow-up; removing from only one side is rejected.
- [ ] Tile combine: drag x-tiles into the combine box and the plain number into its own box.
- [ ] Equal share: split items evenly into groups.
- [ ] Expression builder: build the expression from tokens (a correct reordering like `2 + 3x` is also accepted).
- [ ] Get hint: hints escalate (concept, then the move, then the next step) and never reveal the answer.
- [ ] A wrong answer shows a specific "it looks like you..." misconception note (where applicable).
- [ ] Back button steps to the previous practice question.

## Mastery check

- [ ] A gate screen announces the mastery check (no hints, one try, 2 of 3 to pass).
- [ ] No hint button appears during mastery.
- [ ] Each question is one try only (no retry).
- [ ] Passing 2 of 3 shows the lesson-complete screen with confetti.
- [ ] Failing (1 of 3) shows a "try again later" state with a restart option.

## Self-explanation ("Convince Me")

- [ ] After a correct answer on mastery question 2 or 3, a "why does your answer work?" box appears in place of Continue.
- [ ] A live character counter shows progress to the 12-character minimum; Submit is disabled until then.
- [ ] A genuine explanation is accepted ("Nice thinking!") and awards XP.
- [ ] A guess or "idk" is gently rejected with a nudge and a "try again" option, plus a "continue anyway" escape (never blocks).
- [ ] After an accepted explanation, a "what if" follow-up appears with its own submit and XP; the feedback states the correct idea without contradicting itself.
- [ ] No feedback uses jargon like "cancel" or "get rid of"; none leaks the answer before you explain.

## Lesson complete and review

- [ ] Lesson-complete shows the mastery score ring and, if you missed an interactive step, a "what to revisit" card.
- [ ] Buttons: Keep practicing, Review questions, Back to home (and Restart if you failed).
- [ ] Review mode shows each question, your answer, and the correct answer (no redundant recap).

## Course path / treasure map

- [ ] Home shows the treasure-map path; tapping a lesson node opens that lesson.
- [ ] Passing a lesson unlocks the next; locked lessons cannot be opened early.
- [ ] Completed lessons are marked complete and can be reviewed.
- [ ] Future "filler" sections appear on the path but are not clickable.
- [ ] The streak increments once per day (Central time) after activity, not multiple times in one day.

## Final Challenge (capstone)

- [ ] After all five lessons are complete, the treasure shows a "Final Challenge" invite.
- [ ] The challenge is 5 questions (one per lesson), centered on screen.
- [ ] Getting 4 of 5 passes and unlocks the treasure; 3 or fewer does not.
- [ ] You can retry; each attempt draws fresh puzzles.

## Practice: Daily Treasure Dig and Free practice

- [ ] "Keep practicing" opens a mode chooser (Daily Dig vs Free practice).
- [ ] The first problem appears instantly (no "generating" spinner).
- [ ] The Depth meter (1 to 5) reflects difficulty.
- [ ] Difficulty climbs after a few quick, confident, first-try wins; a slow win does not ramp it.
- [ ] Repeated wrong guesses ease the difficulty down.
- [ ] After 2 misses on one problem, a no-penalty "Skip this one" appears (it never shows the answer).
- [ ] A wrong answer shows a grounded explanation of your specific choice (no answer reveal).
- [ ] "Show me how" appears only after a correct answer (review), never while you are stuck.
- [ ] The Daily Dig ends at 8 solved with a completion screen, XP, and a "what to revisit" summary; "Dig again" restarts.
- [ ] Free practice continues indefinitely.

## Gamification

- [ ] XP, level, and streak show in the header.
- [ ] Earning a badge shows a badge-unlock popup.
- [ ] The Achievements/Badges modal groups badges by category and shows progress.

## AI behavior (on vs off)

- [ ] With AI configured (local dev): the self-explanation judge gives a real verdict, and dig problems include AI-generated variety.
- [ ] With AI off (or unreachable): the app still works fully: instant deterministic hints, deterministic mistake explanations, local verified practice problems, and an encouraging close on self-explanation. Nothing breaks.
- [ ] Note: on the deployed site, the AI judge/generation currently fall back to deterministic until the Cloud Functions are granted public invoker access (see Deployment).

## Responsive

- [ ] At ~390px width: no horizontal scrolling; answer and scale buttons are easy to tap.
- [ ] Map lesson nodes are spaced far enough apart on mobile.
- [ ] At desktop width: the home dashboard and map expand cleanly.

## Deployment

- [ ] `.firebaserc` points at `unknown-algebra`; hosting site is `x-pedition`.
- [ ] `npm run deploy:firebase` builds, deploys Hosting, and publishes Firestore rules.
- [ ] The production bundle contains no API key (`grep -r "sk-" dist/` finds nothing).
- [ ] Cloud Functions (`judgeExplanation`, `followUpFeedback`, `generatePractice`) are deployed; for live AI they must allow unauthenticated invocation (Cloud Run invoker), otherwise the site falls back to deterministic.
- [ ] On the live URL, repeat the auth, resume, course path, practice, and responsive checks.
