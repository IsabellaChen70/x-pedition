# X-pedition

**Subject:** Algebra — Solving Equations (Intro)  
**Persona:** Maya — 7th grader, nervous about `x`, learns best by doing (not watching videos).

X-pedition is a focused Brilliant-style learn-by-doing algebra app, framed as a treasure-map expedition. Learners solve hands-on problems (balance scales, tile sorting, expression building, sharing into groups), get instant hand-written feedback, and follow a course path with a streak, XP, levels, and badges. Progress persists across sessions and devices. Phase 1 ships with **no AI**.

## Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, React Router
- **Backend:** Firebase Auth + Firestore
- **Content:** structured JSON lessons in `content/` (a course plus 5 lessons)
- **Hosting:** Firebase Hosting

## Setup

```bash
npm install
cp .env.example .env.local   # add your Firebase web config
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Firebase

Firebase Auth handles email/password and Google sign-in. Firestore stores per-user lesson
progress, unlocks, and streaks. Firebase Hosting serves the built Vite app from `dist`.

In Firebase Console, enable **Firestore Database**, then publish the rules in `firestore.rules`.
Firebase Hosting is configured in `firebase.json` with a rewrite to `index.html` for React Router.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run validate:content` | Validate lesson JSON files |
| `npm run preview` | Preview production build |
| `npm run deploy:hosting` | Build and deploy Firebase Hosting |
| `npm run deploy:firebase` | Build, deploy Hosting, and publish Firestore rules |

## Architecture

```
content/           Lesson JSON (course + lessons)
src/pages/         Route screens (Auth, Home, Lesson)
src/components/    UI + interactives (BalanceScale, etc.)
src/lib/           Firebase, progress, content loaders
```

See [docs/PRD.md](docs/PRD.md) for full requirements and
[docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md) for the demo checklist.

## AI workflow (Cursor)

Built with an AI-first workflow in Cursor. Reusable tooling committed in this repo:

- **Skill — `lesson-author`** (`.cursor/skills/lesson-author/SKILL.md`): teaches the agent this repo's lesson JSON format, step types, learner-persona tone rules, and validation, so new lessons are authored consistently.
- **Subagent — `qa-runner`** (`.cursor/agents/qa-runner.md`): runs the quality gates (`validate:content`, `test`, `lint`, `build`) in its own context and reports a concise pass/fail summary.
- **Quality-gate loop**: a Cursor `/loop` that re-runs the qa-runner gates on an interval during development to catch regressions early.

## Deployed

https://x-pedition.web.app
