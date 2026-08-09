import {
  getAnalytics,
  isSupported,
  logEvent,
  type Analytics,
} from 'firebase/analytics';
import { getFirebaseApp } from './firebaseApp';

/** Pulls in the Analytics SDK — reach this module only through a dynamic import. */

let analytics: Analytics | null | undefined;
let initPromise: Promise<Analytics | null> | null = null;

async function getAnalyticsClient(): Promise<Analytics | null> {
  if (analytics !== undefined) return analytics;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const app = getFirebaseApp();
    if (!app) {
      analytics = null;
      return null;
    }
    try {
      const supported = await isSupported();
      if (!supported) {
        analytics = null;
        return null;
      }
      analytics = getAnalytics(app);
      return analytics;
    } catch {
      analytics = null;
      return null;
    }
  })();

  return initPromise;
}

export async function logAnalyticsEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  const client = await getAnalyticsClient();
  if (!client) return;
  logEvent(client, name, params);
}
