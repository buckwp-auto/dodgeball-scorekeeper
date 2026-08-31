import { getMatches } from './database';
import {
  gameHasFinishEvent,
  getGameEventType,
  getGameEvents,
  getGameStartEvent,
  loadThrowDraftsFromEvent,
} from './gameEvents';
import { canNavigateToMatchPage } from './matchGame';
import {
  COLUMN_1_HOTKEYS,
  COLUMN_2_HOTKEYS,
  RESULT_HOTKEYS,
} from './hotkeys';
import type { OnboardingPlacement } from './onboarding';
import type { TourStepBody } from './tourContent';
import type { DatabaseDto, Guid } from './types';
import {
  YOUTUBE_FRAME_BACK_HOTKEY,
  YOUTUBE_FRAME_FORWARD_HOTKEY,
  YOUTUBE_PLAY_PAUSE_HOTKEY,
  YOUTUBE_SEEK_BACK_HOTKEY,
  YOUTUBE_SEEK_FORWARD_HOTKEY,
} from './youtube';

export type GameTrackingAnchor =
  | 'intro'
  | 'load-sample'
  | 'sync-bar'
  | 'nav-matches'
  | 'matches-list'
  | 'match-roster'
  | 'track-match'
  | 'add-game'
  | 'game-roster'
  | 'track-game'
  | 'game-start'
  | 'scoreboard'
  | 'editor-tabs'
  | 'throw-editor'
  | 'team-throw'
  | 'other-tab'
  | 'other-offenses'
  | 'finish-tab'
  | 'timeline';

export type GameTrackingTargets = {
  matchId: Guid;
  gameId?: Guid;
};

export type TourPlacement = OnboardingPlacement | 'left' | 'top-start' | 'top' | 'bottom';

export type GameTrackingAdvanceWhen =
  | 'manual'
  | 'on-track-game-page'
  | 'game-start-committed'
  | 'single-throw-committed'
  | 'team-throw-committed'
  | 'deflection-committed'
  | 'other-committed'
  | 'game-finished';

export type GameTrackingStep = {
  id: string;
  title: string;
  body: TourStepBody;
  anchor: GameTrackingAnchor;
  placement?: TourPlacement;
  /** Load the sample league when this step becomes active. */
  loadSample?: boolean;
  /** Create a fresh tour game when this step becomes active. */
  createGame?: boolean;
  /** Let the user click the highlighted UI during this step. */
  interactive?: boolean;
  advanceWhen?: GameTrackingAdvanceWhen;
};

