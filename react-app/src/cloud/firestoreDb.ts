import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFirebaseApp } from './firebaseApp';

/** Pulls in the Firestore SDK — reach this module only through a dynamic import. */

let db: Firestore | null | undefined;

/** Returns null when Firebase env is not configured (local-only mode). */
export function getDb(): Firestore | null {
  if (db !== undefined) return db;
  const app = getFirebaseApp();
  db = app ? getFirestore(app) : null;
  return db;
}
