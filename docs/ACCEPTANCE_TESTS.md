# Acceptance Tests

Run these checks before considering the MVP ready to demo.

## Local Setup

```bash
npm install
npm run validate:content
npm run build
npm run lint
npm run dev
```

## Auth And Progress

1. Open `http://localhost:5173`.
2. Sign up with email/password and a display name, or use Google.
3. Confirm the home page greets you by name.
4. Start Lesson 1, advance to question 3, refresh the browser, and confirm it resumes on question 3.
5. Sign out and sign back in. Confirm the same lesson state is restored.

## Lesson Rhythm

1. In a scaffolded question, tap Hint and confirm the hint appears.
2. Submit a wrong scaffolded answer and confirm the explanation modal appears before retry.
3. In mastery, confirm hints are absent.
4. Pass mastery with 2 of 3 correct and confirm the lesson-complete screen appears.
5. Fail mastery, retry missed questions once, and confirm a second fail ends the attempt.
6. Reopen a completed lesson and confirm review mode shows each question, your answer, and the correct answer.

## Course Path

1. Pass Lesson 1 and confirm Lesson 2 unlocks on home.
2. Continue through Lessons 2-5.
3. Confirm completed lessons show `Complete` and can be reviewed.
4. Confirm locked lessons cannot be opened before the prior lesson is passed.
5. Confirm the streak count increments once per day after passing a lesson.

## Responsive Checks

1. Test at phone width around 390px.
2. Confirm there is no horizontal scrolling.
3. Confirm answer buttons and scale action buttons are easy to tap.
4. Test at desktop width and confirm the home dashboard expands cleanly.

## Deployment

1. Install or use Firebase CLI: `npm install -g firebase-tools` or `npx firebase-tools`.
2. Log in with `firebase login`.
3. Confirm `.firebaserc` points at `unknown-algebra`.
4. Run `npm run deploy:firebase` to build, deploy Hosting, and publish Firestore rules.
5. In Firebase Auth, confirm the Firebase Hosting domain is listed under Authorized domains.
6. Open the Firebase Hosting URL and repeat the auth, resume, course path, and responsive checks.
