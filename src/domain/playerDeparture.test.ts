import { describe, expect, it } from 'vitest';
import { createEmptyDatabase, addMatch, addPlayer, addTeam } from './database';
import {
  addGame,
  countGameSidePlayers,
  toggleGamePlayer,
  toggleMatchPlayer,
} from './matchGame';
import {
  persistOtherGameEvent,
  persistThrowGameEvent,
  undoLastGameEvent,
  previewRemoveGamePlayer,
  removeGamePlayerFromRoster,
} from './gameEvents';
import {
  computeGameLiveState,
  defaultCatchRecoveredId,
} from './gameElimination';
import { autoSelectGameRoster } from './rosterAutoSelect';
import { GameEventPlayerDepartureKind, ThrowResult } from './statistics/constants';
import {
  isPlayerIneligibleForGame,
  isSoftExitedInGame,
  matchIneligiblePlayerIds,
  softExitedGamePlayerIds,
} from './playerDeparture';
import { getGamePlayerInfos } from './gameEvents';

function setupTwoSideRoster(limit = 1) {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home');
  const away = addTeam(data, 'Away');
  const h1 = addPlayer(data, home.Id, 'H1');
  const h2 = addPlayer(data, home.Id, 'H2');
  const a1 = addPlayer(data, away.Id, 'A1');
  const match = addMatch(data, home.Id, away.Id);
  for (const [playerId, teamHome] of [
    [h1.Id, true],
    [h2.Id, true],
    [a1.Id, false],
  ] as const) {
    toggleMatchPlayer(data, match.Id, playerId, teamHome);
  }
  const gameId = addGame(data, match.Id);
  toggleGamePlayer(data, match.Id, gameId, h1.Id);
  toggleGamePlayer(data, match.Id, gameId, a1.Id);

  const infos = getGamePlayerInfos(data, match.Id, gameId);
  const homeGp = infos.find((row) => row.playerName === 'H1')!;
  const homeGp2 = infos.find((row) => row.playerName === 'H2')!;
  const awayGp = infos.find((row) => row.playerName === 'A1')!;

  return { data, match, gameId, h1, h2, a1, homeGp, homeGp2, awayGp, limit };
}

describe('playerDeparture', () => {
  it('persists injury departure and undo restores it', () => {
    const { data, match, gameId, homeGp } = setupTwoSideRoster();
    const eventId = persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.gamePlayerId,
      throwerGamePlayerId: '',
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Injury,
    });
    expect(isSoftExitedInGame(data, gameId, homeGp.gamePlayerId)).toBe(true);

    const snapshot = undoLastGameEvent(data, gameId);
    expect(snapshot?.type).toBe('playerDeparture');
    expect(isSoftExitedInGame(data, gameId, homeGp.gamePlayerId)).toBe(false);
    expect(eventId).toBeTruthy();
  });

  it('soft-exit frees on-court cap so a replacement can enter', () => {
    const { data, match, gameId, h2 } = setupTwoSideRoster();
    expect(countGameSidePlayers(data, match.Id, gameId, true)).toBe(1);

    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: getGamePlayerInfos(data, match.Id, gameId).find(
        (row) => row.playerName === 'H1',
      )!.gamePlayerId,
      throwerGamePlayerId: '',
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Injury,
    });
    expect(countGameSidePlayers(data, match.Id, gameId, true)).toBe(0);
    expect(toggleGamePlayer(data, match.Id, gameId, h2.Id)).toBe(true);
    expect(countGameSidePlayers(data, match.Id, gameId, true)).toBe(1);
  });

  it('rejects throws involving soft-exited players', () => {
    const { data, match, gameId, homeGp, awayGp } = setupTwoSideRoster();
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.gamePlayerId,
      throwerGamePlayerId: '',
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Red,
    });
    expect(() =>
      persistThrowGameEvent(data, gameId, match.Id, [
        {
          throwerGamePlayerId: homeGp.gamePlayerId,
          targetGamePlayerId: awayGp.gamePlayerId,
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
      ]),
    ).toThrow(/left the game/);
  });

  it('excludes soft-exited players from default catch recovery', () => {
    const { data, match, gameId, homeGp, awayGp } = setupTwoSideRoster();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: awayGp.gamePlayerId,
        targetGamePlayerId: homeGp.gamePlayerId,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.gamePlayerId,
      throwerGamePlayerId: '',
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Injury,
    });
    const live = computeGameLiveState(data, match.Id, gameId);
    expect(
      defaultCatchRecoveredId(
        true,
        getGamePlayerInfos(data, match.Id, gameId),
        live.eliminatedGamePlayerIds,
        live.eliminationOrder,
        new Set([awayGp.gamePlayerId]),
        live.softExitedGamePlayerIds,
      ),
    ).toBeNull();
  });

  it('marks players ineligible for later games after soft-exit', () => {
    const { data, match, gameId, h1, homeGp } = setupTwoSideRoster();
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.gamePlayerId,
      throwerGamePlayerId: '',
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.SecondYellow,
    });
    const game2 = addGame(data, match.Id);
    expect(isPlayerIneligibleForGame(data, match.Id, game2, h1.Id)).toBe(true);
    expect(matchIneligiblePlayerIds(data, match.Id, game2).has(h1.Id)).toBe(true);
    autoSelectGameRoster(data, match.Id, game2);
    expect(
      getGamePlayerInfos(data, match.Id, game2).some((row) => row.playerName === 'H1'),
    ).toBe(false);
  });

  it('yellow card does not soft-exit or block later games', () => {
    const { data, match, gameId, h1, homeGp } = setupTwoSideRoster();
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.gamePlayerId,
      throwerGamePlayerId: '',
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Yellow,
    });
    expect(isSoftExitedInGame(data, gameId, homeGp.gamePlayerId)).toBe(false);
    expect(softExitedGamePlayerIds(data, gameId).size).toBe(0);
    const game2 = addGame(data, match.Id);
    expect(isPlayerIneligibleForGame(data, match.Id, game2, h1.Id)).toBe(false);
    expect(countGameSidePlayers(data, match.Id, gameId, true)).toBe(1);
  });

  it('rollback-remove path remains separate from departure', () => {
    const { data, match, gameId, h1, homeGp, awayGp } = setupTwoSideRoster();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.gamePlayerId,
        targetGamePlayerId: awayGp.gamePlayerId,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    const preview = previewRemoveGamePlayer(data, match.Id, gameId, h1.Id);
    expect(preview?.eventCount).toBeGreaterThan(0);
    expect(() =>
      removeGamePlayerFromRoster(data, match.Id, gameId, h1.Id),
    ).toThrow(/recorded events/);
    const result = removeGamePlayerFromRoster(data, match.Id, gameId, h1.Id, {
      rollbackEvents: true,
    });
    expect(result.removed).toBe(true);
    expect(result.rolledBackEvents).toBeGreaterThan(0);
  });

  it('includes departure in live active counts', () => {
    const { data, match, gameId, homeGp } = setupTwoSideRoster();
    persistOtherGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.gamePlayerId,
      throwerGamePlayerId: '',
      offenseId: null,
      departureKind: GameEventPlayerDepartureKind.Injury,
    });
    const live = computeGameLiveState(data, match.Id, gameId);
    expect(live.softExitedGamePlayerIds.has(homeGp.gamePlayerId)).toBe(true);
    expect(live.activeHomeCount).toBe(0);
    expect(live.activeAwayCount).toBe(1);
  });
});
