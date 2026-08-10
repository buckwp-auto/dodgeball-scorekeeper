import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HIGHLIGHT_QUALIFIERS,
  DISABLED_HIGHLIGHT_QUALIFIERS,
} from '../leagueSettings';
import type { DisplayPlayerStats } from './displayStats';
import {
  attachVorWar,
  compareHighlight,
  formatHighlightQualifiers,
  highlightMetricValue,
  median,
  playerMeetsHighlightQualifiers,
  populationStdev,
  topHighlightPlayers,
} from './highlightStats';

function stub(partial: Partial<DisplayPlayerStats> & { playerId: string; playerName: string }): DisplayPlayerStats {
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

describe('median / stdev', () => {
  it('uses the middle value or the average of the two middle values', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 4, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('uses population standard deviation', () => {
    expect(populationStdev([2, 4])).toBe(1);
    expect(populationStdev([5])).toBe(0);
  });
});

describe('attachVorWar', () => {
  it('is zero at the median and WAR is VOR / 6', () => {
    const rows = [
      stub({
        playerId: 'a',
        playerName: 'Alex',
        caughtRate: 0.2,
        catchRate: 0.3,
        elusivenessRate: 0.8,
        throws: 10,
        kills: 4,
        deaths: 2,
        catches: 1,
        catchesThrown: 2,
      }),
      stub({
        playerId: 'b',
        playerName: 'Blake',
        caughtRate: 0.2,
        catchRate: 0.3,
        elusivenessRate: 0.8,
        throws: 10,
        kills: 4,
        deaths: 2,
        catches: 1,
        catchesThrown: 2,
      }),
    ];
    const enriched = attachVorWar(rows, 'counts', DISABLED_HIGHLIGHT_QUALIFIERS);
    expect(enriched[0]!.vor).toBeCloseTo(0);
    expect(enriched[0]!.war).toBeCloseTo(0);
    expect(enriched[1]!.vor).toBeCloseTo(enriched[0]!.vor!);
    expect(enriched[1]!.war).toBeCloseTo(enriched[0]!.vor! / 6);
  });

  it('inverts Caught% so fewer catches thrown raise VOR', () => {
    const base = {
      catchRate: 0.4,
      elusivenessRate: 0.7,
      throws: 10,
      kills: 3,
      deaths: 3,
      catches: 2,
      catchesThrown: 2,
    };
    const rows = [
      stub({ playerId: 'low', playerName: 'Low Caught', ...base, caughtRate: 0.1 }),
      stub({ playerId: 'mid', playerName: 'Mid Caught', ...base, caughtRate: 0.3 }),
      stub({ playerId: 'high', playerName: 'High Caught', ...base, caughtRate: 0.5 }),
    ];
    const enriched = attachVorWar(rows, 'counts', DISABLED_HIGHLIGHT_QUALIFIERS);
    const byId = Object.fromEntries(enriched.map((row) => [row.playerId, row]));
    expect(byId.low!.vor!).toBeGreaterThan(byId.mid!.vor!);
    expect(byId.mid!.vor!).toBeGreaterThan(byId.high!.vor!);
  });

  it('leaves VOR null when a rate is missing', () => {
    const rows = [
      stub({
        playerId: 'a',
        playerName: 'Alex',
        throws: 0,
        caughtRate: null,
        catchRate: 0.5,
        elusivenessRate: 0.8,
      }),
    ];
    expect(attachVorWar(rows, 'counts', DISABLED_HIGHLIGHT_QUALIFIERS)[0]!.vor).toBeNull();
    expect(attachVorWar(rows, 'counts', DISABLED_HIGHLIGHT_QUALIFIERS)[0]!.war).toBeNull();
  });

  it('omits VOR for players below league qualifier minimums', () => {
    const rows = [
      stub({
        playerId: 'a',
        playerName: 'Alex',
        gamesPlayed: 20,
        matchesPlayed: 4,
        throws: 40,
        targets: 40,
        caughtRate: 0.2,
        catchRate: 0.3,
        elusivenessRate: 0.8,
        kills: 4,
        deaths: 2,
        catches: 1,
        catchesThrown: 2,
      }),
      stub({
        playerId: 'b',
        playerName: 'Blake',
        gamesPlayed: 2,
        matchesPlayed: 1,
        throws: 5,
        targets: 5,
        caughtRate: 0.2,
        catchRate: 0.3,
        elusivenessRate: 0.8,
        kills: 4,
        deaths: 2,
        catches: 1,
        catchesThrown: 2,
      }),
    ];
    const enriched = attachVorWar(rows, 'counts', DEFAULT_HIGHLIGHT_QUALIFIERS);
    expect(enriched.find((row) => row.playerId === 'a')?.vor).not.toBeNull();
    expect(enriched.find((row) => row.playerId === 'b')?.vor).toBeNull();
  });
});

describe('topHighlightPlayers', () => {
  it('ranks Caught% ascending and Elusiveness% descending', () => {
    const rows = [
      stub({
        playerId: 'a',
        playerName: 'Alex',
        caughtRate: 0.4,
        elusivenessRate: 0.5,
        gamesPlayed: 2,
      }),
      stub({
        playerId: 'b',
        playerName: 'Blake',
        caughtRate: 0.1,
        elusivenessRate: 0.9,
        gamesPlayed: 2,
      }),
      stub({
        playerId: 'c',
        playerName: 'Casey',
        caughtRate: 0.2,
        elusivenessRate: 0.7,
        gamesPlayed: 2,
      }),
    ];
    expect(
      topHighlightPlayers(rows, 'caughtRate', { qualifiers: DISABLED_HIGHLIGHT_QUALIFIERS }).map(
        (row) => row.playerName,
      ),
    ).toEqual(['Blake', 'Casey', 'Alex']);
    expect(
      topHighlightPlayers(rows, 'elusivenessRate', {
        qualifiers: DISABLED_HIGHLIGHT_QUALIFIERS,
      }).map((row) => row.playerName),
    ).toEqual(['Blake', 'Casey', 'Alex']);
  });

  it('hides players below qualifier minimums and caps at 5', () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      stub({
        playerId: `p${index}`,
        playerName: `Player ${index}`,
        elusivenessRate: 1 - index * 0.05,
        gamesPlayed: index < 6 ? 2 : 0,
        matchesPlayed: 2,
        throws: 20,
        targets: 20,
      }),
    );
    const top = topHighlightPlayers(rows, 'elusivenessRate', {
      qualifiers: {
        ...DISABLED_HIGHLIGHT_QUALIFIERS,
        minGamesEnabled: true,
        minGames: 1,
      },
      limit: 5,
    });
    expect(top).toHaveLength(5);
    expect(top[0]!.playerName).toBe('Player 0');
    expect(top.some((row) => row.gamesPlayed < 1)).toBe(false);
  });

  it('applies default 15 games / 2 matches / 20 throws & targets', () => {
    const qualified = stub({
      playerId: 'a',
      playerName: 'Alex',
      elusivenessRate: 0.5,
      gamesPlayed: 15,
      matchesPlayed: 2,
      throws: 20,
      targets: 20,
    });
    const short = stub({
      playerId: 'b',
      playerName: 'Blake',
      elusivenessRate: 0.9,
      gamesPlayed: 14,
      matchesPlayed: 4,
      throws: 40,
      targets: 40,
    });
    expect(playerMeetsHighlightQualifiers(qualified, DEFAULT_HIGHLIGHT_QUALIFIERS)).toBe(true);
    expect(playerMeetsHighlightQualifiers(short, DEFAULT_HIGHLIGHT_QUALIFIERS)).toBe(false);
    expect(topHighlightPlayers([short, qualified], 'elusivenessRate').map((row) => row.playerName)).toEqual(
      ['Alex'],
    );
    expect(formatHighlightQualifiers(DEFAULT_HIGHLIGHT_QUALIFIERS)).toBe(
      '15 games, 2 matches, 20 throws & 20 targets',
    );
    expect(formatHighlightQualifiers(DISABLED_HIGHLIGHT_QUALIFIERS)).toBe('none');
  });

  it('compares highlight metrics with name tie-break', () => {
    const a = stub({ playerId: 'a', playerName: 'Alex', elusivenessRate: 0.8 });
    const b = stub({ playerId: 'b', playerName: 'Blake', elusivenessRate: 0.8 });
    expect(compareHighlight(a, b, 'elusivenessRate', 'desc')).toBeLessThan(0);
    expect(highlightMetricValue(a, 'elusivenessRate')).toBe(0.8);
  });
});
