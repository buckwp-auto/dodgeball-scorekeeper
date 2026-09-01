import { beforeEach, describe, expect, it } from 'vitest';
import {
  TRACK_GAME_TALL_PANEL_DEFAULT_WIDTH,
  TRACK_GAME_TALL_PANEL_MIN_WIDTH,
  TRACK_GAME_TALL_PANEL_WIDTH_KEY,
  clampTrackGameTallPanelWidth,
  loadTrackGameTallPanelWidth,
  saveTrackGameTallPanelWidth,
} from './trackGameTallPanel';

describe('trackGameTallPanel', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
      },
    });
  });

  it('clamps panel width to min and viewport ratio', () => {
    expect(clampTrackGameTallPanelWidth(120, 1200)).toBe(TRACK_GAME_TALL_PANEL_MIN_WIDTH);
    expect(clampTrackGameTallPanelWidth(900, 1200)).toBe(660);
    expect(clampTrackGameTallPanelWidth(420, 1200)).toBe(420);
  });

  it('round-trips width in session storage', () => {
    saveTrackGameTallPanelWidth(412);
    expect(sessionStorage.getItem(TRACK_GAME_TALL_PANEL_WIDTH_KEY)).toBe('412');
    expect(loadTrackGameTallPanelWidth()).toBe(412);
  });

  it('falls back to the default width', () => {
    sessionStorage.setItem(TRACK_GAME_TALL_PANEL_WIDTH_KEY, 'not-a-number');
    expect(loadTrackGameTallPanelWidth()).toBe(TRACK_GAME_TALL_PANEL_DEFAULT_WIDTH);
  });
});
