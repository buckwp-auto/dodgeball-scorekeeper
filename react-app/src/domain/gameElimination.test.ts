import { describe, expect, it } from 'vitest';
import { createEmptyDatabase, addMatch, addPlayer, addTeam } from './database';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from './matchGame';
import {
  DeflectionResult,
  GameEventErrorOffense,
  GameEventFinishResult,
  ThrowResult,
} from './statistics/constants';
import {
  persistErrorGameEvent,
  persistFinishGameEvent,
  persistThrowGameEvent,
} from './gameEvents';
import {
  buildEliminationTimeline,
  computeGameLiveState,
  ELIMINATED_SELECTION_GRACE_SECONDS,
  findStaleEliminatedSelections,
  finishResultForLiveWinner,
  isPlayerEliminatedInGame,
  sortGamePlayerInfos,
  sortRosterWithEliminations,
} from './gameElimination';
import { getGamePlayerInfos } from './gameEvents';

function setupGameWithRoster() {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home');
  const away = addTeam(data, 'Away');
  const h1 = addPlayer(data, home.Id, 'H1');
  const a1 = addPlayer(data, away.Id, 'A1');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  const gameId = addGame(data, match.Id);
  toggleGamePlayer(data, match.Id, gameId, h1.Id);
  toggleGamePlayer(data, match.Id, gameId, a1.Id);

  const gamePlayers = data.Tables.GamePlayer as { Id: string; MatchPlayerId: string }[];
  const matchPlayers = data.Tables.MatchPlayer as {
    Id: string;
    PlayerId: string;
    TeamHome: boolean;
  }[];
  const homeGp = gamePlayers.find(
    (row) => matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === h1.Id,
  )!;
  const awayGp = gamePlayers.find(
    (row) => matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === a1.Id,
  )!;

  return { data, match, gameId, h1, a1, homeGp, awayGp };
}

