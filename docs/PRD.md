# Product Requirements Document (PRD)

**Product:** **Unknown** — algebra learn-by-doing app  
**Version:** 1.0 — Phase 1 MVP · **Updated:** June 22, 2026  
**Assignment:** Build Brilliant — A Learn-by-Doing App for One Subject  
**Phase scope:** Phase 1 only. No AI. No Phase 2/3 features.

---

## 1. Problem statement

Most learning apps show Maya a video, then a quiz. She memorizes steps, gets a red X when wrong, and still does not understand *why* `x + 3 = 7` works. In class she is afraid to ask questions. At home she needs something that lets her **try, fail safely, and figure it out herself** — in five to ten minutes, on whatever device is nearby.

This product **is a Brilliant clone in the ways that matter for learning** — but only the key aspects, scoped to one persona. It is not feature-parity with the full Brilliant platform.

---

## 2. Product vision

A responsive web app where Maya signs in, works through a short linear course of interactive algebra lessons, manipulates balance scales and tiles, gets instant kind feedback when she is wrong, passes a no-hint mastery check, and sees her streak grow — on her phone after school or on a laptop at the kitchen table. The app teaches without AI and proves the core experience works before anything smarter is added.

### 2.1 Relationship to Brilliant

The assignment asks us to model the product on Brilliant. **Technically, this is a Brilliant clone — but deliberately limited to the core mechanics that make Brilliant work for a learner like Maya**, not a copy of the entire platform.

| Brilliant aspect we clone | How we implement it |
|---------------------------|---------------------|
| Learn by doing | Interactive problems, not video lectures |
| Action before theory | Shapes on scales before introducing `x` |
| Balance-scale algebra | Primary visual metaphor (Solving Equations course) |
| Scaffolded → mastery rhythm | Hand-holding questions + explanation pages, then 3 no-hint mastery Q |
| Instant, specific feedback | Pre-written copy on every answer |
| Visual / manipulable lessons | Scale drag/tap, tile combine (≥1 interactive per lesson) |
| Structured content model | Lessons as JSON steps, not HTML blobs |
| Course path | Linear unlock through 5–6 lessons in one subject |
| Habit loop | Daily streak, continue CTA, lesson-complete moment |

| Brilliant aspect we do **not** clone | Why |
|--------------------------------------|-----|
| Full course library (50+ lessons, 1000+ problems) | Depth for Maya, not breadth |
| Koji AI tutor | Phase 2; banned in MVP |
| Leagues, XP, levels, badges | Streak + completion is enough for her |
| Multiple subjects and algebra "lenses" | One subject, one path |
| Practice sets, review sets, spaced repetition | Phase 3 |
| Premium tiers, educator dashboard, offline | Wrong scope for MVP |

**Positioning:** A focused Brilliant-style experience for early algebra — built for Maya, not a platform rebuild.

---

## 3. Domain

### 3.1 Subject

**Algebra** — early solving equations and expressions, using a balance-scale and tile mental model.

### 3.2 Course

**Title:** Solving Equations (Intro) · **Audience:** Maya only. All copy, difficulty, and tone tuned for her.

### 3.3 In scope (mathematical)

| Topic | Examples |
|-------|----------|
| Finding unknowns (concrete) | Shapes on scales before `x` |
| Variables | `x` as a name for an unknown |
| One-step equations | `x + 3 = 7`, `x − 2 = 6`, `10 = x + 4` |
| Combining like terms | `2x + x = 3x`, then solve |
| Writing expressions | "5 more than a number" → `x + 5` |
| Two unknowns (optional L6) | `x + y = 10`, `x = 4` — no coefficients |

**Constraints:** whole numbers only; coefficients ≤ 3; no negatives, fractions, distributive property, graphing, or two-step equations.

### 3.4 Out of scope (mathematical)

Two-step equations, inequalities, distributive property, factoring, quadratics, graphing, word-problem systems, anything requiring a calculator.

---

## 4. User persona: Maya

| Attribute | Detail |
|-----------|--------|
| Age / grade | 12–13, 7th grade |
| Context | First algebra unit; has seen `x` but does not trust it |
| Mindset | Anxious about being wrong; avoids asking for help |
| Learning style | Needs to *do* something before a rule makes sense |
| Session length | 5–10 minutes |
| Devices | Phone after school; laptop/desktop at home |
| Goal | Understand what `x` means; solve basic one-step equations |
| Success signal | Wrong → hint → fix herself → finish lesson → return tomorrow |

### Design principles

