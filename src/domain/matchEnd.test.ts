import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from './database';
import { persistFinishGameEvent, persistThrowGameEvent } from './gameEvents';
import {
  addGame,
  getMatchById,
  toggleGamePlayer,
  toggleMatchPlayer,
} from './matchGame';
import {
  endMatch,
  isMatchEnded,
  matchEndVideoOffsetSeconds,
  undoEndMatch,
} from './matchEnd';
import { GameEventFinishResult, ThrowResult } from './statistics/constants';

function seedMatch() {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home');
  const away = addTeam(data, 'Away');
  const h1 = addPlayer(data, home.Id, 'Alex');
  const a1 = addPlayer(data, away.Id, 'Casey');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  return { data, match, h1, a1 };
}

function gamePlayerId(
  data: ReturnType<typeof createEmptyDatabase>,
  gameId: string,
  playerId: string,
): string {
  const matchPlayers = data.Tables.MatchPlayer as {
    Id: string;
    PlayerId: string;
  }[];
  const gamePlayers = data.Tables.GamePlayer as {
    Id: string;
    GameId: string;
    MatchPlayerId: string;
  }[];
  const matchPlayerId = matchPlayers.find((row) => row.PlayerId === playerId)!.Id;
  return gamePlayers.find(
    (row) => row.GameId === gameId && row.MatchPlayerId === matchPlayerId,
  )!.Id;
}

describe('endMatch', () => {
  it('aligns the match-end stamp with the last game finish video offset', () => {
    const { data, match, h1, a1 } = seedMatch();
    const game1 = addGame(data, match.Id);
    const game2 = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, game1, h1.Id);
    toggleGamePlayer(data, match.Id, game1, a1.Id);
    toggleGamePlayer(data, match.Id, game2, h1.Id);
    toggleGamePlayer(data, match.Id, game2, a1.Id);

    persistFinishGameEvent(
      data,
      game1,
      { resultId: GameEventFinishResult.WinHome },
      { videoOffsetSeconds: 90 },
    );
    persistFinishGameEvent(
      data,
      game2,
      { resultId: GameEventFinishResult.WinAway },
      { videoOffsetSeconds: 240.6 },
    );

    expect(matchEndVideoOffsetSeconds(data, match.Id)).toBe(240.6);
    endMatch(data, match.Id);
    const ended = getMatchById(data, match.Id)!;
    expect(isMatchEnded(ended)).toBe(true);
    expect(ended.EndedVideoOffsetSeconds).toBe(240.6);
  });

  it('falls back to the last stamped event when the last game has no finish', () => {
    const { data, match, h1, a1 } = seedMatch();
    const gameId = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, gameId, h1.Id);
    toggleGamePlayer(data, match.Id, gameId, a1.Id);

    persistThrowGameEvent(
      data,
      gameId,
      match.Id,
      [
        {
          throwerGamePlayerId: gamePlayerId(data, gameId, h1.Id),
          targetGamePlayerId: gamePlayerId(data, gameId, a1.Id),
          resultId: ThrowResult.Miss,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { videoOffsetSeconds: 77 },
    );

    endMatch(data, match.Id);
    expect(getMatchById(data, match.Id)?.EndedVideoOffsetSeconds).toBe(77);
  });

  it('uses a null offset when nothing is stamped, including an empty match', () => {
    const { data, match } = seedMatch();
    endMatch(data, match.Id);
    expect(getMatchById(data, match.Id)?.EndedVideoOffsetSeconds).toBeNull();

    undoEndMatch(data, match.Id);
    addGame(data, match.Id);
    endMatch(data, match.Id);
    expect(getMatchById(data, match.Id)?.EndedVideoOffsetSeconds).toBeNull();
  });

  it('undo clears ended state so games can be added again', () => {
    const { data, match } = seedMatch();
    addGame(data, match.Id);
    endMatch(data, match.Id);
    expect(() => addGame(data, match.Id)).toThrow(/ended/i);
    undoEndMatch(data, match.Id);
    expect(isMatchEnded(getMatchById(data, match.Id))).toBe(false);
    expect(getMatchById(data, match.Id)?.EndedVideoOffsetSeconds).toBeUndefined();
    expect(addGame(data, match.Id)).toBeTruthy();
  });

  it('is a no-op when the match is already ended', () => {
    const { data, match } = seedMatch();
    endMatch(data, match.Id);
    const first = { ...getMatchById(data, match.Id)! };
    endMatch(data, match.Id);
    expect(getMatchById(data, match.Id)).toEqual(first);
  });
});
