import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from './database';
import { setLeagueSettings } from './leagueSettings';
import {
  addGame,
  addPlayerToGameSide,
  addPlayerToMatchSide,
  countGameSidePlayers,
  deleteGame,
  deleteMatch,
  getAdjacentGameId,
  getGamePlayers,
  getMatchById,
  getMatchGames,
  getMatchIdForGame,
  getMatchPlayers,
  getMatchSidePlayersWithSelection,
  isPlayerInGame,
  setMatchPlayerSubstitute,
  toggleGamePlayer,
  toggleMatchPlayer,
} from './matchGame';
import { LEGACY_POLICY } from './statistics/statCreditPolicy';
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

describe('match substitutes', () => {
  it('adds a player to the team and match roster, optionally as a sub', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const match = addMatch(data, home.Id, away.Id);
    const starter = addPlayerToMatchSide(data, match.Id, true, 'Alex');
    const sub = addPlayerToMatchSide(data, match.Id, true, 'Pat', true);
    expect(starter.AddedFromMatch).toBe(true);
    expect(sub.AddedFromMatch).toBe(true);

    const rows = getMatchPlayers(data, match.Id);
    expect(rows.find((row) => row.PlayerId === starter.Id)?.IsSubstitute).toBeFalsy();
    expect(rows.find((row) => row.PlayerId === sub.Id)?.IsSubstitute).toBe(true);

    const listed = getMatchSidePlayersWithSelection(data, match, true);
    expect(listed.map((row) => row.player.Name)).toEqual(['Alex', 'Pat']);
    expect(listed[0]?.substitute).toBe(false);
    expect(listed[1]?.substitute).toBe(true);

    setMatchPlayerSubstitute(data, match.Id, starter.Id, true);
    expect(getMatchPlayers(data, match.Id).find((row) => row.PlayerId === starter.Id)?.IsSubstitute).toBe(
      true,
    );
  });

  it('sorts selected starters before selected subs, then by name', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const match = addMatch(data, home.Id, away.Id);
    addPlayerToMatchSide(data, match.Id, true, 'Zoe', true);
    addPlayerToMatchSide(data, match.Id, true, 'Amy');
    addPlayerToMatchSide(data, match.Id, true, 'Pat');
    const listed = getMatchSidePlayersWithSelection(data, match, true);
    expect(listed.map((row) => row.player.Name)).toEqual(['Amy', 'Pat', 'Zoe']);

    setMatchPlayerSubstitute(data, match.Id, listed[0].player.Id, true);
    expect(
      getMatchSidePlayersWithSelection(data, match, true).map((row) => row.player.Name),
    ).toEqual(['Pat', 'Amy', 'Zoe']);
  });

  it('adds a player to the match and this game from the game screen', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const match = addMatch(data, home.Id, away.Id);
    const gameId = addGame(data, match.Id);
    const player = addPlayerToGameSide(data, match.Id, gameId, true, 'Remy');
    expect(getMatchPlayers(data, match.Id).some((row) => row.PlayerId === player.Id)).toBe(
      true,
    );
    expect(isPlayerInGame(data, gameId, player.Id, match.Id)).toBe(true);
  });
});

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

describe('game roster limit', () => {
  it('refuses more than the league players-per-side cap', () => {
    const data = createEmptyDatabase();
    setLeagueSettings(data, LEGACY_POLICY, undefined, 2);
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const h1 = addPlayer(data, home.Id, 'H1');
    const h2 = addPlayer(data, home.Id, 'H2');
    const h3 = addPlayer(data, home.Id, 'H3');
    const a1 = addPlayer(data, away.Id, 'A1');
    const match = addMatch(data, home.Id, away.Id);
    toggleMatchPlayer(data, match.Id, h1.Id, true);
    toggleMatchPlayer(data, match.Id, h2.Id, true);
    toggleMatchPlayer(data, match.Id, h3.Id, true);
    toggleMatchPlayer(data, match.Id, a1.Id, false);
    const gameId = addGame(data, match.Id);

    expect(toggleGamePlayer(data, match.Id, gameId, h1.Id)).toBe(true);
    expect(toggleGamePlayer(data, match.Id, gameId, h2.Id)).toBe(true);
    expect(toggleGamePlayer(data, match.Id, gameId, h3.Id)).toBe(false);
    expect(countGameSidePlayers(data, match.Id, gameId, true)).toBe(2);
    expect(isPlayerInGame(data, gameId, h3.Id, match.Id)).toBe(false);

    expect(toggleGamePlayer(data, match.Id, gameId, a1.Id)).toBe(true);
    expect(countGameSidePlayers(data, match.Id, gameId, false)).toBe(1);
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
