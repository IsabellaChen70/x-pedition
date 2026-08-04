[![CI](https://github.com/IsabellaChen70/x-pedition/actions/workflows/ci.yml/badge.svg)](https://github.com/IsabellaChen70/x-pedition/actions/workflows/ci.yml)

# X-pedition

A learn-by-doing algebra tutor for a 7th grader who is anxious about `x`, framed as a treasure-map expedition. Live at **[x-pedition.web.app](https://x-pedition.web.app)**.

## What I built

X-pedition teaches early algebra through hands-on problems (balance scales, tile sorting, building expressions) with instant hand-written feedback and a course path that tracks a streak, XP, and levels. Progress saves per user and resumes across devices.

The part I care most about is how it handles AI. X-pedition is deterministic-first: a math engine owns every correctness decision, and the language model sits behind that engine as a checked helper rather than a source of truth.

- A math engine re-verifies every LLM-generated practice problem before a learner sees it, so a wrong problem does not reach the learner.
- Socratic hints are authored and answer-safe, so a hint moves the learner forward without giving away the solution.
- When the AI cannot be verified or reached, the feature falls back to deterministic logic, and no incorrect output is shown.
- The whole app works with AI switched off. AI adds problem variety and free-text judging on top of a course that already teaches on its own.

## Try it

The live app is at **[x-pedition.web.app](https://x-pedition.web.app)**.

**Fastest path: Continue as guest.** The sign-in screen has a **Continue as guest** button that starts an anonymous session, so you land straight in the app with your own throwaway progress, nothing to fill in. If guest sessions are unavailable, the same screen still offers a demo login and account sign-up, so the first tap never dead-ends.

**See a populated account:** tap **Try the demo** on the sign-in screen to load a demo learner that already has a streak, XP, and completed lessons. You can also create your own account with any email and password to keep progress across devices.

## See it

The quickest look is the [live app](https://x-pedition.web.app). Short captures of the three core interactions belong here; the embeds are staged below and stay commented out until the files land in [`docs/screenshots/`](docs/screenshots/), so nothing renders broken in the meantime.

<!-- TODO(screenshots): capture the three files into docs/screenshots/ (see that folder's
     README for guidance and exact filenames), then uncomment the embeds below.

Balance scale (remove the same weight from both pans, and the scale rebalances live):

![Balance-scale interaction](docs/screenshots/balance-scale.gif)

Tile sorting (group like terms into the combine box):

![Tile-sorting interaction](docs/screenshots/tile-sorting.png)

Home treasure map (course path with streak, XP, and level):

![Treasure-map home](docs/screenshots/treasure-map.png)
-->

## Deterministic-first AI

The math engine decides what is correct. AI features are layered on top, each one either verified by the engine or written to be answer-safe, with a deterministic fallback.

- **Socratic hints:** escalating, answer-safe hints in scaffolded practice. They come from deterministic logic, so they appear instantly and move the learner forward without stating the answer.
- **Misconception detection:** on a wrong answer, the system matches the specific choice to a named mistake ("It looks like you changed only one side") and switches the hints to that mistake's fix. Deterministic.
- **Explain my mistake:** a grounded, deterministic explanation that plugs the learner's actual choice back into the equation, so the explanation stays consistent with what they did.
- **Convince Me (self-explanation):** on the last two mastery questions, the learner types why their answer works. An LLM judge reads it, rewards genuine reasoning, and lets the learner continue even when it is unsure, so it does not block progress. An authored "what if" follow-up adds a twist.
- **Adaptive practice:** the Daily Treasure Dig leans toward skills the learner recently missed. Difficulty climbs only when a learner answers quickly and confidently on the first try, and eases after repeated misses.
- **AI problem generation:** the LLM drafts fresh practice problems, and the math engine re-verifies each one before it appears. An instant local generator is the fallback, so practice keeps flowing and a wrong problem does not reach the learner.

The LLM features run on OpenAI. In local development the key comes from a gitignored file; on the deployed site the calls go through auth-gated Firebase Cloud Functions, so the key stays server-side and out of the client bundle. Two feature flags hold no secrets and degrade safely: `VITE_AI_GENERATION` (AI problems, default off) and `VITE_RECAPTCHA_SITE_KEY` (App Check). Full rationale is in [docs/brainlift.md](docs/brainlift.md).

With AI off or unreachable, the app still teaches: instant deterministic hints, deterministic mistake explanations, locally verified practice problems, and an encouraging close on self-explanation. The [AI on/off checklist](docs/ACCEPTANCE_TESTS.md) walks through both states.

## Learn-by-doing core

- Interactive step types: balance scale, tile combine, equal share, expression builder, and multiple choice.
- Each lesson runs scaffolded practice (with hints and teaching pages) and then a hint-free mastery check that passes at 2 of 3.
- Progress persists per user in Firestore and resumes mid-lesson across devices.
- Habit loop: a daily streak, XP and levels, badges, and a lesson-complete celebration.
- A linear course path drawn as a treasure map, plus a capstone Final Challenge that unlocks the treasure.

## Learning science

The design follows evidence on how novices learn: guided instruction over discovery (Kirschner, Sweller, Clark), retrieval practice (Roediger, Karpicke), self-explanation after a correct step (Chi), and desirable difficulties near an 80 to 85 percent success zone (Bjork, Rosenshine). A Phase 3 layer adds deterministic spaced repetition: a per-skill Leitner schedule with growing intervals decides what is due, drives the Daily Treasure Dig, and shows each skill as Learning, Practicing, or Mastered on the map. It uses date arithmetic rather than an LLM and is unit-tested. Sources and reasoning are in [docs/brainlift.md](docs/brainlift.md).

## Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, React Router
- **Backend:** Firebase Authentication and Cloud Firestore
- **AI:** OpenAI, called from auth-gated Firebase Cloud Functions in production
- **Content:** structured JSON lessons in `content/` (a course plus 5 lessons)
- **Hosting:** Firebase Hosting

## Setup

```bash
npm install
cp .env.example .env.local   # add your Firebase web config
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

In the Firebase console, enable **Firestore Database** and publish the rules in `firestore.rules`. Under **Authentication → Sign-in method**, enable **Anonymous** (for the guest button) and **Email/Password**. Firebase Hosting is configured in `firebase.json` with a rewrite to `index.html` for React Router.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest unit suite |
| `npm run validate:content` | Validate the lesson JSON files |
| `npm run preview` | Preview the production build |
| `npm run deploy:hosting` | Build and deploy Firebase Hosting |
| `npm run deploy:firebase` | Build, deploy Hosting, and publish Firestore rules |

Deploy with `npm run deploy:hosting` (or `npm run deploy:firebase` to also publish
Firestore rules). Both are safe on the free Spark plan. Avoid a bare
`firebase deploy`: it also tries to deploy the Cloud Functions, which require the
Blaze plan, so it fails on Spark. The app runs fully with AI off, so a
Hosting-only deploy is the normal path.

## Architecture

```
content/           Lesson JSON (course + 5 lessons)
src/pages/         Route screens (Auth, Home, Lesson)
src/components/    UI and interactives (BalanceScale, tiles, map)
src/auth/          Auth provider, context, and route guard
src/lib/           Firebase, progress, content loaders
src/lib/ai/        Math engine, verifier, hints, SRS, adaptive logic
functions/         Cloud Functions (server-side OpenAI calls)
```

The lesson player reads a step from `currentPhase` and `currentStepIndex` and renders it, so new lessons are authored as JSON without touching the renderer. See [docs/PRD.md](docs/PRD.md) for full requirements and [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md) for the demo checklist.

## Continuous integration

Every push and pull request to `main` runs [the CI workflow](.github/workflows/ci.yml) on Node 22: `npm ci`, then `validate:content`, `test`, `lint`, and `build`. The badge at the top of this file reflects the latest run.

## AI workflow (Cursor)

Built with an AI-first workflow in Cursor, with reusable tooling committed to the repo:

- **Skill `lesson-author`** (`.cursor/skills/lesson-author/SKILL.md`): teaches the agent this repo's lesson JSON format, step types, learner-persona tone, and validation, so new lessons stay consistent.
- **Subagent `qa-runner`** (`.cursor/agents/qa-runner.md`): runs the quality gates (`validate:content`, `test`, `lint`, `build`) in its own context and reports a concise pass or fail summary.
- **Quality-gate loop:** a Cursor `/loop` that re-runs the qa-runner gates on an interval during development to catch regressions early.

## License

MIT. See [LICENSE](LICENSE).