export const GAME_TRACKING_STEPS: GameTrackingStep[] = [
  {
    id: 'intro',
    title: 'Track a game walkthrough',
    body:
      'This tour loads the demo league and walks you through scoring a brand-new game. ' +
      'Everything stays local — no account or cloud league required.',
    anchor: 'intro',
    placement: 'bottom-start',
  },
  {
    id: 'load-sample',
    title: 'Load the demo league',
    body:
      'The sample league includes six teams and ready-made match rosters. ' +
      'We load it for you on this step so you can practice without setup.',
    anchor: 'load-sample',
    placement: 'bottom-start',
    loadSample: true,
  },
  {
    id: 'local-only',
    title: 'Local only is fine',
    body:
      'The sync bar shows Local only while you experiment. Data lives in this browser tab until you export or close it — ' +
      'perfect for learning the scoring flow.',
    anchor: 'sync-bar',
    placement: 'right',
  },
  {
    id: 'matches-nav',
    title: 'Open Matches',
    body: 'Matches are where you set home and away teams, confirm rosters, and open games to score.',
    anchor: 'nav-matches',
    placement: 'right',
  },
  {
    id: 'match-list',
    title: 'Pick a match',
    body:
      'Each row is a series between two teams. Open one to confirm who is on the match roster before tracking games.',
    anchor: 'matches-list',
    placement: 'bottom-start',
  },
  {
    id: 'match-roster',
    title: 'Match roster',
    body:
      'Toggle players for this match — starters and subs. The demo match already has rosters filled in. ' +
      'Paste a YouTube URL here when you want video timestamps on events.',
    anchor: 'match-roster',
    placement: 'top-start',
  },
  {
    id: 'track-match',
    title: 'Track Match',
    body:
      'Open Track Match to see the game list for this series, add games, and jump into each game’s roster.',
    anchor: 'track-match',
    placement: 'bottom-start',
  },
  {
    id: 'add-game',
    title: 'Add a new game',
    body:
      'Each game is a single dodgeball game in the series. We add a fresh game for this tour — ' +
      'starters are auto-selected from the match roster.',
    anchor: 'add-game',
    placement: 'bottom-start',
    createGame: true,
  },
  {
    id: 'game-roster',
    title: 'Game roster',
    body:
      'Confirm who is on court for this game (up to your league’s players-per-side limit). ' +
      'Adjust starters if needed, then open Track Game when ready.',
    anchor: 'game-roster',
    placement: 'top-start',
    interactive: true,
  },
  {
    id: 'track-game',
    title: 'Open Track Game',
    body:
      'Track Game is the main scoring screen. Click the button when your roster looks right — ' +
      'the tour continues once you are on the scoring page.',
    anchor: 'track-game',
    placement: 'bottom-start',
    interactive: true,
    advanceWhen: 'on-track-game-page',
  },
  {
    id: 'game-start',
    title: 'Start the game',
    body:
      'Set the game-start timestamp (type a time or use From player when a YouTube URL is set). ' +
      'This anchors the match clock and video timeline for every event after it.',
    anchor: 'game-start',
    placement: 'bottom-start',
    interactive: true,
    advanceWhen: 'game-start-committed',
  },
  {
    id: 'scoreboard',
    title: 'Live scoreboard',
    body:
      'Match score, match clock, and players remaining update as you record events. ' +
      'With a YouTube VOD, the clock follows video time from Game start.',
    anchor: 'scoreboard',
    placement: 'bottom',
    interactive: true,
  },
  {
    id: 'throw-single',
    title: 'Record a throw',
    body: [
      'The basic loop: pick thrower, target, and result, then ',
      { action: 'done' },
      ' to save the event. Try ',
      { key: COLUMN_1_HOTKEYS[0]! },
      ' ',
      { key: COLUMN_2_HOTKEYS[0]! },
      ' ',
      { key: RESULT_HOTKEYS[0]! },
      ' (home thrower, away target, hit). ',
      'With video: ',
      { key: YOUTUBE_PLAY_PAUSE_HOTKEY, label: 'Space' },
      ' pauses; ',
      { key: YOUTUBE_SEEK_BACK_HOTKEY, label: '←' },
      ' / ',
      { key: YOUTUBE_SEEK_FORWARD_HOTKEY, label: '→' },
      ' rewind or skip 5s; ',
      { key: YOUTUBE_FRAME_BACK_HOTKEY },
      ' / ',
      { key: YOUTUBE_FRAME_FORWARD_HOTKEY },
      ' step frame-by-frame while paused. Record one single throw to continue.',
    ],
    anchor: 'throw-editor',
    placement: 'top',
    interactive: true,
    advanceWhen: 'single-throw-committed',
  },
  {
    id: 'throw-team',
    title: 'Team throw',
    body: [
      'Use Add Team Throw ',
      { action: 'addThrow' },
      ' when several players on the same team release at once. Fill out each row, then let the draft commit — record one team throw to continue.',
    ],
    anchor: 'team-throw',
    placement: 'bottom-start',
    interactive: true,
    advanceWhen: 'team-throw-committed',
  },
  {
    id: 'throw-deflection',
    title: 'Deflections',
    body: [
      'After a hit (or similar), press ',
      { action: 'addDeflection' },
      ' to add a deflection row, then pick who touched the ball and the result. Record one throw with a deflection to continue.',
    ],
    anchor: 'throw-editor',
    placement: 'top',
    interactive: true,
    advanceWhen: 'deflection-committed',
  },
  {
    id: 'other-tab',
    title: 'Other events',
    body: [
      'Open the Other tab with ',
      { tab: 'error' },
      '. Pick an offense — try Line out ',
      { key: '1' },
      ' — then select the player. Record any Other event to continue.',
    ],
    anchor: 'other-offenses',
    placement: 'right',
    interactive: true,
    advanceWhen: 'other-committed',
  },
  {
    id: 'finish-game',
    title: 'Finish the game',
    body: [
      'Keep recording outs until one whole side is eliminated — the app prompts you to finish. Use the Finish tab ',
      { tab: 'finish' },
      ' (or Done when prompted) to save the game result.',
    ],
    anchor: 'finish-tab',
    placement: 'bottom-start',
    interactive: true,
    advanceWhen: 'game-finished',
  },
  {
    id: 'timeline',
    title: 'Fix past events',
    body: [
      'The timeline lists every event newest-first. Select a row to edit players, results, or timestamps. Undo/redo ',
      { action: 'undo' },
      ' / ',
      { action: 'redo' },
      ' fixes the last committed event.',
    ],
    anchor: 'timeline',
    placement: 'left',
    interactive: true,
  },
];

export function resolveGameTrackingMatchId(data: DatabaseDto): Guid | null {
  const matches = getMatches(data);
  const navigable = matches.filter((row) => canNavigateToMatchPage(data, row.match.Id));
  const entry =
    navigable.find((row) => !row.match.YoutubeUrl?.trim()) ?? navigable[0] ?? matches[0];
  return entry?.match.Id ?? null;
}