1. **Concrete before abstract** — shapes on scales before the symbol `x`.
2. **Warm, never condescending** — no "obvious!", no jargon-first explanations.
3. **Short and completable** — each lesson fits one sitting; clear "you're done!" moment.
4. **Safe to fail** — mastery allows 2/3 pass so one mistake does not destroy confidence.
5. **Predictable rhythm** — every lesson: scaffolded practice, then mastery check.
6. **Device-agnostic** — phone and computer; layout adapts; touch and mouse both work.

### Not designing for

Exam crammers, teachers managing classrooms, multi-subject learners, users who want video lectures or AI chat tutors.

---

## 5. MVP definition

### 5.1 One-sentence MVP

Maya can sign in on **mobile or desktop**, complete **5 interactive algebra lessons** (each with scaffolded practice and a 3-question mastery check), manipulate scales/tiles, get instant written feedback, resume mid-lesson, see her streak and next lesson — deployed publicly with **zero AI**.

### 5.2 Assignment alignment (Phase 1 gate)

| Requirement | Implementation |
|-------------|----------------|
| Chosen subject + persona | Algebra + Maya (stated in README) |
| Interactive lesson(s) | 5 lessons (depth in one subject) |
| Direct manipulation | ≥1 interactive step per lesson (scale/tiles) |
| Visual responds in real time | Scale/tiles update on interaction |
| Instant, specific feedback | Pre-written copy; UI response <100ms |
| Progress persists | Firestore; resume mid-lesson and mid-phase |
| Auth + names | Firebase Auth + display name |
| Mobile + desktop | Responsive web app (§9) |
| Deployed & public | Vercel + Firebase |
| No AI | No model calls, no generated content |

### 5.3 Lesson structure (locked)

Every lesson has two phases:

**Scaffolded (hand-holding):** 3–5 questions · hints available · explanation page after wrong answers · visual always on screen · ≥1 interactive question (drag/tap) · mostly multiple choice.

**Mastery check (no hand-holding):** 3 questions · no hints · no explanation pages until after submit · pass at **≥2/3** · on fail, retry missed questions only.

### 5.4 Course map

| # | Lesson ID | Title | `x` introduced? |
|---|-----------|-------|-----------------|
| 1 | `lesson-01` | Finding Unknowns | No (shapes only) |
| 2 | `lesson-02` | Variables | Yes |
| 3 | `lesson-03` | Finding Unknown Values | Yes |
| 4 | `lesson-04` | Combining and Coefficients | Yes |
| 5 | `lesson-05` | Writing Expressions | Yes |
| 6 | `lesson-06` | Two Unknowns *(optional)* | Yes |

Linear unlock: complete Lesson *N* to open Lesson *N+1*. Ship Lessons 1–5 for Wednesday gate; add Lesson 6 if ahead of schedule.

### 5.5 Habit loop (required)

| Feature | Purpose for Maya |
|---------|------------------|
| Daily streak | Low-pressure "I practiced today" motivation |
| Welcome back / Continue | Reduces re-entry friction |
| Lesson complete screen | Satisfying finish; shows next lesson title |
| Course path | Clear progress without overwhelming dashboard |

**Not included:** leagues, XP, levels, badges, push notifications, leaderboards.

### 5.6 Definition of done

1. Create account on phone; complete Lesson 1 with wrong answers and recovery; leave on step 3; return and resume.
2. Repeat same flow on desktop at a different viewport width.
3. Pass mastery 2/3; unlock Lesson 2; streak increments.
4. Confirm no AI endpoints in codebase or network calls.

---

## 6. User stories

### 6.1 In scope

| ID | User story | Acceptance |
|----|------------|------------|
| US-01 | Sign up with email or Google | Auth works on mobile and desktop |
| US-02 | See display name on home | Name shown after sign-in |
| US-03 | See course path (locked / in progress / done) | Linear list; no clutter |
| US-04 | Tap Continue to resume exact step | Phase + step index restored |
| US-05 | Scaffolded hints when stuck | Hint button in scaffolded only |
| US-06 | Explanation when scaffolded answer wrong | 2–4 sentences + visual; warm tone |
| US-07 | Drag/tap scale or tiles (≥1 per lesson) | Touch and mouse both work |
| US-08 | Visual updates immediately on interaction | Scale rebalances in real time |
| US-09 | Instant feedback on submit | UI updates in <100ms |
| US-10 | 3-question mastery check, no hints | Pass at 2/3 |
| US-11 | Retry only missed mastery questions on fail | No full mastery restart required |
| US-12 | Unlock next lesson on mastery pass | Next lesson becomes tappable |
| US-13 | See daily streak on home | Updates on lesson activity |
| US-14 | Lesson-complete celebration + next step | "Up next: …" shown |
| US-15 | Use app on phone in portrait | No horizontal scroll; 48px tap targets |
| US-16 | Use app on laptop/desktop | Layout expands; mouse + keyboard work |
| US-17 | Add lessons via JSON without rewriting UI | Content-driven renderer |

