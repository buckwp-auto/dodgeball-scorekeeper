import { describe, expect, it } from 'vitest';
import { createEmptyDatabase, addMatch, addPlayer, addTeam } from './database';
import {
  addGame,
  isPlayerInGame,
  toggleGamePlayer,
  toggleMatchPlayer,
} from './matchGame';
import {
  GameEventPlayerDepartureKind,
  ThrowResult,
} from './statistics/constants';
import {
  deleteGameEvent,
  getGameEventType,
  getGamePlayerInfos,
  persistOtherGameEvent,
  persistThrowGameEvent,
  removeGamePlayerFromRoster,
  undoLastGameEvent,
} from './gameEvents';
import { computeGameLiveState, isPlayerEliminatedInGame } from './gameElimination';
import {
  canDeletePlayerDepartureEvent,
  countNonDepartedGameSidePlayers,
  getDepartedGamePlayerIds,
  getMatchIneligiblePlayerIds,
} from './gameLineup';
import { autoSelectGameRoster } from './rosterAutoSelect';
import { setLeagueSettings } from './leagueSettings';
import { LEGACY_POLICY } from './statistics/statCreditPolicy';
import { buildDisplayStats } from './statistics/displayStats';

function setupSideWithPlayers(homeCount: number, awayCount: number) {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home');
  const away = addTeam(data, 'Away');
  const homePlayers = Array.from({ length: homeCount }, (_, i) =>
    addPlayer(data, home.Id, `H${i + 1}`),
  );
  const awayPlayers = Array.from({ length: awayCount }, (_, i) =>
    addPlayer(data, away.Id, `A${i + 1}`),
  );
  const match = addMatch(data, home.Id, away.Id);
  for (const player of homePlayers) toggleMatchPlayer(data, match.Id, player.Id, true);
  for (const player of awayPlayers) toggleMatchPlayer(data, match.Id, player.Id, false);
  const gameId = addGame(data, match.Id);
  for (const player of homePlayers) toggleGamePlayer(data, match.Id, gameId, player.Id);
  for (const player of awayPlayers) toggleGamePlayer(data, match.Id, gameId, player.Id);

  const infos = getGamePlayerInfos(data, match.Id, gameId);
  const homeGps = infos.filter((row) => row.teamHome);
  const awayGps = infos.filter((row) => !row.teamHome);
  return { data, match, gameId, homePlayers, awayPlayers, homeGps, awayGps };
}

