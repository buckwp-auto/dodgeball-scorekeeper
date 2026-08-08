import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { readFirebaseConfig } from './firebaseConfig';

/**
 * Pulls in the Firebase SDK, so reach this module only through a dynamic
 * import. Use `isFirebaseConfigured` from ./firebaseConfig for cheap checks.
 */

let app: FirebaseApp | null | undefined;

/** Returns null when Firebase env is not configured (local-only mode). */
export function getFirebaseApp(): FirebaseApp | null {
  if (app !== undefined) return app;

  const config = readFirebaseConfig();
  if (!config) {
    app = null;
    return app;
  }

  app = initializeApp(config);

  // Must run before Auth/Firestore issue requests so tokens are attached.
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  if (siteKey && typeof window !== 'undefined') {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  return app;
}
