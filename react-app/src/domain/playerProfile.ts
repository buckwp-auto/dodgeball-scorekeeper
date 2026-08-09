import { getMatchName, getMatches } from './database';
import {
  getMatchGames,
  isPlayerInGame,
  isPlayerInMatch,
} from './matchGame';
import type { DatabaseDto, Guid } from './types';

export function playerHref(playerId: Guid): string {
  return `/players/${playerId}`;
}

export type PlayerGameAppearance = {
  matchId: Guid;
  matchName: string;
  gameId: Guid;
  gameName: string;
  scoringComplete: boolean;
};

export function getPlayerGamesPlayed(
  data: DatabaseDto,
  playerId: Guid,
): PlayerGameAppearance[] {
  const appearances: PlayerGameAppearance[] = [];
  for (const { match } of getMatches(data)) {
    if (!isPlayerInMatch(data, match.Id, playerId)) continue;
    const matchName = getMatchName(data, match);
    for (const game of getMatchGames(data, match.Id)) {
      if (!isPlayerInGame(data, game.gameId, playerId, match.Id)) continue;
      appearances.push({
        matchId: match.Id,
        matchName,
        gameId: game.gameId,
        gameName: game.label,
        scoringComplete: game.scoringComplete,
      });
    }
  }
  return appearances;
}
