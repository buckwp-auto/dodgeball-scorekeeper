import { lastStampedVideoOffsetInGame } from './gameEvents';
import { getMatchById, getMatchGames } from './matchGame';
import type { DatabaseDto, Guid, MatchRow } from './types';

export function isMatchEnded(match: MatchRow | undefined | null): boolean {
  return Boolean(match?.Ended);
}

/**
 * Video time for a match-end log row: last game's finish stamp, or that game's
 * last stamped event when there is no finish.
 */
export function matchEndVideoOffsetSeconds(
  data: DatabaseDto,
  matchId: Guid,
): number | null {
  const games = getMatchGames(data, matchId);
  const last = games[games.length - 1];
  if (!last) return null;
  return lastStampedVideoOffsetInGame(data, last.gameId);
}

export function endMatch(data: DatabaseDto, matchId: Guid): void {
  const match = getMatchById(data, matchId);
  if (!match) throw new Error('Match not found');
  if (match.Ended) return;
  match.Ended = true;
  match.EndedVideoOffsetSeconds = matchEndVideoOffsetSeconds(data, matchId);
}

export function undoEndMatch(data: DatabaseDto, matchId: Guid): void {
  const match = getMatchById(data, matchId);
  if (!match) throw new Error('Match not found');
  delete match.Ended;
  delete match.EndedVideoOffsetSeconds;
}
