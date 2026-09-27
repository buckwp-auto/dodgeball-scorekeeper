import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HIGHLIGHT_QUALIFIERS,
  DISABLED_HIGHLIGHT_QUALIFIERS,
} from '../leagueSettings';
import type { DisplayPlayerStats } from './displayStats';
import {
  PLAYER_CARD_RADAR_AXES,
  buildPlayerCard,
  playerCardRank,
  playerCardStatValue,
} from './playerCard';

function stub(
  partial: Partial<DisplayPlayerStats> & { playerId: string; playerName: string },
): DisplayPlayerStats {
  return {
    teamId: 't',
    teamName: 'Team',
    teamHome: null,
    gamesPlayed: 2,
    gamesWon: 1,
    gamesLost: 1,
    gamesTied: 0,
    gamesIncomplete: 0,
    gameWinPct: 0.5,
    matchesPlayed: 1,
    kills: 0,
    killsCredit: 0,
    killsSupportCredit: 0,
    deaths: 0,
    deathsCredit: 0,
    assists: 0,
    doubleKills: 0,
    tripleKills: 0,
    quadKills: 0,
    doubleCatches: 0,
    tripleCatches: 0,
    quadCatches: 0,
    throws: 10,
    throwHits: 0,
    throwCounts: {},
    throwTagsThrown: {},
    throwTagsTaken: {},
    targets: 10,
    targetHits: 0,
    catches: 0,
    catchesDeflection: 0,
    catchesThrown: 0,
    recoveries: 0,
    wastedBalls: 0,
    lineOuts: 0,
    illegalBlocks: 0,
    kd: null,
    kdCredit: null,
    hitRate: null,
    catchRate: 0,
    caughtRate: 0,
    elusivenessRate: 1,
    vor: null,
    war: null,
    hasSubStats: false,
    subGamesPlayed: 0,
    subKills: 0,
    isSubstitute: false,
    ...partial,
  };
}

const open = { qualifiers: DISABLED_HIGHLIGHT_QUALIFIERS };

describe('playerCardRank', () => {
  const rows = [
    stub({ playerId: 'a', playerName: 'Alex', elusivenessRate: 0.9, caughtRate: 0.3, catchesThrown: 6 }),
    stub({ playerId: 'b', playerName: 'Blake', elusivenessRate: 0.7, caughtRate: 0.1, catchesThrown: 1 }),
    stub({ playerId: 'c', playerName: 'Casey', elusivenessRate: 0.7, caughtRate: 0.2, catchesThrown: 3 }),
    stub({ playerId: 'd', playerName: 'Drew', elusivenessRate: 0.5, caughtRate: 0.4, catchesThrown: 8 }),
    stub({ playerId: 'e', playerName: 'Eli', elusivenessRate: 0.2, caughtRate: 0.5, catchesThrown: 9 }),
  ];

  it('ranks descending for higher-is-better stats and shares ties', () => {
    expect(playerCardRank(rows, 'a', 'elusivenessRate', open)).toMatchObject({
      rank: 1,
      total: 5,
      strength: 1,
      medal: 1,
      tier: 'top',
    });
    expect(playerCardRank(rows, 'b', 'elusivenessRate', open)?.rank).toBe(2);
    expect(playerCardRank(rows, 'c', 'elusivenessRate', open)?.rank).toBe(2);
    expect(playerCardRank(rows, 'd', 'elusivenessRate', open)).toMatchObject({
      rank: 4,
      medal: null,
      tier: 'bottom',
    });
    expect(playerCardRank(rows, 'e', 'elusivenessRate', open)).toMatchObject({
      rank: 5,
      strength: 0,
      tier: 'bottom',
    });
  });

  it('ranks Caught and Caught % ascending', () => {
    expect(playerCardRank(rows, 'b', 'caughtRate', open)?.rank).toBe(1);
    expect(playerCardRank(rows, 'b', 'caught', open)?.rank).toBe(1);
    expect(playerCardRank(rows, 'e', 'caught', open)?.rank).toBe(5);
    expect(playerCardRank(rows, 'c', 'caught', open)).toMatchObject({
      rank: 2,
      medal: 2,
      strength: 0.75,
    });
  });

  it('leaves the middle of the pool uncolored', () => {
    expect(playerCardRank(rows, 'a', 'caught', open)).toMatchObject({
      rank: 3,
      medal: 3,
      tier: null,
    });
  });

  it('skips players below league minimums', () => {
    const qualified = rows.map((row) => ({
      ...row,
      gamesPlayed: 20,
      matchesPlayed: 3,
      throws: 30,
      targets: 30,
    }));
    const pool = [...qualified, stub({ playerId: 'x', playerName: 'Xan', elusivenessRate: 1 })];
    const opts = { qualifiers: DEFAULT_HIGHLIGHT_QUALIFIERS };
    expect(playerCardRank(pool, 'x', 'elusivenessRate', opts)).toBeNull();
    expect(playerCardRank(pool, 'a', 'elusivenessRate', opts)).toMatchObject({
      rank: 1,
      total: 5,
    });
  });

  it('treats a lone ranked player as #1 with no tier color', () => {
    const solo = [stub({ playerId: 'a', playerName: 'Alex' })];
    expect(playerCardRank(solo, 'a', 'catchRate', open)).toMatchObject({
      rank: 1,
      total: 1,
      strength: 1,
      tier: null,
      medal: 1,
    });
  });
});

describe('buildPlayerCard', () => {
  it('returns every card stat and six radar axes', () => {
    const rows = [
      stub({ playerId: 'a', playerName: 'Alex', catchesThrown: 2, vor: 0.5, war: 0.5 / 6 }),
      stub({ playerId: 'b', playerName: 'Blake', catchesThrown: 4, vor: -0.5, war: -0.5 / 6 }),
    ];
    const card = buildPlayerCard(rows, 'a', open)!;
    expect(card.qualified).toBe(true);
    expect(card.stats.map((stat) => stat.id)).toEqual([
      'elusivenessRate',
      'catchRate',
      'caught',
      'caughtRate',
      'efficiencyRate',
      'netScore',
      'vor',
      'war',
    ]);
    expect(card.stats.find((stat) => stat.id === 'caught')?.value).toBe(2);
    expect(card.radar).toHaveLength(PLAYER_CARD_RADAR_AXES.length);
    expect(card.radar.find((axis) => axis.id === 'vor')?.rank?.rank).toBe(1);
  });

  it('shows values but no ranks when the player is unqualified', () => {
    const rows = [stub({ playerId: 'a', playerName: 'Alex', gamesPlayed: 1 })];
    const card = buildPlayerCard(rows, 'a', { qualifiers: DEFAULT_HIGHLIGHT_QUALIFIERS })!;
    expect(card.qualified).toBe(false);
    expect(card.stats.every((stat) => stat.rank == null)).toBe(true);
    expect(card.stats.find((stat) => stat.id === 'elusivenessRate')?.value).toBe(1);
  });

  it('returns null for a player with no stats row', () => {
    expect(buildPlayerCard([], 'missing', open)).toBeNull();
  });

  it('follows counting mode for efficiency', () => {
    const row = stub({ playerId: 'a', playerName: 'Alex', throws: 10, kills: 4, killsCredit: 3 });
    expect(playerCardStatValue(row, 'efficiencyRate', 'counts')).toBeCloseTo(0.4);
    expect(playerCardStatValue(row, 'efficiencyRate', 'credit')).toBeCloseTo(0.3);
  });
});