describe('game live elimination state', () => {
  it('eliminates the target on a hit', () => {
    const { data, match, gameId, homeGp, awayGp } = setupGameWithRoster();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);

    const live = computeGameLiveState(data, match.Id, gameId);
    expect(isPlayerEliminatedInGame(live, awayGp.Id)).toBe(true);
    expect(isPlayerEliminatedInGame(live, homeGp.Id)).toBe(false);

    const timeline = buildEliminationTimeline(data, match.Id, gameId);
    expect(timeline[0]).toMatchObject({ ordinal: 0, activeHome: 1, activeAway: 1 });
    expect(timeline[timeline.length - 1]).toMatchObject({
      activeHome: 1,
      activeAway: 0,
    });
  });

  it('eliminates the thrower when their throw is caught', () => {
    const { data, match, gameId, homeGp, awayGp } = setupGameWithRoster();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Catch,
        deflections: [],
        recoveredId: null,
      },
    ]);

    const live = computeGameLiveState(data, match.Id, gameId);
    expect(isPlayerEliminatedInGame(live, homeGp.Id)).toBe(true);
    expect(isPlayerEliminatedInGame(live, awayGp.Id)).toBe(false);
  });

  it('brings a recovered player back into the game after a catch', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const h1 = addPlayer(data, home.Id, 'H1');
    const a1 = addPlayer(data, away.Id, 'A1');
    const a2 = addPlayer(data, away.Id, 'A2');
    const match = addMatch(data, home.Id, away.Id);
    toggleMatchPlayer(data, match.Id, h1.Id, true);
    toggleMatchPlayer(data, match.Id, a1.Id, false);
    toggleMatchPlayer(data, match.Id, a2.Id, false);
    const gameId = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, gameId, h1.Id);
    toggleGamePlayer(data, match.Id, gameId, a1.Id);
    toggleGamePlayer(data, match.Id, gameId, a2.Id);

    const gamePlayers = data.Tables.GamePlayer as { Id: string; MatchPlayerId: string }[];
    const matchPlayers = data.Tables.MatchPlayer as {
      Id: string;
      PlayerId: string;
      TeamHome: boolean;
    }[];
    const gp = (playerId: string) =>
      gamePlayers.find(
        (row) => matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === playerId,
      )!;
    const homeGp = gp(h1.Id);
    const awayGp1 = gp(a1.Id);
    const awayGp2 = gp(a2.Id);

    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp2.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    expect(
      isPlayerEliminatedInGame(computeGameLiveState(data, match.Id, gameId), awayGp2.Id),
    ).toBe(true);

    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp1.Id,
        resultId: ThrowResult.Catch,
        deflections: [],
        recoveredId: awayGp2.Id,
      },
    ]);

    const live = computeGameLiveState(data, match.Id, gameId);
    expect(isPlayerEliminatedInGame(live, homeGp.Id)).toBe(true);
    expect(isPlayerEliminatedInGame(live, awayGp2.Id)).toBe(false);
    expect(live.activeAwayCount).toBe(2);
  });

  it('ends the game when every player on a team is eliminated', () => {
    const { data, match, gameId, homeGp, awayGp } = setupGameWithRoster();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: awayGp.Id,
        targetGamePlayerId: homeGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);

    const live = computeGameLiveState(data, match.Id, gameId);
    expect(live.isGameOver).toBe(true);
    expect(live.winningTeamHome).toBe(false);
    expect(finishResultForLiveWinner(live.winningTeamHome)).toBe(GameEventFinishResult.WinAway);
  });

  it('maps live wipe winner to finish result', () => {
    expect(finishResultForLiveWinner(true)).toBe(GameEventFinishResult.WinHome);
    expect(finishResultForLiveWinner(false)).toBe(GameEventFinishResult.WinAway);
    expect(finishResultForLiveWinner(null)).toBeNull();
  });

  it('sorts eliminated players to the bottom of a roster list', () => {
    const rows = [
      { player: { Id: 'p-out', Name: 'Zara' }, selected: true },
      { player: { Id: 'p-in', Name: 'Amy' }, selected: true },
    ];
    const sorted = sortRosterWithEliminations(rows, new Set(['p-out']));
    expect(sorted.map((row) => row.player.Id)).toEqual(['p-in', 'p-out']);
  });

  it('sorts substitutes after starters, then eliminated last', () => {
    const rows = [
      { player: { Id: 'sub', Name: 'Amy' }, selected: true, substitute: true },
      { player: { Id: 'out', Name: 'Zed' }, selected: true, substitute: false },
      { player: { Id: 'start', Name: 'Bea' }, selected: true, substitute: false },
    ];
    const sorted = sortRosterWithEliminations(rows, new Set(['out']));
    expect(sorted.map((row) => row.player.Id)).toEqual(['start', 'sub', 'out']);
  });

  it('eliminates the target on BlockFailed and CatchFailed (hit-equivalent outs)', () => {
    const { data, match, gameId, homeGp, awayGp } = setupGameWithRoster();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.BlockFailed,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    expect(
      isPlayerEliminatedInGame(computeGameLiveState(data, match.Id, gameId), awayGp.Id),
    ).toBe(true);

    const again = setupGameWithRoster();
    persistThrowGameEvent(again.data, again.gameId, again.match.Id, [
      {
        throwerGamePlayerId: again.homeGp.Id,
        targetGamePlayerId: again.awayGp.Id,
        resultId: ThrowResult.CatchFailed,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    expect(
      isPlayerEliminatedInGame(
        computeGameLiveState(again.data, again.match.Id, again.gameId),
        again.awayGp.Id,
      ),
    ).toBe(true);
  });

  it('eliminates the thrower when a deflection is caught', () => {
    const { data, match, gameId, homeGp, awayGp } = setupGameWithRoster();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Block,
        deflections: [
          { receiverGamePlayerId: awayGp.Id, resultId: DeflectionResult.Catch },
        ],
        recoveredId: null,
      },
    ]);
    const live = computeGameLiveState(data, match.Id, gameId);
    expect(isPlayerEliminatedInGame(live, homeGp.Id)).toBe(true);
    expect(isPlayerEliminatedInGame(live, awayGp.Id)).toBe(false);
  });

  it('eliminates offender on LineOut', () => {
    const { data, match, gameId, awayGp } = setupGameWithRoster();
    persistErrorGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: awayGp.Id,
      offenseId: GameEventErrorOffense.LineOut,
    });
    expect(
      isPlayerEliminatedInGame(computeGameLiveState(data, match.Id, gameId), awayGp.Id),
    ).toBe(true);
  });

  it('sorts game player infos with outs at the bottom', () => {
    const { data, match, gameId, homeGp, awayGp } = setupGameWithRoster();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    const live = computeGameLiveState(data, match.Id, gameId);
    const sorted = sortGamePlayerInfos(
      getGamePlayerInfos(data, match.Id, gameId),
      live.eliminatedGamePlayerIds,
    );
    expect(sorted[sorted.length - 1]?.gamePlayerId).toBe(awayGp.Id);
  });
});

