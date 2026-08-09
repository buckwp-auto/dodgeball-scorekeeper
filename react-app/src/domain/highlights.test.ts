import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from './database';
import {
  persistThrowGameEvent,
  setGameEventHighlight,
} from './gameEvents';
import {
  getLeagueHighlightGroups,
  getPlayerHighlightGroups,
  highlightEventHref,
} from './highlights';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from './matchGame';
import { ThrowResult } from './statistics/constants';

function seedTwoMatchLeague() {
  const data = createEmptyDatabase();
  const hawks = addTeam(data, 'Hawks');
  const owls = addTeam(data, 'Owls');
  const wolves = addTeam(data, 'Wolves');
  const alex = addPlayer(data, hawks.Id, 'Alex');
  const casey = addPlayer(data, owls.Id, 'Casey');
  const drew = addPlayer(data, wolves.Id, 'Drew');

  const matchA = addMatch(data, hawks.Id, owls.Id);
  toggleMatchPlayer(data, matchA.Id, alex.Id, true);
  toggleMatchPlayer(data, matchA.Id, casey.Id, false);
  const gameA1 = addGame(data, matchA.Id);
  const gameA2 = addGame(data, matchA.Id);
  toggleGamePlayer(data, matchA.Id, gameA1, alex.Id);
  toggleGamePlayer(data, matchA.Id, gameA1, casey.Id);
  toggleGamePlayer(data, matchA.Id, gameA2, alex.Id);
  toggleGamePlayer(data, matchA.Id, gameA2, casey.Id);

  const matchB = addMatch(data, hawks.Id, wolves.Id);
  toggleMatchPlayer(data, matchB.Id, alex.Id, true);
  toggleMatchPlayer(data, matchB.Id, drew.Id, false);
  const gameB1 = addGame(data, matchB.Id);
  toggleGamePlayer(data, matchB.Id, gameB1, alex.Id);
  toggleGamePlayer(data, matchB.Id, gameB1, drew.Id);

  const gamePlayers = data.Tables.GamePlayer as {
    Id: string;
    GameId: string;
    MatchPlayerId: string;
  }[];
  const matchPlayers = data.Tables.MatchPlayer as {
    Id: string;
    PlayerId: string;
  }[];
  const gpFor = (gameId: string, playerId: string) =>
    gamePlayers.find(
      (row) =>
        row.GameId === gameId &&
        matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === playerId,
    )!;

  const throwA1 = persistThrowGameEvent(
    data,
    gameA1,
    matchA.Id,
    [
      {
        throwerGamePlayerId: gpFor(gameA1, alex.Id).Id,
        targetGamePlayerId: gpFor(gameA1, casey.Id).Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ],
    { videoOffsetSeconds: 40 },
  );
  const throwA2 = persistThrowGameEvent(
    data,
    gameA2,
    matchA.Id,
    [
      {
        throwerGamePlayerId: gpFor(gameA2, casey.Id).Id,
        targetGamePlayerId: gpFor(gameA2, alex.Id).Id,
        resultId: ThrowResult.Dodge,
        deflections: [],
        recoveredId: undefined,
      },
    ],
    { videoOffsetSeconds: 12 },
  );
  const throwB1 = persistThrowGameEvent(
    data,
    gameB1,
    matchB.Id,
    [
      {
        throwerGamePlayerId: gpFor(gameB1, alex.Id).Id,
        targetGamePlayerId: gpFor(gameB1, drew.Id).Id,
        resultId: ThrowResult.Miss,
        deflections: [],
        recoveredId: undefined,
      },
    ],
    { videoOffsetSeconds: 8 },
  );

  return {
    data,
    matchA,
    matchB,
    gameA1,
    gameA2,
    gameB1,
    throwA1,
    throwA2,
    throwB1,
    alex,
    casey,
    drew,
  };
}

describe('league highlights', () => {
  it('groups starred events by match and game in video order', () => {
    const { data, matchA, gameA1, gameA2, throwA1, throwA2 } = seedTwoMatchLeague();
    setGameEventHighlight(data, throwA2, true);
    setGameEventHighlight(data, throwA1, true);

    const groups = getLeagueHighlightGroups(data);
    expect(groups).toHaveLength(1);
    expect(groups[0].matchId).toBe(matchA.Id);
    expect(groups[0].matchName).toBe('Hawks vs. Owls');
    expect(groups[0].games.map((game) => game.gameId)).toEqual([gameA1, gameA2]);
    expect(groups[0].games[0].highlights[0].eventId).toBe(throwA1);
    expect(groups[0].games[1].highlights[0].eventId).toBe(throwA2);
    expect(groups[0].games[0].highlights[0].entry.isHighlight).toBe(true);
    expect(groups[0].games[0].highlights[0].entry.videoOffsetSeconds).toBe(40);
  });

  it('omits unstarred events and empty matches', () => {
    const { data, throwA1 } = seedTwoMatchLeague();
    expect(getLeagueHighlightGroups(data)).toEqual([]);
    setGameEventHighlight(data, throwA1, true);
    expect(getLeagueHighlightGroups(data)).toHaveLength(1);
    setGameEventHighlight(data, throwA1, false);
    expect(getLeagueHighlightGroups(data)).toEqual([]);
  });

  it('filters highlights to events that mention a player', () => {
    const { data, throwA1, throwB1, alex, casey, drew } = seedTwoMatchLeague();
    setGameEventHighlight(data, throwA1, true);
    setGameEventHighlight(data, throwB1, true);

    const eventIds = (playerId: string) =>
      getPlayerHighlightGroups(data, playerId).flatMap((match) =>
        match.games.flatMap((game) => game.highlights.map((row) => row.eventId)),
      );

    expect(eventIds(alex.Id)).toEqual(expect.arrayContaining([throwA1, throwB1]));
    expect(eventIds(casey.Id)).toEqual([throwA1]);
    expect(eventIds(drew.Id)).toEqual([throwB1]);
  });

  it('builds a deep link to the game timeline event', () => {
    expect(highlightEventHref('m1', 'g1', 'e1')).toBe(
      '/matches/m1/games/g1/events?event=e1',
    );
  });
});
