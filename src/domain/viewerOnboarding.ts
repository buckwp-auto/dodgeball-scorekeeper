import {
  viewerLeaguesHref,
  viewerPlayersHref,
  viewerStatsHref,
} from './viewerRoutes';

export const VIEWER_ONBOARDING_COMPLETE_KEY =
  'SCOREKEEPER_VIEWER_ONBOARDING_COMPLETE';

export type ViewerOnboardingAnchor =
  | 'viewer-leagues-main'
  | 'viewer-nav-leagues'
  | 'viewer-nav-stats'
  | 'viewer-nav-players'
  | 'sync-bar';

export type ViewerOnboardingPlacement = 'right' | 'bottom-start';

export type ViewerOnboardingStep = {
  id: string;
  title: string;
  body: string;
  anchor: ViewerOnboardingAnchor;
  /** Navigate here when this step becomes active so the matching nav tab is selected. */
  route?: string;
  placement?: ViewerOnboardingPlacement;
};

export const VIEWER_ONBOARDING_STEPS: ViewerOnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to League stats',
    body:
      'This is a read-only view of shared leagues. Sign in with Google, pick a league, ' +
      'then browse standings, leaderboards, and player pages — no scorekeeping from here.',
    anchor: 'viewer-leagues-main',
    route: viewerLeaguesHref(),
    placement: 'bottom-start',
  },
  {
    id: 'leagues',
    title: 'Leagues',
    body:
      'Open a league with View. You do not need to join as a scorer. ' +
      'Close returns you here without writing anything to the cloud.',
    anchor: 'viewer-nav-leagues',
    route: viewerLeaguesHref(),
    placement: 'right',
  },
  {
    id: 'stats',
    title: 'Stats',
    body:
      'Standings, player tables, leaderboards, and charts for the open league. ' +
      'You can also drill into a match or game from the scope menus.',
    anchor: 'viewer-nav-stats',
    route: viewerStatsHref(),
    placement: 'right',
  },
  {
    id: 'players',
    title: 'Players',
    body:
      'Browse the league roster and open a player page for season stats, ranks, and highlights.',
    anchor: 'viewer-nav-players',
    route: viewerPlayersHref(),
    placement: 'right',
  },
  {
    id: 'sync',
    title: 'Open league',
    body:
      'This bar shows which cloud league you are viewing. It stays read-only — ' +
      'changes are never synced from this shell.',
    anchor: 'sync-bar',
    route: viewerLeaguesHref(),
    placement: 'right',
  },
];

export function isViewerOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(VIEWER_ONBOARDING_COMPLETE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markViewerOnboardingComplete(): void {
  try {
    localStorage.setItem(VIEWER_ONBOARDING_COMPLETE_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearViewerOnboardingComplete(): void {
  try {
    localStorage.removeItem(VIEWER_ONBOARDING_COMPLETE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function viewerOnboardingAnchorSelector(
  anchor: ViewerOnboardingAnchor,
): string {
  return `[data-onboarding="${anchor}"]`;
}