describe('eliminated players in a later draft', () => {
  function gameWithOutAwayPlayer(videoOffsetSeconds: number | null) {
    const setup = setupGameWithRoster();
    persistThrowGameEvent(
      setup.data,
      setup.gameId,
      setup.match.Id,
      [
        {
          throwerGamePlayerId: setup.homeGp.Id,
          targetGamePlayerId: setup.awayGp.Id,
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { videoOffsetSeconds },
    );
    return setup;
  }

  it('records when each player went out from the event video offset', () => {
    const { data, match, gameId, awayGp } = gameWithOutAwayPlayer(42);
    const live = computeGameLiveState(data, match.Id, gameId);
    expect(live.eliminatedAtSeconds.get(awayGp.Id)).toBe(42);
  });

  it('forgets the elimination time when a player is recovered', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const h1 = addPlayer(data, home.Id, 'H1');
    const a1 = addPlayer(data, away.Id, 'A1');
    const a2 = addPlayer(data, away.Id, 'A2');
    const match = addMatch(data, home.Id, away.Id);
    toggleMatchPlayer(data, match.Id, h1.Id, true);
    toggleMatchPlayer(data, match.Id, a1.Id, false);
    toggleMatchPlayer(data, match.Id, a2.Id, false);
    const gameId = addGame(data, match.Id);
    for (const player of [h1, a1, a2]) {
      toggleGamePlayer(data, match.Id, gameId, player.Id);
    }
    const infos = getGamePlayerInfos(data, match.Id, gameId);
    const gp = (name: string) => infos.find((row) => row.playerName === name)!.gamePlayerId;

    persistThrowGameEvent(
      data,
      gameId,
      match.Id,
      [
        {
          throwerGamePlayerId: gp('H1'),
          targetGamePlayerId: gp('A2'),
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { videoOffsetSeconds: 10 },
    );
    persistThrowGameEvent(
      data,
      gameId,
      match.Id,
      [
        {
          throwerGamePlayerId: gp('H1'),
          targetGamePlayerId: gp('A1'),
          resultId: ThrowResult.Catch,
          deflections: [],
          recoveredId: gp('A2'),
        },
      ],
      { videoOffsetSeconds: 20 },
    );

    const live = computeGameLiveState(data, match.Id, gameId);
    expect(live.eliminatedAtSeconds.has(gp('A2'))).toBe(false);
    expect(live.eliminatedAtSeconds.get(gp('H1'))).toBe(20);
  });

  it('stays quiet while an out player throws inside the grace window', () => {
    const { data, match, gameId, homeGp, awayGp } = gameWithOutAwayPlayer(42);
    const live = computeGameLiveState(data, match.Id, gameId);
    const stale = findStaleEliminatedSelections(
      [
        {
          throwerGamePlayerId: awayGp.Id,
          targetGamePlayerId: homeGp.Id,
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      getGamePlayerInfos(data, match.Id, gameId),
      live.eliminatedAtSeconds,
      42 + ELIMINATED_SELECTION_GRACE_SECONDS - 1,
    );
    expect(stale).toEqual([]);
  });

  it('warns once the video has moved past the grace window', () => {
    const { data, match, gameId, homeGp, awayGp } = gameWithOutAwayPlayer(42);
    const live = computeGameLiveState(data, match.Id, gameId);
    const stale = findStaleEliminatedSelections(
      [
        {
          throwerGamePlayerId: awayGp.Id,
          targetGamePlayerId: homeGp.Id,
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      getGamePlayerInfos(data, match.Id, gameId),
      live.eliminatedAtSeconds,
      60,
    );
    expect(stale).toEqual([
      { gamePlayerId: awayGp.Id, playerName: 'A1', secondsSinceOut: 18 },
    ]);
  });

  it('cannot judge staleness without both timestamps', () => {
    const { data, match, gameId, homeGp, awayGp } = gameWithOutAwayPlayer(null);
    const live = computeGameLiveState(data, match.Id, gameId);
    const drafts = [
      {
        throwerGamePlayerId: awayGp.Id,
        targetGamePlayerId: homeGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ];
    const players = getGamePlayerInfos(data, match.Id, gameId);
    expect(findStaleEliminatedSelections(drafts, players, live.eliminatedAtSeconds, 600)).toEqual(
      [],
    );
    expect(findStaleEliminatedSelections(drafts, players, live.eliminatedAtSeconds, null)).toEqual(
      [],
    );
  });
});

describe('finish event', () => {
  it('does not change elimination sets but marks game complete via finish', () => {
    const { data, match, gameId } = setupGameWithRoster();
    persistFinishGameEvent(data, gameId, { resultId: GameEventFinishResult.WinHome });
    const live = computeGameLiveState(data, match.Id, gameId);
    expect(live.hasFinishEvent).toBe(true);
  });
});
