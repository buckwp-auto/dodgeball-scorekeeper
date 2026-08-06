import type { DatabaseDto, Guid } from './types';
import {
  getMatchById,
  getMatchPlayers,
  getMatchSidePlayers,
  isPlayerInGame,
  isPlayerInMatch,
  toggleGamePlayer,
  toggleMatchPlayer,
} from './matchGame';

export const AUTO_SELECT_PLAYER_LIMIT = 6;

/** @returns true if any players were added to the match roster */
export function autoSelectMatchRoster(data: DatabaseDto, matchId: Guid): boolean {
  const match = getMatchById(data, matchId);
  if (!match) return false;
  let changed = false;
  const homePlayers = getMatchSidePlayers(data, match, true).slice(0, AUTO_SELECT_PLAYER_LIMIT);
  const awayPlayers = getMatchSidePlayers(data, match, false).slice(0, AUTO_SELECT_PLAYER_LIMIT);
  for (const player of homePlayers) {
    if (!isPlayerInMatch(data, matchId, player.Id)) {
      toggleMatchPlayer(data, matchId, player.Id, true);
      changed = true;
    }
  }
  for (const player of awayPlayers) {
    if (!isPlayerInMatch(data, matchId, player.Id)) {
      toggleMatchPlayer(data, matchId, player.Id, false);
      changed = true;
    }
  }
  return changed;
}

/** @returns true if any players were added to the game roster */
export function autoSelectGameRoster(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
): boolean {
  const matchPlayerRows = getMatchPlayers(data, matchId);
  const playerIds = [
    ...matchPlayerRows.filter((row) => row.TeamHome).slice(0, AUTO_SELECT_PLAYER_LIMIT),
    ...matchPlayerRows.filter((row) => !row.TeamHome).slice(0, AUTO_SELECT_PLAYER_LIMIT),
  ].map((row) => row.PlayerId);

  let changed = false;
  for (const playerId of playerIds) {
    if (!isPlayerInGame(data, gameId, playerId, matchId)) {
      toggleGamePlayer(data, matchId, gameId, playerId);
      changed = true;
    }
  }
  return changed;
}