export function resolveGameTrackingTargets(
  data: DatabaseDto,
  tourGameId?: Guid | null,
): GameTrackingTargets | null {
  const matchId = resolveGameTrackingMatchId(data);
  if (!matchId) return null;
  return tourGameId ? { matchId, gameId: tourGameId } : { matchId };
}

function throwEvents(data: DatabaseDto, gameId: Guid) {
  return getGameEvents(data, gameId).filter(
    (event) => getGameEventType(data, event.Id) === 'throw',
  );
}

export function gameHasSingleThrowEvent(data: DatabaseDto, gameId: Guid): boolean {
  return throwEvents(data, gameId).some((event) => {
    const drafts = loadThrowDraftsFromEvent(data, event.Id);
    return drafts.length === 1 && drafts[0]!.deflections.length === 0;
  });
}

export function gameHasTeamThrowEvent(data: DatabaseDto, gameId: Guid): boolean {
  return throwEvents(data, gameId).some((event) => loadThrowDraftsFromEvent(data, event.Id).length > 1);
}

export function gameHasDeflectionThrowEvent(data: DatabaseDto, gameId: Guid): boolean {
  return throwEvents(data, gameId).some((event) =>
    loadThrowDraftsFromEvent(data, event.Id).some((draft) => draft.deflections.length > 0),
  );
}

export function gameHasOtherEvent(data: DatabaseDto, gameId: Guid): boolean {
  return getGameEvents(data, gameId).some((event) => {
    const type = getGameEventType(data, event.Id);
    return type === 'error' || type === 'noBlocking';
  });
}

export function gameStartCommitted(data: DatabaseDto, gameId: Guid): boolean {
  const start = getGameStartEvent(data, gameId);
  if (start?.VideoOffsetSeconds != null) return true;
  return getGameEvents(data, gameId).some((event) => {
    const type = getGameEventType(data, event.Id);
    return type !== 'start';
  });
}

export function isOnTrackGameEventsPage(pathname: string, gameId: Guid): boolean {
  const escaped = gameId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`/games/${escaped}/events(?:/|$)`).test(pathname);
}

export function gameTrackingAdvanceMet(
  data: DatabaseDto,
  gameId: Guid | undefined,
  advanceWhen: GameTrackingAdvanceWhen | undefined,
  pathname: string,
): boolean {
  if (!advanceWhen || advanceWhen === 'manual') return true;
  if (!gameId) return false;

  switch (advanceWhen) {
    case 'on-track-game-page':
      return isOnTrackGameEventsPage(pathname, gameId);
    case 'game-start-committed':
      return gameStartCommitted(data, gameId);
    case 'single-throw-committed':
      return gameHasSingleThrowEvent(data, gameId);
    case 'team-throw-committed':
      return gameHasTeamThrowEvent(data, gameId);
    case 'deflection-committed':
      return gameHasDeflectionThrowEvent(data, gameId);
    case 'other-committed':
      return gameHasOtherEvent(data, gameId);
    case 'game-finished':
      return gameHasFinishEvent(data, gameId);
    default:
      return true;
  }
}

export function gameTrackingStepRoute(
  stepId: string,
  targets: GameTrackingTargets | null,
): string | undefined {
  if (!targets) {
    if (stepId === 'intro') return '/help';
    if (stepId === 'load-sample' || stepId === 'local-only') return '/';
    if (stepId === 'matches-nav' || stepId === 'match-list') return '/matches';
    return undefined;
  }

  const { matchId, gameId } = targets;

  switch (stepId) {
    case 'intro':
      return '/help';
    case 'load-sample':
    case 'local-only':
      return '/';
    case 'matches-nav':
    case 'match-list':
      return '/matches';
    case 'match-roster':
    case 'track-match':
      return `/matches/${matchId}`;
    case 'add-game':
      return `/matches/${matchId}/events`;
    case 'game-roster':
    case 'track-game':
      return gameId ? `/matches/${matchId}/games/${gameId}` : `/matches/${matchId}/events`;
    case 'game-start':
    case 'scoreboard':
    case 'throw-single':
    case 'throw-team':
    case 'throw-deflection':
    case 'other-tab':
    case 'other-offenses':
    case 'finish-game':
    case 'timeline':
      return gameId ? `/matches/${matchId}/games/${gameId}/events` : undefined;
    default:
      return undefined;
  }
}

export function gameTrackingAnchorSelector(anchor: GameTrackingAnchor): string {
  if (anchor === 'sync-bar') {
    return '[data-onboarding="sync-bar"]';
  }
  if (anchor === 'nav-matches') {
    return '[data-onboarding="nav-matches"]';
  }
  return `[data-tour="${anchor}"]`;
}
