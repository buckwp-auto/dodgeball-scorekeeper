import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatVideoTime,
  loadYoutubePlayerMode,
  parseVideoTime,
  parseYoutubeVideoId,
  saveYoutubePlayerMode,
  YOUTUBE_FRAME_SECONDS,
  YOUTUBE_PLAYER_MODE_KEY,
} from './youtube';

describe('parseYoutubeVideoId', () => {
  it('parses watch, short, embed, and bare ids', () => {
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(parseYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(parseYoutubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-youtube urls', () => {
    expect(parseYoutubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYoutubeVideoId('')).toBeNull();
  });
});

describe('formatVideoTime', () => {
  it('formats mm:ss and h:mm:ss', () => {
    expect(formatVideoTime(0)).toBe('0:00');
    expect(formatVideoTime(62)).toBe('1:02');
    expect(formatVideoTime(3661)).toBe('1:01:01');
  });
});

describe('parseVideoTime', () => {
  it('parses m:ss, h:mm:ss, and plain seconds', () => {
    expect(parseVideoTime('1:02')).toBe(62);
    expect(parseVideoTime('1:01:01')).toBe(3661);
    expect(parseVideoTime('90')).toBe(90);
    expect(parseVideoTime('')).toBeNull();
    expect(parseVideoTime('nope')).toBeNull();
  });
});

describe('youtube player mode', () => {
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

  it('defaults to tall and persists', () => {
    expect(loadYoutubePlayerMode()).toBe('tall');
    saveYoutubePlayerMode('docked');
    expect(loadYoutubePlayerMode()).toBe('docked');
  });

  it('migrates legacy expand/compact values', () => {
    sessionStorage.setItem(YOUTUBE_PLAYER_MODE_KEY, 'expanded');
    expect(loadYoutubePlayerMode()).toBe('tall');
    sessionStorage.setItem(YOUTUBE_PLAYER_MODE_KEY, 'compact');
    expect(loadYoutubePlayerMode()).toBe('docked');
  });
});
describe('YOUTUBE_FRAME_SECONDS', () => {
  it('is ~1/30s', () => {
    expect(YOUTUBE_FRAME_SECONDS).toBeCloseTo(1 / 30);
  });
});
