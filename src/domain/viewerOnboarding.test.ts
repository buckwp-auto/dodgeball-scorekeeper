import { afterEach, describe, expect, it } from 'vitest';
import {
  VIEWER_ONBOARDING_COMPLETE_KEY,
  VIEWER_ONBOARDING_STEPS,
  clearViewerOnboardingComplete,
  isViewerOnboardingComplete,
  markViewerOnboardingComplete,
  viewerOnboardingAnchorSelector,
} from './viewerOnboarding';

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

describe('viewer onboarding storage', () => {
  it('starts incomplete', () => {
    expect(isViewerOnboardingComplete()).toBe(false);
  });

  it('marks complete independently of the scorekeeper key', () => {
    markViewerOnboardingComplete();
    expect(isViewerOnboardingComplete()).toBe(true);
    expect(storage.get(VIEWER_ONBOARDING_COMPLETE_KEY)).toBe('1');
    expect(storage.get('SCOREKEEPER_ONBOARDING_COMPLETE')).toBeUndefined();
  });

  it('clears completion for tour restart', () => {
    markViewerOnboardingComplete();
    clearViewerOnboardingComplete();
    expect(isViewerOnboardingComplete()).toBe(false);
  });
});

describe('viewer onboarding steps', () => {
  it('stays under /view-stats', () => {
    expect(VIEWER_ONBOARDING_STEPS.length).toBeGreaterThanOrEqual(4);
    expect(VIEWER_ONBOARDING_STEPS[0]?.id).toBe('welcome');
    for (const step of VIEWER_ONBOARDING_STEPS) {
      if (step.route) {
        expect(step.route.startsWith('/view-stats')).toBe(true);
      }
    }
  });

  it('builds stable anchor selectors', () => {
    expect(viewerOnboardingAnchorSelector('viewer-nav-stats')).toBe(
      '[data-onboarding="viewer-nav-stats"]',
    );
  });
});
