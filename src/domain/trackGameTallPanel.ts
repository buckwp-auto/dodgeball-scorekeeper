export const TRACK_GAME_TALL_PANEL_WIDTH_KEY = 'SCOREKEEPER_TRACK_GAME_TALL_PANEL_WIDTH';

export const TRACK_GAME_TALL_PANEL_MIN_WIDTH = 280;
export const TRACK_GAME_TALL_PANEL_DEFAULT_WIDTH = 360;
export const TRACK_GAME_TALL_PANEL_MAX_VIEWPORT_RATIO = 0.55;

export function clampTrackGameTallPanelWidth(
  width: number,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280,
): number {
  const max = Math.max(
    TRACK_GAME_TALL_PANEL_MIN_WIDTH,
    Math.floor(viewportWidth * TRACK_GAME_TALL_PANEL_MAX_VIEWPORT_RATIO),
  );
  return Math.min(max, Math.max(TRACK_GAME_TALL_PANEL_MIN_WIDTH, Math.round(width)));
}

export function loadTrackGameTallPanelWidth(): number {
  try {
    const raw = sessionStorage.getItem(TRACK_GAME_TALL_PANEL_WIDTH_KEY);
    if (!raw) return TRACK_GAME_TALL_PANEL_DEFAULT_WIDTH;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return TRACK_GAME_TALL_PANEL_DEFAULT_WIDTH;
    return clampTrackGameTallPanelWidth(parsed);
  } catch {
    return TRACK_GAME_TALL_PANEL_DEFAULT_WIDTH;
  }
}

export function saveTrackGameTallPanelWidth(width: number): void {
  try {
    sessionStorage.setItem(
      TRACK_GAME_TALL_PANEL_WIDTH_KEY,
      String(clampTrackGameTallPanelWidth(width)),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
