import { getMatchName, getMatches, getPlayersForTeam, getTeams } from './database';
import {
  getMatchGames,
  getMatchPlayers,
  isPlayerInGame,
} from './matchGame';
import { getPlayerIdsForProfile } from './playerMatch';
import type { DatabaseDto, Guid } from './types';

export function playerHref(playerId: Guid): string {
  return `/players/${playerId}`;
}

export type PlayerDirectoryRow = {
  playerId: Guid;
  playerName: string;
  teamName: string;
};

export function listPlayersForDirectory(data: DatabaseDto): PlayerDirectoryRow[] {
  const rows: PlayerDirectoryRow[] = [];
  for (const team of getTeams(data)) {
    for (const player of getPlayersForTeam(data, team.Id)) {
      if (player.LinkedPlayerId) continue;
      rows.push({
        playerId: player.Id,
        playerName: player.Name,
        teamName: team.Name,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      a.playerName.localeCompare(b.playerName) ||
      a.teamName.localeCompare(b.teamName) ||
      a.playerId.localeCompare(b.playerId),
  );
}

export type PlayerGameAppearance = {
  matchId: Guid;
  matchName: string;
  gameId: Guid;
  gameName: string;
  scoringComplete: boolean;
  substitute: boolean;
};

export function getPlayerGamesPlayed(
  data: DatabaseDto,
  playerId: Guid,
): PlayerGameAppearance[] {
  const ids = new Set(getPlayerIdsForProfile(data, playerId));
  const appearances: PlayerGameAppearance[] = [];
  for (const { match } of getMatches(data)) {
    const matchPlayers = getMatchPlayers(data, match.Id).filter((row) =>
      ids.has(row.PlayerId),
    );
    if (matchPlayers.length === 0) continue;
    const matchName = getMatchName(data, match);
    for (const game of getMatchGames(data, match.Id)) {
      const onGame = matchPlayers.filter((row) =>
        isPlayerInGame(data, game.gameId, row.PlayerId, match.Id),
      );
      if (onGame.length === 0) continue;
      appearances.push({
        matchId: match.Id,
        matchName,
        gameId: game.gameId,
        gameName: game.label,
        scoringComplete: game.scoringComplete,
        substitute: onGame.some((row) => Boolean(row.IsSubstitute)),
      });
    }
  }
  return appearances;
}
