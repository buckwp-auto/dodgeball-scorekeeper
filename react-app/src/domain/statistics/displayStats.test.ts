import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from '../database';
import {
  addGame,
  addPlayerToMatchSide,
  setMatchPlayerSubstitute,
  toggleGamePlayer,
  toggleMatchPlayer,
} from '../matchGame';
import { setLeagueSettings } from '../leagueSettings';
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
  efficiencyRate,
  formatCountValue,
  formatPct,
  formatPct1,
  formatRate,
  formatRecord,
  leaderboardRank,
  metricValue,
  netScore,
  statsPageTitle,
  type DisplayPlayerStats,
} from './displayStats';
import { STAT_CREDIT_PRESETS } from './statCreditPolicy';

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

  it('skips orphaned throws instead of crashing when a match roster row is missing', () => {
    const { data, match, gameId, homeGp, awayGp, h1 } = setupMatch();
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
    data.Tables.MatchPlayer = (
      data.Tables.MatchPlayer as { PlayerId: string }[]
    ).filter((row) => row.PlayerId !== h1.Id);

    expect(() =>
      buildDisplayStats(data, { kind: 'match', matchId: match.Id }),
    ).not.toThrow();
    const rows = buildDisplayStats(data, { kind: 'match', matchId: match.Id });
    expect(byName(rows, 'Alex')).toBeUndefined();
    expect(byName(rows, 'Casey')?.deaths).toBe(1);
    expect(byName(rows, 'Casey')?.targets).toBe(1);
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
    // Catch-outs are times caught, not Deaths (Deaths = hit/error only).
    expect(alex.deaths).toBe(0);
    expect(casey.catchRate).toBeCloseTo(0.5);
    expect(alex.throws).toBe(2);
    expect(alex.catchesThrown).toBe(1);
    expect(alex.caughtRate).toBeCloseTo(0.5);
    expect(alex.kills).toBe(1);
    expect(efficiencyRate(alex)).toBeCloseTo(0.5);
    expect(casey.targets).toBe(2);
    expect(casey.targetHits).toBe(1);
    expect(casey.elusivenessRate).toBeCloseTo(0.5);
    // Net = kills − 2×times caught (not also −1 death for the same catch-out).
    expect(netScore(alex)).toBe(-1);
    expect(netScore(casey)).toBe(1);
  });

  it('does not double-count catch-outs in Net score', () => {
    const { data, match, gameId, homeGp, awayGp } = setupMatch();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Catch,
        deflections: [],
        recoveredId: null,
      },
    ]);

    const alex = byName(
      buildDisplayStats(data, { kind: 'game', matchId: match.Id, gameId }),
      'Alex',
    )!;
    expect(alex.deaths).toBe(0);
    expect(alex.catchesThrown).toBe(1);
    expect(netScore(alex)).toBe(-2);
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
    expect(byName(rows, 'Alex')?.catchesThrown).toBe(1);
    expect(byName(rows, 'Alex')?.deaths).toBe(0);
    expect(byName(rows, 'Alex')?.caughtRate).toBe(1);
    expect(byName(rows, 'Drew')?.targets).toBe(1);
    expect(byName(rows, 'Drew')?.elusivenessRate).toBe(1);
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
    expect(formatPct1(0.846)).toBe('84.6%');
    expect(formatPct1(null)).toBe('—');
    expect(formatRecord(3, 1, 0)).toBe('3-1');
    expect(formatRecord(2, 2, 1)).toBe('2-2-1');
    expect(formatCountValue(2)).toBe('2');
    expect(formatCountValue(0.5)).toBe('0.50');
  });

  it('applies shared credit to same-target team throws and supports the counts/credit toggle', () => {
    const { data, match, gameId, homeGp, homeGp2, awayGp } = setupMatch({ extraHome: true });
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
      {
        throwerGamePlayerId: homeGp2!.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);

    const legacyRows = buildDisplayStats(data, { kind: 'match', matchId: match.Id });
    expect(byName(legacyRows, 'Casey')?.deaths).toBe(2);
    expect(byName(legacyRows, 'Alex')?.kills).toBe(1);
    expect(byName(legacyRows, 'Blake')?.kills).toBe(1);
    expect(byName(legacyRows, 'Alex')?.killsCredit).toBeCloseTo(0.5);

    setLeagueSettings(data, STAT_CREDIT_PRESETS.sharedCredit);
    const sharedRows = buildDisplayStats(data, { kind: 'match', matchId: match.Id });
    const alex = byName(sharedRows, 'Alex')!;
    const blake = byName(sharedRows, 'Blake')!;
    const casey = byName(sharedRows, 'Casey')!;

    expect(casey.deaths).toBe(1);
    expect(casey.deathsCredit).toBeCloseTo(1);
    expect(alex.kills).toBe(1);
    expect(blake.kills).toBe(1);
    expect(alex.killsCredit).toBeCloseTo(0.5);
    expect(blake.killsCredit).toBeCloseTo(0.5);
    expect(metricValue(alex, 'kills', 'counts')).toBe(1);
    expect(metricValue(alex, 'kills', 'credit')).toBeCloseTo(0.5);
    expect(metricValue(alex, 'kd', 'credit')).toBe(Number.POSITIVE_INFINITY);
    expect(metricValue(casey, 'kd', 'credit')).toBe(0);

    const comparison = buildSideComparison(sharedRows, 'credit');
    expect(comparison).toEqual(
      expect.arrayContaining([
        { metric: 'Kills', home: 1, away: 0 },
        { metric: 'Deaths', home: 0, away: 1 },
      ]),
    );
  });

  it('assigns competition ranks with ties sharing place', () => {
    const stub = (id: string, name: string, kills: number): DisplayPlayerStats =>
      ({
        playerId: id,
        playerName: name,
        kills,
        killsCredit: kills,
        hitRate: null,
      }) as DisplayPlayerStats;
    const rows = [stub('a', 'Alex', 5), stub('b', 'Blake', 5), stub('c', 'Casey', 3)];
    expect(leaderboardRank(rows, 'a', 'kills')).toEqual({
      rank: 1,
      total: 3,
      value: 5,
    });
    expect(leaderboardRank(rows, 'b', 'kills')?.rank).toBe(1);
    expect(leaderboardRank(rows, 'c', 'kills')).toEqual({
      rank: 3,
      total: 3,
      value: 3,
    });
    expect(leaderboardRank(rows, 'a', 'hitRate')).toBeNull();
  });

  it('merges linked sub stats on league rollups and can exclude them', () => {
    const data = createEmptyDatabase();
    const hawks = addTeam(data, 'Hawks');
    const owls = addTeam(data, 'Owls');
    const alex = addPlayer(data, hawks.Id, 'Alex');
    const casey = addPlayer(data, owls.Id, 'Casey');
    const homeMatch = addMatch(data, hawks.Id, owls.Id);
    toggleMatchPlayer(data, homeMatch.Id, alex.Id, true);
    toggleMatchPlayer(data, homeMatch.Id, casey.Id, false);
    const homeGame = addGame(data, homeMatch.Id);
    toggleGamePlayer(data, homeMatch.Id, homeGame, alex.Id);
    toggleGamePlayer(data, homeMatch.Id, homeGame, casey.Id);
    persistThrowGameEvent(data, homeGame, homeMatch.Id, [
      {
        throwerGamePlayerId: gpFor(data, alex.Id).Id,
        targetGamePlayerId: gpFor(data, casey.Id).Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistFinishGameEvent(data, homeGame, { resultId: GameEventFinishResult.WinHome });

    const wolves = addTeam(data, 'Wolves');
    const drew = addPlayer(data, wolves.Id, 'Drew');
    const subMatch = addMatch(data, owls.Id, wolves.Id);
    toggleMatchPlayer(data, subMatch.Id, casey.Id, true);
    toggleMatchPlayer(data, subMatch.Id, drew.Id, false);
    const guest = addPlayerToMatchSide(data, subMatch.Id, true, 'Alex', true, alex.Id);
    const subGame = addGame(data, subMatch.Id);
    toggleGamePlayer(data, subMatch.Id, subGame, guest.Id);
    toggleGamePlayer(data, subMatch.Id, subGame, drew.Id);
    const gpIn = (gameId: string, playerId: string) => {
      const gamePlayers = data.Tables.GamePlayer as {
        Id: string;
        GameId: string;
        MatchPlayerId: string;
      }[];
      const matchPlayers = data.Tables.MatchPlayer as { Id: string; PlayerId: string }[];
      return gamePlayers.find(
        (row) =>
          row.GameId === gameId &&
          matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === playerId,
      )!;
    };
    persistThrowGameEvent(data, subGame, subMatch.Id, [
      {
        throwerGamePlayerId: gpIn(subGame, guest.Id).Id,
        targetGamePlayerId: gpIn(subGame, drew.Id).Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistFinishGameEvent(data, subGame, { resultId: GameEventFinishResult.WinHome });

    const included = buildDisplayStats(data, { kind: 'league' }, { includeSubStats: true });
    expect(included.filter((row) => row.playerName === 'Alex')).toHaveLength(1);
    const alexIncluded = byName(included, 'Alex')!;
    expect(alexIncluded.playerId).toBe(alex.Id);
    expect(alexIncluded.teamName).toBe('Hawks');
    expect(alexIncluded.kills).toBe(2);
    expect(alexIncluded.gamesPlayed).toBe(2);
    expect(alexIncluded.hasSubStats).toBe(true);
    expect(alexIncluded.subGamesPlayed).toBe(1);
    expect(alexIncluded.subKills).toBe(1);

    const excluded = buildDisplayStats(data, { kind: 'league' }, { includeSubStats: false });
    const alexExcluded = byName(excluded, 'Alex')!;
    expect(alexExcluded.kills).toBe(1);
    expect(alexExcluded.gamesPlayed).toBe(1);
    expect(alexExcluded.hasSubStats).toBe(false);
    expect(alexExcluded.subKills).toBe(0);

    const matchRows = buildDisplayStats(data, { kind: 'match', matchId: subMatch.Id });
    const guestRow = matchRows.find((row) => row.playerId === guest.Id)!;
    expect(guestRow.isSubstitute).toBe(true);
    expect(guestRow.hasSubStats).toBe(true);
    expect(guestRow.canonicalPlayerId).toBe(alex.Id);
    expect(guestRow.teamName).toBe('Owls');
  });

  it('counts own-team bench appearances in the sub bucket', () => {
    const { data, match, gameId, h1 } = setupMatch();
    setMatchPlayerSubstitute(data, match.Id, h1.Id, true);
    persistFinishGameEvent(data, gameId, { resultId: GameEventFinishResult.WinHome });
    const rows = buildDisplayStats(data, { kind: 'league' }, { includeSubStats: true });
    const alex = byName(rows, 'Alex')!;
    expect(alex.hasSubStats).toBe(true);
    expect(alex.subGamesPlayed).toBe(1);
    expect(alex.gamesPlayed).toBe(1);
    const withoutSubs = buildDisplayStats(data, { kind: 'league' }, { includeSubStats: false });
    expect(byName(withoutSubs, 'Alex')).toBeUndefined();
  });
});
