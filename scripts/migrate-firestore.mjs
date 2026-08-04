#!/usr/bin/env node
/**
 * Copy Firestore `/users/**` from a SOURCE Firebase project to a DEST project,
 * preserving document ids and paths. For each `users/{uid}` it copies the user
 * doc (when it has data) and every doc in its `progress` subcollection to the
 * same path, so migrated progress stays keyed by the same uid.
 *
 * This is a one-off migration helper. firebase-admin is intentionally NOT a
 * project dependency; install it without touching package.json before running:
 *
 *   npm i --no-save firebase-admin
 *
 * Then run (dry run by default, which reads and reports counts but writes nothing):
 *
 *   SRC_SA=./src-service-account.json \
 *   DEST_SA=./dest-service-account.json \
 *   node scripts/migrate-firestore.mjs
 *
 * Add --commit to actually write to the destination:
 *
 *   SRC_SA=... DEST_SA=... node scripts/migrate-firestore.mjs --commit
 *
 * No credentials are hardcoded: both service-account key file paths come from the
 * SRC_SA and DEST_SA environment variables. Keep those key files out of git.
 *
 * Notes:
 * - The app writes only `users/{uid}/progress/{courseId}`, so most `users/{uid}`
 *   parent docs are "missing" (no fields). listDocuments() is used so those
 *   parents' subcollections are still copied.
 * - Writes are batched at Firestore's 500-operation limit.
 * - Skip anonymous users when exporting from Auth; their orphaned progress docs
 *   simply carry no owner and can be ignored.
 */

import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BATCH_LIMIT = 500;

/** Buffers writes and commits them in batches of at most BATCH_LIMIT. */
class BatchWriter {
  constructor(db, commit) {
    this.db = db;
    this.commit = commit;
    this.batch = commit ? db.batch() : null;
    this.pending = 0;
    this.written = 0;
  }

  async set(ref, data) {
    if (!this.commit) {
      return;
    }
    this.batch.set(ref, data);
    this.pending += 1;
    if (this.pending >= BATCH_LIMIT) {
      await this.flush();
    }
  }

  async flush() {
    if (!this.commit || this.pending === 0) {
      return;
    }
    await this.batch.commit();
    this.written += this.pending;
    this.pending = 0;
    this.batch = this.db.batch();
  }
}

function loadCredential(envName) {
  const path = process.env[envName];
  if (!path) {
    throw new Error(`Set ${envName} to a service-account key file path.`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Count users (via listDocuments so missing parents count) and progress docs. */
async function countTree(db) {
  const userRefs = await db.collection('users').listDocuments();
  let progress = 0;
  for (const userRef of userRefs) {
    const snap = await userRef.collection('progress').get();
    progress += snap.size;
  }
  return { users: userRefs.length, progress };
}

async function main() {
  const commit = process.argv.includes('--commit');

  const srcCred = loadCredential('SRC_SA');
  const destCred = loadCredential('DEST_SA');

  const srcDb = getFirestore(initializeApp({ credential: cert(srcCred) }, 'src'));
  const destDb = getFirestore(initializeApp({ credential: cert(destCred) }, 'dest'));

  console.log(`Source project: ${srcCred.project_id}`);
  console.log(`Dest project:   ${destCred.project_id}`);
  console.log(
    commit
      ? 'Mode: COMMIT (writing to destination)'
      : 'Mode: DRY RUN (no writes; pass --commit to copy)',
  );

  const writer = new BatchWriter(destDb, commit);
  let userCount = 0;
  let progressCount = 0;

  // listDocuments() includes "missing" parent docs that still have subcollections,
  // which is the common case here since the app only writes the progress subdoc.
  const userRefs = await srcDb.collection('users').listDocuments();
  for (const userRef of userRefs) {
    userCount += 1;
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      await writer.set(destDb.collection('users').doc(userRef.id), userSnap.data());
    }
    const progressSnap = await userRef.collection('progress').get();
    for (const progressDoc of progressSnap.docs) {
      progressCount += 1;
      await writer.set(
        destDb.collection('users').doc(userRef.id).collection('progress').doc(progressDoc.id),
        progressDoc.data(),
      );
    }
  }
  await writer.flush();

  console.log(`\nSource: ${userCount} users, ${progressCount} progress docs`);

  if (!commit) {
    console.log('Dry run complete. Re-run with --commit to copy these to the destination.');
    return;
  }

  console.log(`Wrote ${writer.written} documents to the destination.`);

  // Verify by reading the destination back and comparing counts.
  const dest = await countTree(destDb);
  console.log(`Dest:   ${dest.users} users, ${dest.progress} progress docs`);
  if (dest.users === userCount && dest.progress === progressCount) {
    console.log('Counts match.');
  } else {
    console.log('WARNING: source and destination counts differ. Investigate before cutover.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
