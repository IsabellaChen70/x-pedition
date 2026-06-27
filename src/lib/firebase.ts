import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
// Region must match the deployed callable (functions/index.js → us-central1).
export const functions = getFunctions(firebaseApp, 'us-central1');

// App Check protects the AI Logic / Gemini quota from abuse. It is required to
// use AI in production, so it loads only when a reCAPTCHA Enterprise site key is
// configured (lazy import keeps it out of the bundle when AI is off).
//
// In local dev it also turns on the App Check debug provider, which prints a
// debug token to the browser console. Register that token in the Firebase console
// (App Check > Manage debug tokens) so localhost passes App Check without adding
// localhost to the production reCAPTCHA key.
if (typeof window !== 'undefined' && import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  if (import.meta.env.DEV) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  }
  void import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY as string),
      isTokenAutoRefreshEnabled: true,
    });
  });
}