### 6.2 Out of scope — and why

| Story | Reason |
|-------|--------|
| AI tutor / generated problems | Phase 2; banned in MVP |
| Spaced repetition / review sets | Phase 3 |
| Leagues, XP, levels | Streak + completion sufficient for Maya |
| Skip ahead to any lesson | Linear unlock protects scaffolding |
| Multiple subjects | Assignment: depth in one subject |
| Video lessons | Opposite of product thesis |
| Offline mode | Not required; adds sync complexity |
| Teacher dashboard | Wrong persona |
| Premium / payments | Not required |
| Push notifications | In-app streak enough for MVP |
| Profile photo, settings page | Maya does not need them |

---

## 7. Functional requirements

### 7.1 Authentication

Firebase Auth: email/password and Google. Required **display name** on sign-up. Session persists across restarts. Sign out from home (no settings page).

### 7.2 Home screen

Display name, current streak, course path (5–6 lessons). Each card: title + status (locked / in progress / completed). Primary CTA: **Continue** or **Start**. No global nav beyond home + sign out.

### 7.3 Lesson player

Load lesson JSON by ID. Render step from `currentPhase` + `currentStepIndex` in Firestore. Step types: `mc`, `scale_interactive`, `tile_combine`, `explanation`. Progress indicator (e.g. "Question 2 of 4"). Scaffolded: hint visible; explanation interstitial on wrong. Mastery: no hints; brief feedback; summary at end. Auto-save on every step completion.

### 7.4 Feedback engine

All feedback in lesson JSON (pre-written). Client-side validation. On submit: immediate UI change then feedback copy. Scaffolded wrong → explanation interstitial before advancing. Mastery wrong → brief feedback; summarize at end.

### 7.5 Progress & unlock

Statuses: `locked` | `not_started` | `in_progress` | `completed`. Lesson 1 unlocked by default. Lesson *N+1* unlocks when Lesson *N* `masteryPassed === true`. Resume restores `lessonId`, `currentPhase`, `currentStepIndex`.

### 7.6 Streak logic

Practice day = any step completed or lesson finished. Update `lastActiveDate` (YYYY-MM-DD, local timezone). Same day: no change. Yesterday: `currentStreak += 1`. Gap ≥2 days: reset to 1. First activity: streak = 1. Streak 0 copy: "Start your streak today!"

### 7.7 Mastery pass/fail

3 questions; pass at **2/3**. On fail: encouraging copy; retry **only missed questions**. Unlimited mastery retries for MVP. On pass: mark complete, unlock next, lesson-complete screen, update streak.

---

## 8. Edge cases & error handling

### 8.1 Auth

| Case | Behavior |
|------|----------|
| Email already exists | "An account with this email already exists. Try signing in." |
| Wrong password | "That password doesn't match. Try again." |
| Session expires mid-lesson | Redirect to sign-in; resume from Firestore after re-auth |
| Tab closed mid-step | Last completed step saved; resume accordingly |
| Empty display name | Block until entered (1–30 chars) |
| Google sign-in, no name | Prompt for display name |

### 8.2 Progress & sync

| Case | Behavior |
|------|----------|
| Same account, two devices | Firestore source of truth; latest `updatedAt` wins |
| Offline | Banner: "You're offline. Progress saves when you're back." Retry writes; block new lesson if no cached content |
| Firestore write fails | Retry once; keep local state until saved |
| Lesson JSON removed | Friendly error; redirect home |
| Complete on device A, open B | Home shows completed; no duplicate |

### 8.3 Lesson player

| Case | Behavior |
|------|----------|
| Submit with no selection | Submit disabled |
| Double-tap submit | Debounce; ignore second |
| Wrong in scaffolded | Explanation interstitial; must dismiss |
| Wrong in mastery | Brief feedback; advance to next Q |
| Mastery 1/3 | Retry 2 missed questions |
| Failed retry | Unlimited retries (MVP) |
| Leave mid-mastery | Save phase + step; resume same question |
| Incomplete drag interaction | Submit disabled until valid state |
| Browser back | Confirm leave or auto-save + home |

