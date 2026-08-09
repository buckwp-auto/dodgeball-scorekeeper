import {
  ANALYTICS_EVENTS,
  pageNameFromPath,
  type AnalyticsDeleteKind,
} from '../domain/analytics';
import { isFirebaseConfigured } from './firebaseConfig';
import type { YoutubePlayerMode } from '../domain/youtube';

export type AnalyticsParams = Record<string, string | number | boolean>;

function analyticsEnabled(): boolean {
  if (!isFirebaseConfigured()) return false;
  if (import.meta.env.VITE_FIREBASE_ANALYTICS === '0') return false;
  if (import.meta.env.PROD) return true;
  return import.meta.env.VITE_FIREBASE_ANALYTICS === '1';
}

/** Fire-and-forget. No-ops when Firebase/Analytics is off (local-only, tests, dev). */
export function logAnalyticsEvent(name: string, params?: AnalyticsParams): void {
  if (!analyticsEnabled()) return;
  void import('./analyticsApi')
    .then((mod) => mod.logAnalyticsEvent(name, params))
    .catch(() => {});
}

export function logPageView(pathname: string): void {
  logAnalyticsEvent(ANALYTICS_EVENTS.pageView, {
    page_path: pathname,
    page_name: pageNameFromPath(pathname),
  });
}

export function logVideoPlayerMode(
  fromMode: YoutubePlayerMode,
  toMode: YoutubePlayerMode,
): void {
  if (fromMode === toMode) return;
  logAnalyticsEvent(ANALYTICS_EVENTS.videoPlayerMode, {
    from_mode: fromMode,
    to_mode: toMode,
  });
}

export function logVideoTimelineSeek(options: {
  offsetSeconds: number;
  eventType?: string;
}): void {
  const params: AnalyticsParams = {
    offset_seconds: Math.round(options.offsetSeconds),
  };
  if (options.eventType) params.event_type = options.eventType;
  logAnalyticsEvent(ANALYTICS_EVENTS.videoTimelineSeek, params);
}

export function logDeleteItem(kind: AnalyticsDeleteKind): void {
  logAnalyticsEvent(ANALYTICS_EVENTS.itemDeleted, { item_kind: kind });
}