describe('player departure soft-exit', () => {
  it('keeps prior throw stats after an injury departure', () => {
    const { data, match, gameId, homeGps, awayGps, homePlayers } = setupSideWithPlayers(
      2,
      1,
    );
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGps[0]!.gamePlayerId,
        targetGamePlayerId: awayGps[0]!.gamePlayerId,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGps[0]!.gamePlayerId,
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Injury,
    });

    expect(getDepartedGamePlayerIds(data, gameId).has(homeGps[0]!.gamePlayerId)).toBe(
      true,
    );
    const live = computeGameLiveState(data, match.Id, gameId);
    expect(live.departedGamePlayerIds.has(homeGps[0]!.gamePlayerId)).toBe(true);
    expect(live.activeHomeCount).toBe(1);

    const stats = buildDisplayStats(data, {
      kind: 'game',
      matchId: match.Id,
      gameId,
    });
    const row = stats.find((entry) => entry.playerId === homePlayers[0]!.Id);
    expect(row?.kills ?? 0).toBeGreaterThan(0);
  });

  it('yellow soft-exits this game and bans only the next game', () => {
    const { data, match, gameId, homeGps, homePlayers } = setupSideWithPlayers(2, 1);
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGps[0]!.gamePlayerId,
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Yellow,
    });
    expect(getDepartedGamePlayerIds(data, gameId).has(homeGps[0]!.gamePlayerId)).toBe(
      true,
    );
    const live = computeGameLiveState(data, match.Id, gameId);
    expect(live.departedGamePlayerIds.has(homeGps[0]!.gamePlayerId)).toBe(true);
    expect(isPlayerEliminatedInGame(live, homeGps[0]!.gamePlayerId)).toBe(false);

    const nextGameId = addGame(data, match.Id);
    expect(
      getMatchIneligiblePlayerIds(data, match.Id, nextGameId).has(homePlayers[0]!.Id),
    ).toBe(true);
    autoSelectGameRoster(data, match.Id, nextGameId);
    expect(isPlayerInGame(data, nextGameId, homePlayers[0]!.Id, match.Id)).toBe(false);

    const thirdGameId = addGame(data, match.Id);
    expect(
      getMatchIneligiblePlayerIds(data, match.Id, thirdGameId).has(homePlayers[0]!.Id),
    ).toBe(false);
  });

  it('blue marks out but stays catch-recoverable and does not soft-exit', () => {
    const { data, match, gameId, homeGps } = setupSideWithPlayers(2, 1);
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGps[0]!.gamePlayerId,
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Blue,
    });
    expect(getDepartedGamePlayerIds(data, gameId).size).toBe(0);
    const live = computeGameLiveState(data, match.Id, gameId);
    expect(isPlayerEliminatedInGame(live, homeGps[0]!.gamePlayerId)).toBe(true);
    expect(live.departedGamePlayerIds.size).toBe(0);
    expect(live.activeHomeCount).toBe(1);
  });

  it('second yellow soft-exits and bans the rest of the match', () => {
    const { data, match, gameId, homeGps, homePlayers } = setupSideWithPlayers(2, 1);
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGps[0]!.gamePlayerId,
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.SecondYellow,
    });
    expect(getDepartedGamePlayerIds(data, gameId).has(homeGps[0]!.gamePlayerId)).toBe(
      true,
    );
    expect(getMatchIneligiblePlayerIds(data, match.Id).has(homePlayers[0]!.Id)).toBe(
      true,
    );
    const nextGameId = addGame(data, match.Id);
    autoSelectGameRoster(data, match.Id, nextGameId);
    expect(isPlayerInGame(data, nextGameId, homePlayers[0]!.Id, match.Id)).toBe(false);
    const thirdGameId = addGame(data, match.Id);
    expect(
      getMatchIneligiblePlayerIds(data, match.Id, thirdGameId).has(homePlayers[0]!.Id),
    ).toBe(true);
  });

  it('frees a players-per-side slot at the default six-player cap', () => {
    const data = createEmptyDatabase();
    setLeagueSettings(data, LEGACY_POLICY, undefined, 6);
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const homePlayers = Array.from({ length: 8 }, (_, i) =>
      addPlayer(data, home.Id, `H${i + 1}`),
    );
    const awayPlayers = Array.from({ length: 6 }, (_, i) =>
      addPlayer(data, away.Id, `A${i + 1}`),
    );
    const match = addMatch(data, home.Id, away.Id);
    for (const player of homePlayers) toggleMatchPlayer(data, match.Id, player.Id, true);
    for (const player of awayPlayers) toggleMatchPlayer(data, match.Id, player.Id, false);
    const gameId = addGame(data, match.Id);
    for (let i = 0; i < 6; i++) {
      expect(toggleGamePlayer(data, match.Id, gameId, homePlayers[i]!.Id)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      expect(toggleGamePlayer(data, match.Id, gameId, awayPlayers[i]!.Id)).toBe(true);
    }
    expect(toggleGamePlayer(data, match.Id, gameId, homePlayers[6]!.Id)).toBe(false);

    const homeGp = getGamePlayerInfos(data, match.Id, gameId).find(
      (row) => row.playerId === homePlayers[0]!.Id,
    )!;
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.gamePlayerId,
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Injury,
    });

    expect(countNonDepartedGameSidePlayers(data, match.Id, gameId, true)).toBe(5);
    expect(toggleGamePlayer(data, match.Id, gameId, homePlayers[6]!.Id)).toBe(true);
    expect(isPlayerInGame(data, gameId, homePlayers[6]!.Id, match.Id)).toBe(true);
    expect(isPlayerInGame(data, gameId, homePlayers[0]!.Id, match.Id)).toBe(true);
  });

  it('frees a players-per-side slot for a same-game replacement', () => {
    const data = createEmptyDatabase();
    setLeagueSettings(data, LEGACY_POLICY, undefined, 2);
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const h1 = addPlayer(data, home.Id, 'H1');
    const h2 = addPlayer(data, home.Id, 'H2');
    const h3 = addPlayer(data, home.Id, 'H3');
    const a1 = addPlayer(data, away.Id, 'A1');
    const match = addMatch(data, home.Id, away.Id);
    for (const player of [h1, h2, h3]) toggleMatchPlayer(data, match.Id, player.Id, true);
    toggleMatchPlayer(data, match.Id, a1.Id, false);
    const gameId = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, gameId, h1.Id);
    toggleGamePlayer(data, match.Id, gameId, h2.Id);
    toggleGamePlayer(data, match.Id, gameId, a1.Id);
    expect(toggleGamePlayer(data, match.Id, gameId, h3.Id)).toBe(false);

    const homeGp = getGamePlayerInfos(data, match.Id, gameId).find(
      (row) => row.playerId === h1.Id,
    )!;
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.gamePlayerId,
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Injury,
    });

    expect(countNonDepartedGameSidePlayers(data, match.Id, gameId, true)).toBe(1);
    expect(toggleGamePlayer(data, match.Id, gameId, h3.Id)).toBe(true);
    expect(isPlayerInGame(data, gameId, h3.Id, match.Id)).toBe(true);
    expect(isPlayerInGame(data, gameId, h1.Id, match.Id)).toBe(true);
  });

  it('refuses undo of an exiting departure when a replacement filled the cap', () => {
    const data = createEmptyDatabase();
    setLeagueSettings(data, LEGACY_POLICY, undefined, 1);
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const h1 = addPlayer(data, home.Id, 'H1');
    const h2 = addPlayer(data, home.Id, 'H2');
    const a1 = addPlayer(data, away.Id, 'A1');
    const match = addMatch(data, home.Id, away.Id);
    toggleMatchPlayer(data, match.Id, h1.Id, true);
    toggleMatchPlayer(data, match.Id, h2.Id, true);
    toggleMatchPlayer(data, match.Id, a1.Id, false);
    const gameId = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, gameId, h1.Id);
    toggleGamePlayer(data, match.Id, gameId, a1.Id);

    const homeGp = getGamePlayerInfos(data, match.Id, gameId).find(
      (row) => row.playerId === h1.Id,
    )!;
    const eventId = persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.gamePlayerId,
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Injury,
    });
    expect(getGameEventType(data, eventId)).toBe('playerDeparture');
    expect(toggleGamePlayer(data, match.Id, gameId, h2.Id)).toBe(true);

    expect(canDeletePlayerDepartureEvent(data, match.Id, gameId, eventId, 1)).toBe(
      false,
    );
    expect(() => deleteGameEvent(data, eventId)).toThrow(/replacement/i);
    expect(() => undoLastGameEvent(data, gameId)).toThrow(/replacement/i);
  });

  it('refuses to remove a soft-exited player from the game roster (timeline preserved)', () => {
    const { data, match, gameId, homeGps, awayGps, homePlayers } = setupSideWithPlayers(
      2,
      1,
    );
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGps[0]!.gamePlayerId,
        targetGamePlayerId: awayGps[0]!.gamePlayerId,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGps[0]!.gamePlayerId,
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Injury,
    });
    const eventsBefore = (
      data.Tables.GameEvent as { Id: string; GameId: string }[]
    ).filter((row) => row.GameId === gameId).length;

    expect(() =>
      removeGamePlayerFromRoster(data, match.Id, gameId, homePlayers[0]!.Id, {
        rollbackEvents: true,
      }),
    ).toThrow(/soft-exited/i);
    expect(
      (data.Tables.GameEvent as { Id: string; GameId: string }[]).filter(
        (row) => row.GameId === gameId,
      ),
    ).toHaveLength(eventsBefore);
    expect(isPlayerInGame(data, gameId, homePlayers[0]!.Id, match.Id)).toBe(true);
  });
});

  it('still frees a slot when departure Kind is a numeric string (cloud coerce)', () => {
    const data = createEmptyDatabase();
    setLeagueSettings(data, LEGACY_POLICY, undefined, 2);
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const h1 = addPlayer(data, home.Id, 'H1');
    const h2 = addPlayer(data, home.Id, 'H2');
    const h3 = addPlayer(data, home.Id, 'H3');
    const a1 = addPlayer(data, away.Id, 'A1');
    const match = addMatch(data, home.Id, away.Id);
    for (const player of [h1, h2, h3]) toggleMatchPlayer(data, match.Id, player.Id, true);
    toggleMatchPlayer(data, match.Id, a1.Id, false);
    const gameId = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, gameId, h1.Id);
    toggleGamePlayer(data, match.Id, gameId, h2.Id);
    toggleGamePlayer(data, match.Id, gameId, a1.Id);

    const homeGp = getGamePlayerInfos(data, match.Id, gameId).find(
      (row) => row.playerId === h1.Id,
    )!;
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.gamePlayerId,
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Injury,
    });
    const row = (data.Tables.GameEventPlayerDeparture as { Kind: unknown }[])[0]!;
    row.Kind = String(GameEventPlayerDepartureKind.Injury);

    expect(getDepartedGamePlayerIds(data, gameId).has(homeGp.gamePlayerId)).toBe(true);
    expect(countNonDepartedGameSidePlayers(data, match.Id, gameId, true)).toBe(1);
    expect(toggleGamePlayer(data, match.Id, gameId, h3.Id)).toBe(true);
  });