### 8.4 Streak & responsive

Streak: first day = 1; multiple lessons/day = one increment; broken streak → "Welcome back! Let's start a new streak." Timezone: use browser local date (acceptable for MVP).

Responsive: 320px phones scale visual down without overflow; 1920px+ desktop centers content; rotate mid-lesson preserves step state; hybrid touch/mouse via pointer events; iOS Safari uses `dvh`/safe-area so CTA not hidden.

### 8.5 Content

Invalid JSON fails build. Missing feedback copy → fallback: "Not quite. Read the explanation and try the next one."

---

## 9. Responsive design & devices

One **responsive web app** (not native). Single codebase for all devices.

| Device | Viewport | Input |
|--------|----------|-------|
| Phone | 320–480px portrait | Touch |
| Tablet | 481–1024px | Touch |
| Desktop | 1025px+ | Mouse + keyboard |

| Element | Mobile | Desktop |
|---------|--------|---------|
| Course path | Single column, full width | Centered, max ~720px |
| Lesson player | Visual above prompt | Stacked or side-by-side, max ~800px |
| Scale/tile visual | Full width, min 200px | Larger, max ~500px centered |
| MC options | Stacked buttons, min 48px | Stacked or 2-column |
| Typography | 16px base (prevents iOS zoom) | 16–18px base |

Interaction parity: scale drag via pointer events (touch + mouse); no hover-only affordances; Tab + Enter for MC on desktop; no horizontal scroll; resize/rotate preserves lesson state.

**Maya does not need:** native app install, separate mobile/desktop codebases, desktop-only shortcuts beyond accessibility.

---

## 10. Non-functional requirements

| Requirement | Target |
|-------------|--------|
| Feedback UI latency | <100ms from submit to visual change |
| Lesson load | <2s to first interaction on 4G |
| Animation | 60fps goal on scale/tile updates |
| Concurrent users | Firebase default scaling |
| Security | Firestore: users read/write own data only |
| Accessibility | Semantic HTML, focus states, contrast, keyboard MC |
| AI | Zero model API calls in Phase 1 |
| Browsers | Latest Chrome, Safari, Firefox, Edge |

---

## 11. Tech stack

### Required

| Layer | Technology |
|-------|------------|
| Frontend | **React** (Vite) |
| Auth | **Firebase Authentication** |
| Database | **Cloud Firestore** |
| Hosting | **Vercel** |

### Recommended

| Layer | Technology |
|-------|------------|
| Styling | Tailwind CSS |
| Routing | React Router |
| State | React Context + hooks |
| Visuals | SVG + React |
| Content | JSON in `/content` |

### Not in stack (Phase 1)

OpenAI / Anthropic / any LLM · Supabase · custom Node server · Canvas/WebGL · native wrappers (Capacitor, React Native).

---

## 12. Data schema

### 12.1 Storage overview

| Data | Where | Mutable? |
|------|-------|----------|
| Lessons, feedback, explanations | JSON in `/content` | Deploy to update |
| User identity | Firebase Auth | Yes |
| Profile, streak | Firestore `users/{uid}` | Yes |
| Lesson progress | Firestore `users/{uid}/progress/{lessonId}` | Yes |

### 12.2 `users/{userId}`

```
displayName: string       // required
email: string
createdAt: Timestamp
lastActiveDate: string   // "2026-06-22" local date
currentStreak: number    // default 0
updatedAt: Timestamp
```

### 12.3 `users/{userId}/progress/{lessonId}`

Document ID = `lessonId` (e.g. `lesson-01`).

```
lessonId: string
status: "not_started" | "in_progress" | "completed"
currentPhase: "scaffolded" | "mastery"
currentStepIndex: number          // 0-based within phase
scaffoldedCompleted: boolean
masteryCorrectCount: number
masteryMissedStepIds: string[]
masteryPassed: boolean
startedAt: Timestamp | null
completedAt: Timestamp | null
updatedAt: Timestamp
```

### 12.4 Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /progress/{lessonId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### 12.5 Not stored

Individual step attempt history · AI conversation logs · analytics events (skip for MVP unless needed for demo).

---

## 13. Information architecture

| Route | Screen |
|-------|--------|
| `/auth` | Sign in / sign up + display name |
| `/` | Home: name, streak, path, Continue |
| `/lesson/:lessonId` | Lesson player |
| *(overlay)* | Lesson complete: celebration + "Up next" |

4 screens total. No settings, profile edit, or about page.

---

## 14. Lesson content model

### File structure

