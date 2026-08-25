import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LOCAL_LEAGUE_LABEL_KEY,
  loadLocalLeagueLabel,
  localLeagueLabelFromFilename,
  saveLocalLeagueLabel,
} from './localLeagueLabel';

describe('localLeagueLabelFromFilename', () => {
  it('strips .scrkpr extension', () => {
    expect(localLeagueLabelFromFilename('Spring League.scrkpr')).toBe(
      'Spring League',
    );
    expect(localLeagueLabelFromFilename('demo.SCRKPR')).toBe('demo');
  });

  it('keeps names without extension', () => {
    expect(localLeagueLabelFromFilename('My League')).toBe('My League');
  });

  it('falls back for empty input', () => {
    expect(localLeagueLabelFromFilename('')).toBe('Local league');
    expect(localLeagueLabelFromFilename('   ')).toBe('Local league');
  });
});

describe('local league label session storage', () => {
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

  afterEach(() => {
    sessionStorage.removeItem(LOCAL_LEAGUE_LABEL_KEY);
  });

  it('round-trips a label', () => {
    saveLocalLeagueLabel('Spring League');
    expect(loadLocalLeagueLabel()).toBe('Spring League');
  });

  it('clears on null or blank', () => {
    saveLocalLeagueLabel('Spring League');
    saveLocalLeagueLabel(null);
    expect(loadLocalLeagueLabel()).toBeNull();
    saveLocalLeagueLabel('  ');
    expect(loadLocalLeagueLabel()).toBeNull();
  });
});
