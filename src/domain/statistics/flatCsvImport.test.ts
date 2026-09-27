import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from '../database';
import { ECompetitionOutcome, ThrowResult } from './constants';
import { buildDisplayStats } from './displayStats';
import { parseStatsCsv } from './statsCsvImport';
import { applyStatsCsvImport, suggestStatsImportSelection } from './statsCsvImportPlan';

const FULL = [
  'Team,Player,GP,W-L,Kills,Deaths,Caught,Catches,Throws,Hits,Targeted,Hit%,K/D',
  'Polar Vortex,BJ Suarez,11,3-8,6,9,1,2,16,6,30,38%,0.67',
  'There’s Always Time,David Yang,13,9-4,5,10,0,1,18,5,36,28%,0.5',
].join('\n');

describe('flat statistics CSV import', () => {
  it('maps named columns and aliases to aggregates', () => {
    const parsed = parseStatsCsv(FULL);
    expect(parsed.format).toBe('flat');
    expect(parsed.missingStats).toEqual([]);
    expect(parsed.ignoredColumns).toEqual(['Hit%', 'K/D']);

    const bj = parsed.rows[0].aggregates;
    expect(bj.games[String(ECompetitionOutcome.Win)]).toBe(3);
    expect(bj.games[String(ECompetitionOutcome.Loss)]).toBe(8);
    expect(bj.games[String(ECompetitionOutcome.Incomplete)]).toBeUndefined();
    expect(bj.offenseThrowsIndividual[String(ThrowResult.Hit)]).toBe(6);
    expect(bj.offenseThrowsIndividual[String(ThrowResult.Catch)]).toBe(1);
    expect(bj.offenseThrowsIndividual[String(ThrowResult.Miss)]).toBe(9);
    expect(bj.catchesDirect).toBe(2);
    expect(parsed.notes).toContain(
      '22 throws had no result breakdown and were counted as misses (Hit% and Caught% are unaffected)',
    );
  });

  it('produces the same headline stats on the stats page', () => {
    const data = createEmptyDatabase();
    const { rows } = parseStatsCsv(FULL);
    const { matchId } = applyStatsCsvImport(data, {
      rows,
      selection: suggestStatsImportSelection(data, rows),
      series: { homeGameWins: 3, awayGameWins: 9, matchFinished: true },
    });
    const bj = buildDisplayStats(data, { kind: 'match', matchId }).find(
      (row) => row.playerName === 'BJ Suarez',
    )!;
    expect(bj.gamesPlayed).toBe(11);
    expect(bj.gamesWon).toBe(3);
    expect(bj.kills).toBe(6);
    expect(bj.deaths).toBe(9);
    expect(bj.catchesThrown).toBe(1);
    expect(bj.catches).toBe(2);
    expect(bj.throws).toBe(16);
    expect(bj.hitRate).toBeCloseTo(6 / 16);
    expect(bj.targets).toBe(30);
    expect(bj.catchRate).toBeCloseTo(2 / 30);
  });

  it('lists expected stats that are missing and keeps what it has', () => {
    const parsed = parseStatsCsv(
      ['Player Name;Team Name;Games;Kills', 'BJ Suarez;Polar Vortex;4;7'].join('\n'),
    );
    expect(parsed.rows[0].aggregates.games[String(ECompetitionOutcome.Incomplete)]).toBe(4);
    expect(parsed.missingStats).toEqual([
      'Deaths',
      'Catches',
      'Caught (times thrown ball was caught)',
      'Throws',
      'Hits (throws that hit)',
      'Targeted',
    ]);
  });

  it('imports flat rows into an existing roster', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Polar Vortex');
    const away = addTeam(data, "There's Always Time");
    const bj = addPlayer(data, home.Id, 'BJ Suarez');
    addMatch(data, home.Id, away.Id);
    const { rows } = parseStatsCsv(FULL);
    const selection = suggestStatsImportSelection(data, rows);
    expect(selection.players[0]).toEqual({ kind: 'existing', playerId: bj.Id });
    expect(selection.away.team).toEqual({ kind: 'existing', teamId: away.Id });
  });
});
