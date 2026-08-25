import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirebaseApp } from './firebaseApp';

/** Pulls in the Auth SDK — reach this module only through a dynamic import. */

let auth: Auth | null | undefined;

function getAuthClient(): Auth | null {
  if (auth !== undefined) return auth;
  const app = getFirebaseApp();
  auth = app ? getAuth(app) : null;
  return auth;
}

/** Returns an unsubscribe fn, or null when Firebase is not configured. */
export function watchAuthState(
  onChange: (user: User | null) => void,
): (() => void) | null {
  const client = getAuthClient();
  if (!client) return null;
  return onAuthStateChanged(client, onChange);
}

export async function signInWithGoogle(): Promise<void> {
  const client = getAuthClient();
  if (!client) throw new Error('Firebase is not configured');
  await signInWithPopup(client, new GoogleAuthProvider());
}

export async function signOutOfFirebase(): Promise<void> {
  const client = getAuthClient();
  if (!client) return;
  await signOut(client);
}
