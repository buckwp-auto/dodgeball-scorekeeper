export const ONBOARDING_COMPLETE_KEY = 'SCOREKEEPER_ONBOARDING_COMPLETE';

export type OnboardingAnchor =
  | 'overview-main'
  | 'nav-teams'
  | 'nav-matches'
  | 'nav-stats'
  | 'nav-settings'
  | 'nav-help'
  | 'sync-bar';

export type OnboardingPlacement = 'right' | 'bottom-start';

export type OnboardingStep = {
  id: string;
  title: string;
  body: string;
  anchor: OnboardingAnchor;
  /** Navigate here when this step becomes active so the matching nav tab is selected. */
  route?: string;
  /** Popper placement relative to the anchor. */
  placement?: OnboardingPlacement;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Scorekeeper',
    body:
      'Track dodgeball matches, rosters, and stats in your browser. ' +
      'Start on Overview by loading a file or the sample league, then use the menu to move around.',
    anchor: 'overview-main',
    route: '/',
    placement: 'bottom-start',
  },
  {
    id: 'teams',
    title: 'Teams & players',
    body:
      'Create teams and rosters here. Add player photos, link guest subs to league players, ' +
      'and open a player page for career stats.',
    anchor: 'nav-teams',
    route: '/teams',
    placement: 'right',
  },
  {
    id: 'matches',
    title: 'Matches & scoring',
    body:
      'Create a match, pick rosters, and open Track Game to record throws, outs, and finishes. ' +
      'Resume an in-progress game from the drawer when you return.',
    anchor: 'nav-matches',
    route: '/matches',
    placement: 'right',
  },
  {
    id: 'stats',
    title: 'League stats',
    body:
      'Leaderboards, standings, and charts for the open league, a match, or a single game. ' +
      'Export CSV from match or stats screens.',
    anchor: 'nav-stats',
    route: '/stats',
    placement: 'right',
  },
  {
    id: 'settings',
    title: 'League stat settings',
    body:
      'Set players per side, highlight minimums, and stat-credit policy. ' +
      'Local leagues can edit anytime; cloud leagues are admin-only.',
    anchor: 'nav-settings',
    route: '/settings',
    placement: 'right',
  },
  {
    id: 'help',
    title: 'Help & FAQ',
    body:
      'How-to guides and answers to common questions live here. ' +
      'You can restart this tour anytime from the Help page.',
    anchor: 'nav-help',
    route: '/help',
    placement: 'right',
  },
  {
    id: 'sync',
    title: 'Local or cloud',
    body:
      'This bar shows whether you are local-only or syncing a shared league. ' +
      'Sign in on Overview to join or create a cloud league (optional).',
    anchor: 'sync-bar',
    route: '/',
    placement: 'right',
  },
];

export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearOnboardingComplete(): void {
  try {
    localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function onboardingAnchorSelector(anchor: OnboardingAnchor): string {
  return `[data-onboarding="${anchor}"]`;
}
