import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from '../database';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from '../matchGame';
import {
  persistFinishGameEvent,
  persistThrowGameEvent,
} from '../gameEvents';
import {
  DeflectionResult,
  GameEventFinishResult,
  ThrowResult,
} from './constants';
import {
  aggregateThrowMix,
  buildDisplayStats,
  buildSideComparison,
  filterAndSortDisplayStats,
  formatPct,
  formatRate,
  formatRecord,
  statsPageTitle,
  type DisplayPlayerStats,
} from './displayStats';

function gpFor(
  data: ReturnType<typeof createEmptyDatabase>,
  playerId: string,
) {
  const gamePlayers = data.Tables.GamePlayer as {
    Id: string;
    MatchPlayerId: string;
  }[];
  const matchPlayers = data.Tables.MatchPlayer as {
    Id: string;
    PlayerId: string;
  }[];
  return gamePlayers.find(
    (row) =>
      matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === playerId,
  )!;
}

function setupMatch(options?: { extraAway?: boolean; extraHome?: boolean }) {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home Hawks');
  const away = addTeam(data, 'Away Owls');
  const h1 = addPlayer(data, home.Id, 'Alex');
  const h2 = options?.extraHome ? addPlayer(data, home.Id, 'Blake') : null;
  const a1 = addPlayer(data, away.Id, 'Casey');
  const a2 = options?.extraAway ? addPlayer(data, away.Id, 'Drew') : null;
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  if (h2) toggleMatchPlayer(data, match.Id, h2.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  if (a2) toggleMatchPlayer(data, match.Id, a2.Id, false);
  const gameId = addGame(data, match.Id);
  toggleGamePlayer(data, match.Id, gameId, h1.Id);
  if (h2) toggleGamePlayer(data, match.Id, gameId, h2.Id);
  toggleGamePlayer(data, match.Id, gameId, a1.Id);
  if (a2) toggleGamePlayer(data, match.Id, gameId, a2.Id);
  return {
    data,
    match,
    gameId,
    home,
    away,
    h1,
    h2,
    a1,
    a2,
    homeGp: gpFor(data, h1.Id),
    homeGp2: h2 ? gpFor(data, h2.Id) : null,
    awayGp: gpFor(data, a1.Id),
    awayGp2: a2 ? gpFor(data, a2.Id) : null,
  };
}

function byName(rows: DisplayPlayerStats[], name: string) {
  return rows.find((row) => row.playerName === name);
}

describe('buildDisplayStats', () => {
  it('flattens kills, throws, hit rate, and game W-L from a hit + home finish', () => {
    const { data, match, gameId, homeGp, awayGp } = setupMatch();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistFinishGameEvent(data, gameId, {
      resultId: GameEventFinishResult.WinHome,
    });

    const rows = buildDisplayStats(data, { kind: 'match', matchId: match.Id });
    const alex = byName(rows, 'Alex')!;
    const casey = byName(rows, 'Casey')!;

    expect(alex.kills).toBe(1);
    expect(alex.throws).toBe(1);
    expect(alex.throwHits).toBe(1);
    expect(alex.hitRate).toBe(1);
    expect(alex.gamesWon).toBe(1);
    expect(alex.gamesLost).toBe(0);
    expect(alex.gameWinPct).toBe(1);
    expect(alex.kd).toBe(Number.POSITIVE_INFINITY);
    expect(alex.teamHome).toBe(true);

    expect(casey.deaths).toBe(1);
    expect(casey.targets).toBe(1);
    expect(casey.gamesLost).toBe(1);
    expect(casey.kd).toBe(0);
    expect(casey.teamHome).toBe(false);
  });

  it('counts catches made and recoveries without changing CSV aggregates', () => {
    const { data, match, gameId, homeGp, awayGp, awayGp2 } = setupMatch({
      extraAway: true,
    });
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Catch,
        deflections: [],
        recoveredId: awayGp2!.Id,
      },
    ]);

    const rows = buildDisplayStats(data, { kind: 'game', matchId: match.Id, gameId });
    const casey = byName(rows, 'Casey')!;
    const drew = byName(rows, 'Drew')!;
    const alex = byName(rows, 'Alex')!;

    expect(casey.catches).toBe(1);
    expect(drew.recoveries).toBe(1);
    expect(alex.deaths).toBe(1);
    expect(casey.catchRate).toBeCloseTo(0.5);
  });

  it('counts a deflection catch on the receiver', () => {
    const { data, match, gameId, homeGp, awayGp, awayGp2 } = setupMatch({
      extraAway: true,
    });
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [
          { receiverGamePlayerId: awayGp2!.Id, resultId: DeflectionResult.Catch },
        ],
        recoveredId: awayGp.Id,
      },
    ]);

    const rows = buildDisplayStats(data, { kind: 'match', matchId: match.Id });
    expect(byName(rows, 'Drew')?.catches).toBe(1);
    expect(byName(rows, 'Casey')?.recoveries).toBe(1);
  });

  it('restricts game scope to one game', () => {
    const { data, match, gameId, homeGp, awayGp, h1, a1 } = setupMatch();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistFinishGameEvent(data, gameId, {
      resultId: GameEventFinishResult.WinHome,
    });

    const game2 = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, game2, h1.Id);
    toggleGamePlayer(data, match.Id, game2, a1.Id);
    persistFinishGameEvent(data, game2, {
      resultId: GameEventFinishResult.WinAway,
    });

    const matchRows = buildDisplayStats(data, { kind: 'match', matchId: match.Id });
    const gameRows = buildDisplayStats(data, {
      kind: 'game',
      matchId: match.Id,
      gameId,
    });

    expect(byName(matchRows, 'Alex')?.gamesPlayed).toBe(2);
    expect(byName(matchRows, 'Alex')?.gamesWon).toBe(1);
    expect(byName(matchRows, 'Alex')?.kills).toBe(1);
    expect(byName(gameRows, 'Alex')?.gamesPlayed).toBe(1);
    expect(byName(gameRows, 'Alex')?.gamesWon).toBe(1);
    expect(byName(gameRows, 'Casey')?.gamesWon).toBe(0);
  });

  it('sorts leaderboards and hides players below min games', () => {
    const { data, match, gameId, homeGp, awayGp } = setupMatch();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistFinishGameEvent(data, gameId, {
      resultId: GameEventFinishResult.WinHome,
    });

    const rows = buildDisplayStats(data, { kind: 'match', matchId: match.Id });
    const sorted = filterAndSortDisplayStats(rows, { metric: 'kills', minGames: 1 });
    expect(sorted[0].playerName).toBe('Alex');
    expect(sorted.map((row) => row.playerName)).toEqual(['Alex', 'Casey']);

    const none = filterAndSortDisplayStats(rows, { metric: 'kills', minGames: 2 });
    expect(none).toHaveLength(0);
  });

  it('builds throw mix and home vs away comparison', () => {
    const { data, match, gameId, homeGp, awayGp } = setupMatch();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: awayGp.Id,
        targetGamePlayerId: homeGp.Id,
        resultId: ThrowResult.Miss,
        deflections: [],
        recoveredId: undefined,
      },
    ]);

    const rows = buildDisplayStats(data, { kind: 'match', matchId: match.Id });
    const mix = aggregateThrowMix(rows);
    expect(mix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Hit', count: 1 }),
        expect.objectContaining({ label: 'Miss', count: 1 }),
      ]),
    );

    const comparison = buildSideComparison(rows);
    expect(comparison).toEqual(
      expect.arrayContaining([
        { metric: 'Kills', home: 1, away: 0 },
        { metric: 'Throws', home: 1, away: 1 },
      ]),
    );
  });

  it('titles pages by scope', () => {
    const { data, match, gameId } = setupMatch();
    expect(statsPageTitle(data, { kind: 'league' })).toBe('League stats');
    expect(statsPageTitle(data, { kind: 'match', matchId: match.Id })).toBe(
      'Match stats — Home Hawks vs. Away Owls',
    );
    expect(
      statsPageTitle(data, { kind: 'game', matchId: match.Id, gameId }),
    ).toBe('Game 1 stats — Home Hawks vs. Away Owls');
  });

  it('formats rates and records', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(Number.POSITIVE_INFINITY)).toBe('∞');
    expect(formatRate(1.5)).toBe('1.50');
    expect(formatPct(0.67)).toBe('67%');
    expect(formatRecord(3, 1, 0)).toBe('3-1');
    expect(formatRecord(2, 2, 1)).toBe('2-2-1');
  });
});