```
content/
  course.json
  lessons/
    lesson-01.json … lesson-05.json
```

### `course.json`

```json
{
  "id": "solving-equations-intro",
  "title": "Solving Equations",
  "lessonOrder": ["lesson-01", "lesson-02", "lesson-03", "lesson-04", "lesson-05"]
}
```

### Step schema (per question)

| Field | Purpose |
|-------|---------|
| `id` | Unique step ID |
| `type` | `mc` \| `scale_interactive` \| `tile_combine` \| `explanation` |
| `prompt` | Question text |
| `visual` | Scale/tile config object |
| `options` / `correctIndex` | MC answers |
| `validation` | Rules for interactive steps |
| `hint` | Scaffolded only |
| `feedback` | `{ correct, incorrect[] }` |
| `explanation` | `{ title, body, visual }` — scaffolded wrong answers |

### Example step (abbreviated)

```json
{
  "id": "s2",
  "type": "scale_interactive",
  "prompt": "Remove 1 block from each side to find the unknown.",
  "visual": { "type": "scale", "config": { "left": ["unknown", "1"], "right": ["7"] } },
  "validation": { "action": "remove_from_both", "value": 1, "expectedUnknown": 6 },
  "hint": "Whatever you remove from one side, remove from the other too.",
  "feedback": {
    "correct": "The scale stays balanced!",
    "incorrect": ["You changed only one side — both sides must stay equal."]
  }
}
```

---

## 15. Course outline (per lesson)

**Lesson 1 — Finding Unknowns:** Equal means equal; shapes on scales. No `x`. Scaffolded: 4 Q (2 MC, 1 scale interactive, 1 MC). Mastery: 3 MC.

**Lesson 2 — Variables:** `x` names an unknown. Scaffolded: 4 Q (introduce `x`, evaluate `x + 3`, interactive label match, MC). Mastery: 3 Q.

**Lesson 3 — Finding Unknown Values:** One-step equations via balance reasoning. Scaffolded: 4 Q (`x + 3 = 7` interactive, `x − 2 = 6`, `10 = x + 4`, mistake explanation). Mastery: 3 mixed +/−.

**Lesson 4 — Combining and Coefficients:** `2x + x = 3x`; combine then solve; coeffs ≤ 3. Scaffolded: 4 Q. Mastery: 3 combine-and-solve.

**Lesson 5 — Writing Expressions:** Words → algebra; watch "less than" order trap. Scaffolded: 4 Q. Mastery: 3 word → expression MC.

**Lesson 6 (optional) — Two Unknowns:** Substitute when one known; no coefficients. Scaffolded: 3–4 Q. Mastery: 3 Q.

---

## 16. Out of scope

**Phase 1:** AI · leagues/XP/levels · push notifications · offline · educator tools · premium · multiple courses · profile editing · step analytics.

**Phase 2 (later):** AI hints, problem generation, adaptive path — document in Brainlift.

**Phase 3 (later):** Spaced repetition, interleaving, advanced mastery — document in Brainlift.

---

## 17. Success criteria & test scenarios

| # | Scenario | Pass |
|---|----------|------|
| 1 | Lesson 1 E2E with wrong answers + recovery | Hints/explanations help Maya finish |
| 2 | Manipulate interactive; visual responds live | Scale/tiles update on drag/tap |
| 3 | Leave mid-lesson; return | Same step; streak persists |
| 4 | Finish lesson | "Up next: Variables" (or next title) |
| 5 | Phone 375px | No broken layout |
| 6 | Desktop 1280px | Mouse interactions work |

**Additional acceptance:** sign up → streak=1 · mastery 2/3 unlocks next · cross-device sync · offline banner · no AI in DevTools · all 5 lessons playable.

---

## 18. Open questions & build order

| Question | Recommendation |
|----------|----------------|
| Product name | **Unknown** (decided) |
| Vite vs Next.js | Vite (decided) |
| Lesson 6 in MVP? | Ship 5; add 6 if ahead (decided) |
| Email + Google? | Both (decided) |

**Build order:** scaffold → Lesson 1 JSON + scale component → renderer + feedback → auth → Firestore progress → home/path/streak → Lessons 2–5 → edge cases + responsive polish → deploy.

**README must state:** **Unknown** · Algebra · Maya persona · setup guide · architecture (React + Firebase + JSON) · deployed link.

---

*Phase 1 only. Clone Brilliant's core learn-by-doing mechanics; skip everything Maya doesn't need. If a feature does not help her learn algebra, persist progress, or come back tomorrow — it does not ship.*
