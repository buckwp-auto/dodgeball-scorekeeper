import { beforeEach, describe, expect, it } from 'vitest';
import {
  TRACK_GAME_TALL_TIMELINE_DOCK_KEY,
  loadTrackGameTallTimelineDock,
  saveTrackGameTallTimelineDock,
} from './trackGameTallTimelineDock';

describe('trackGameTallTimelineDock', () => {
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
      },
    });
  });

  it('defaults to bottom', () => {
    expect(loadTrackGameTallTimelineDock()).toBe('bottom');
  });

  it('round-trips right dock', () => {
    saveTrackGameTallTimelineDock('right');
    expect(sessionStorage.getItem(TRACK_GAME_TALL_TIMELINE_DOCK_KEY)).toBe('right');
    expect(loadTrackGameTallTimelineDock()).toBe('right');
  });

  it('ignores unknown values', () => {
    sessionStorage.setItem(TRACK_GAME_TALL_TIMELINE_DOCK_KEY, 'sideways');
    expect(loadTrackGameTallTimelineDock()).toBe('bottom');
  });
});
