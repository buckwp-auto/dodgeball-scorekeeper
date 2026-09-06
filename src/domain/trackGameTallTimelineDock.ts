export const TRACK_GAME_TALL_TIMELINE_DOCK_KEY = 'SCOREKEEPER_TRACK_GAME_TALL_TIMELINE_DOCK';

export type TrackGameTallTimelineDock = 'bottom' | 'right';

export function loadTrackGameTallTimelineDock(): TrackGameTallTimelineDock {
  try {
    const raw = sessionStorage.getItem(TRACK_GAME_TALL_TIMELINE_DOCK_KEY);
    if (raw === 'right' || raw === 'bottom') return raw;
  } catch {
    /* ignore */
  }
  return 'bottom';
}

export function saveTrackGameTallTimelineDock(dock: TrackGameTallTimelineDock): void {
  try {
    sessionStorage.setItem(TRACK_GAME_TALL_TIMELINE_DOCK_KEY, dock);
  } catch {
    /* ignore quota / private mode */
  }
}
