import { beforeEach, describe, expect, it } from 'vitest';
import {
  COLOR_MODE_KEY,
  isColorModePreference,
  loadColorModePreference,
  resolveColorMode,
  saveColorModePreference,
} from './colorMode';

function mockLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
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
  return store;
}

describe('color mode preference', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('defaults to system when nothing is stored', () => {
    expect(loadColorModePreference()).toBe('system');
  });

  it('round-trips light, dark, and system', () => {
    saveColorModePreference('dark');
    expect(loadColorModePreference()).toBe('dark');
    expect(localStorage.getItem(COLOR_MODE_KEY)).toBe('dark');

    saveColorModePreference('light');
    expect(loadColorModePreference()).toBe('light');

    saveColorModePreference('system');
    expect(loadColorModePreference()).toBe('system');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(COLOR_MODE_KEY, 'sepia');
    expect(loadColorModePreference()).toBe('system');
    localStorage.setItem(COLOR_MODE_KEY, '');
    expect(loadColorModePreference()).toBe('system');
  });

  it('narrows known preference strings', () => {
    expect(isColorModePreference('system')).toBe(true);
    expect(isColorModePreference('light')).toBe(true);
    expect(isColorModePreference('dark')).toBe(true);
    expect(isColorModePreference('auto')).toBe(false);
  });
});

describe('resolveColorMode', () => {
  it('uses an explicit light or dark preference', () => {
    expect(resolveColorMode('light', true)).toBe('light');
    expect(resolveColorMode('dark', false)).toBe('dark');
  });

  it('follows the OS when preference is system', () => {
    expect(resolveColorMode('system', true)).toBe('dark');
    expect(resolveColorMode('system', false)).toBe('light');
  });
});
