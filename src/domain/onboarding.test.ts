import { afterEach, describe, expect, it } from 'vitest';
import {
  ONBOARDING_COMPLETE_KEY,
  ONBOARDING_STEPS,
  clearOnboardingComplete,
  isOnboardingComplete,
  markOnboardingComplete,
  onboardingAnchorSelector,
} from './onboarding';

const storage = new Map<string, string>();

afterEach(() => {
  storage.clear();
});

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => storage.clear(),
  },
});

describe('onboarding storage', () => {
  it('starts incomplete', () => {
    expect(isOnboardingComplete()).toBe(false);
  });

  it('marks complete', () => {
    markOnboardingComplete();
    expect(isOnboardingComplete()).toBe(true);
    expect(storage.get(ONBOARDING_COMPLETE_KEY)).toBe('1');
  });

  it('clears completion for tour restart', () => {
    markOnboardingComplete();
    clearOnboardingComplete();
    expect(isOnboardingComplete()).toBe(false);
  });
});

describe('onboarding steps', () => {
  it('defines a welcome-through-sync tour', () => {
    expect(ONBOARDING_STEPS.length).toBeGreaterThanOrEqual(5);
    expect(ONBOARDING_STEPS[0]?.id).toBe('welcome');
    expect(ONBOARDING_STEPS.at(-1)?.anchor).toBe('sync-bar');
  });

  it('builds stable anchor selectors', () => {
    expect(onboardingAnchorSelector('nav-matches')).toBe('[data-onboarding="nav-matches"]');
  });

  it('navigates to each section so the drawer tab is selected', () => {
    const navSteps = ONBOARDING_STEPS.filter((step) => step.anchor.startsWith('nav-'));
    expect(navSteps.every((step) => step.route?.startsWith('/'))).toBe(true);
  });
});
