import {
  hotkeyForTrackGameTab,
  hotkeysForTrackGameAction,
  type TrackGameAction,
  type TrackGameTab,
} from './hotkeys';

export type TourBodySegment =
  | string
  | { action: TrackGameAction }
  | { tab: TrackGameTab }
  | { key: string; label?: string };

export type TourBody = TourBodySegment[];

export type TourStepBody = string | TourBody;

export function isTourBodyArray(body: TourStepBody): body is TourBody {
  return Array.isArray(body);
}

/** Primary hotkey for a tour body segment (first key when an action has several). */
export function resolveTourBodyHotkey(segment: TourBodySegment): string | null {
  if (typeof segment === 'string') return null;
  if ('key' in segment) return segment.key;
  if ('tab' in segment) return hotkeyForTrackGameTab(segment.tab);
  const keys = hotkeysForTrackGameAction(segment.action);
  return keys[0] ?? null;
}
