import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from './database';
import {
  addGame,
  deleteGame,
  deleteMatch,
  getAdjacentGameId,
  getGamePlayers,
  getMatchById,
  getMatchGames,
  getMatchIdForGame,
  getMatchPlayers,
  toggleGamePlayer,
  toggleMatchPlayer,
} from './matchGame';
import { persistThrowGameEvent } from './gameEvents';
import { ThrowResult } from './statistics/constants';

function seedMatchWithTwoGames() {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home');
  const away = addTeam(data, 'Away');
  const h1 = addPlayer(data, home.Id, 'Alex');
  const a1 = addPlayer(data, away.Id, 'Casey');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  const game1 = addGame(data, match.Id);
  const game2 = addGame(data, match.Id);
  toggleGamePlayer(data, match.Id, game1, h1.Id);
  toggleGamePlayer(data, match.Id, game1, a1.Id);
  toggleGamePlayer(data, match.Id, game2, h1.Id);
  toggleGamePlayer(data, match.Id, game2, a1.Id);

  const gamePlayers = data.Tables.GamePlayer as {
    Id: string;
    GameId: string;
    MatchPlayerId: string;
  }[];
  const matchPlayers = data.Tables.MatchPlayer as {
    Id: string;
    PlayerId: string;
  }[];
  const homeGp = gamePlayers.find(
    (row) =>
      row.GameId === game1 &&
      matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === h1.Id,
  )!;
  const awayGp = gamePlayers.find(
    (row) =>
      row.GameId === game1 &&
      matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === a1.Id,
  )!;

  persistThrowGameEvent(data, game1, match.Id, [
    {
      throwerGamePlayerId: homeGp.Id,
      targetGamePlayerId: awayGp.Id,
      resultId: ThrowResult.Hit,
      deflections: [],
      recoveredId: undefined,
    },
  ]);

  return { data, match, game1, game2, home, away };
}

describe('getAdjacentGameId', () => {
  it('returns previous and next games in match order', () => {
    const { data, match, game1, game2 } = seedMatchWithTwoGames();
    expect(getAdjacentGameId(data, match.Id, game1, -1)).toBeNull();
    expect(getAdjacentGameId(data, match.Id, game1, 1)).toBe(game2);
    expect(getAdjacentGameId(data, match.Id, game2, -1)).toBe(game1);
    expect(getAdjacentGameId(data, match.Id, game2, 1)).toBeNull();
  });
});

describe('getMatchIdForGame', () => {
  it('resolves the parent match for a game', () => {
    const { data, match, game1, game2 } = seedMatchWithTwoGames();
    expect(getMatchIdForGame(data, game1)).toBe(match.Id);
    expect(getMatchIdForGame(data, game2)).toBe(match.Id);
    expect(getMatchIdForGame(data, 'missing')).toBeUndefined();
  });
});

describe('deleteGame / deleteMatch', () => {
  it('removes one game and its events without touching the other', () => {
    const { data, match, game1, game2 } = seedMatchWithTwoGames();
    deleteGame(data, match.Id, game1);

    const remaining = getMatchGames(data, match.Id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].gameId).toBe(game2);
    expect(remaining[0].label).toBe('Game 1');
    expect(getGamePlayers(data, game1)).toHaveLength(0);
    expect(
      (data.Tables.GameEvent as { GameId: string }[]).some(
        (row) => row.GameId === game1,
      ),
    ).toBe(false);
    expect(getGamePlayers(data, game2).length).toBeGreaterThan(0);
  });

  it('keeps a match roster player who already appears in a game', () => {
    const { data, match } = seedMatchWithTwoGames();
    const before = getMatchPlayers(data, match.Id);
    expect(before).toHaveLength(2);
    const playerId = before[0].PlayerId;
    toggleMatchPlayer(data, match.Id, playerId, before[0].TeamHome);
    expect(getMatchPlayers(data, match.Id)).toHaveLength(2);
  });

  it('removes a match, games, and roster while keeping teams', () => {
    const { data, match, home, away } = seedMatchWithTwoGames();
    deleteMatch(data, match.Id);

    expect(getMatchById(data, match.Id)).toBeUndefined();
    expect(getMatchGames(data, match.Id)).toHaveLength(0);
    expect(getMatchPlayers(data, match.Id)).toHaveLength(0);
    expect(
      (data.Tables.Team as { Id: string }[]).some((row) => row.Id === home.Id),
    ).toBe(true);
    expect(
      (data.Tables.Team as { Id: string }[]).some((row) => row.Id === away.Id),
    ).toBe(true);
  });
});
