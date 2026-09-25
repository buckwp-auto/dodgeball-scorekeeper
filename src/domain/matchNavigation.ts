import { buildStatisticsCsvText } from './statisticsCsv';
import { isStatsImportedMatchId } from './importedMatch';
import {
  canNavigateToGameEvents,
  getMatchById,
  getMatchGames,
} from './matchGame';
import type { DatabaseDto, Guid } from './types';

export type MatchNavAction = {
  href: string;
  disabled: boolean;
  current: boolean;
};

export type MatchNavTargets = {
  goToMatch: MatchNavAction;
  trackGame: MatchNavAction;
  continueGame: MatchNavAction;
  copyStatsEnabled: boolean;
};

/** Game id from a match game route, or null. */
export function gameIdFromPath(pathname: string): Guid | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'matches' && parts[2] === 'games' && parts[3]) {
    return parts[3];
  }
  return null;
}

export function gameTrackHref(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
): string {
  if (canNavigateToGameEvents(data, matchId, gameId)) {
    return `/matches/${matchId}/games/${gameId}/events`;
  }
  return `/matches/${matchId}/games/${gameId}`;
}

export function activeMatchGameId(data: DatabaseDto, matchId: Guid): Guid | null {
  return getMatchGames(data, matchId).find((game) => !game.scoringComplete)?.gameId ?? null;
}

export function formatStatisticsCsvForClipboard(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^"|"$/g, '')
        .split('","')
        .join('\t'),
    )
    .join('\n');
}

export function buildMatchStatisticsClipboardTsv(
  data: DatabaseDto,
  matchId: Guid,
): string {
  return formatStatisticsCsvForClipboard(buildStatisticsCsvText(data, matchId));
}

function pathsEqual(a: string, b: string): boolean {
  return a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
}

/** Drawer match shortcuts while viewing a match (any nested route). */
export function resolveMatchNavTargets(
  data: DatabaseDto,
  matchId: Guid,
  pathname: string,
): MatchNavTargets | null {
  if (!getMatchById(data, matchId)) return null;

  const statsImported = isStatsImportedMatchId(data, matchId);
  const games = getMatchGames(data, matchId);
  const gameFromUrl = gameIdFromPath(pathname);
  const activeGameId = activeMatchGameId(data, matchId);
  const lastGameId = games.at(-1)?.gameId ?? null;

  const goToMatchHref = statsImported
    ? `/matches/${matchId}/stats`
    : `/matches/${matchId}`;

  const trackGameId = gameFromUrl ?? activeGameId ?? lastGameId;
  const trackGameHref =
    trackGameId != null
      ? gameTrackHref(data, matchId, trackGameId)
      : `/matches/${matchId}/events`;
  const trackGameDisabled = statsImported || (trackGameId == null && games.length === 0);

  const continueGameHref =
    activeGameId != null ? gameTrackHref(data, matchId, activeGameId) : '';
  const continueGameDisabled = statsImported || activeGameId == null;

  return {
    goToMatch: {
      href: goToMatchHref,
      disabled: pathsEqual(pathname, goToMatchHref),
      current: pathsEqual(pathname, goToMatchHref),
    },
    trackGame: {
      href: trackGameHref,
      disabled: trackGameDisabled,
      current: pathsEqual(pathname, trackGameHref),
    },
    continueGame: {
      href: continueGameHref,
      disabled: continueGameDisabled,
      current:
        continueGameHref !== '' && pathsEqual(pathname, continueGameHref),
    },
    copyStatsEnabled: true,
  };
}
