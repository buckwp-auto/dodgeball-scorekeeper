import type { LastScoringStored } from './lastScoring';
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
  trackGame: MatchNavAction & { label: string };
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

/**
 * Prefer the game currently in the URL, then the last game opened for this
 * match, then the match’s last game.
 */
export function resolveMatchTrackGameId(
  data: DatabaseDto,
  matchId: Guid,
  pathname: string,
  lastScoring: LastScoringStored | null,
): Guid | null {
  const games = getMatchGames(data, matchId);
  if (games.length === 0) return null;

  const gameFromUrl = gameIdFromPath(pathname);
  if (gameFromUrl != null && games.some((game) => game.gameId === gameFromUrl)) {
    return gameFromUrl;
  }

  if (
    lastScoring?.target === 'game' &&
    lastScoring.matchId === matchId &&
    games.some((game) => game.gameId === lastScoring.gameId)
  ) {
    return lastScoring.gameId;
  }

  return games.at(-1)?.gameId ?? null;
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
  lastScoring: LastScoringStored | null = null,
): MatchNavTargets | null {
  if (!getMatchById(data, matchId)) return null;

  const statsImported = isStatsImportedMatchId(data, matchId);
  const games = getMatchGames(data, matchId);
  const trackGameId = resolveMatchTrackGameId(data, matchId, pathname, lastScoring);
  const trackGame = trackGameId != null
    ? games.find((game) => game.gameId === trackGameId) ?? null
    : null;

  const goToMatchHref = statsImported
    ? `/matches/${matchId}/stats`
    : `/matches/${matchId}`;

  const trackGameHref =
    trackGameId != null ? gameTrackHref(data, matchId, trackGameId) : '';
  const trackGameDisabled = statsImported || trackGameId == null;

  return {
    goToMatch: {
      href: goToMatchHref,
      disabled: pathsEqual(pathname, goToMatchHref),
      current: pathsEqual(pathname, goToMatchHref),
    },
    trackGame: {
      href: trackGameHref,
      disabled: trackGameDisabled,
      current: trackGameHref !== '' && pathsEqual(pathname, trackGameHref),
      label: trackGame != null ? `Track ${trackGame.label}` : 'Track Game',
    },
    copyStatsEnabled: true,
  };
}
