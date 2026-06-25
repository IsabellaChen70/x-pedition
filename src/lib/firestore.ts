import type { FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { firebaseApp } from './firebase';

/**
 * Use an on-disk (IndexedDB) cache in the browser so lesson progress reads from
 * cache and writes queue durably while offline, syncing on reconnect. The cache
 * touches browser-only storage, so non-browser environments (tests, SSR) fall
 * back to the default in-memory Firestore.
 *
 * This module is intentionally separate from `firebase.ts` so the heavy
 * Firestore SDK is only pulled into the bundles that actually read/write data
 * (the authenticated pages), not the initial auth path.
 */
function createFirestore(app: FirebaseApp): Firestore {
  if (typeof window === 'undefined') {
    return getFirestore(app);
  }
  return initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
}

export const db = createFirestore(firebaseApp);
