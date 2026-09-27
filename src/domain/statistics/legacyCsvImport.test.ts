import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getStatisticsSummaryHeaderLine } from './statisticsFormatService';
import { DeflectionResult, EThrowError, ThrowResult } from './constants';
import {
  getLegacyStatisticsColumnSpecs,
  getLegacyStatisticsHeaderNames,
} from './legacyCsvSchema';
import { parseStatsCsv } from './statsCsvImport';

const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

function scorekeeper2Row(values: { section: string; header: string; value: string }[]) {
  const specs = getLegacyStatisticsColumnSpecs({ deflectionDodge: false });
  const cells = specs.map(() => '0');
  cells[0] = 'Polar Vortex';
  cells[1] = 'BJ Suarez';
  for (const { section, header, value } of values) {
    cells[specs.findIndex((spec) => spec.sectionTitle === section && spec.header === header)] =
      value;
  }
  return cells;
}

describe('sectioned statistics CSV import', () => {
  it('matches export header layout', () => {
    const exportHeader = getStatisticsSummaryHeaderLine()
      .split(',')
      .map((cell) => cell.replace(/^"|"$/g, ''));
    expect(getLegacyStatisticsHeaderNames()).toEqual(exportHeader);
  });

  it('parses interop-basic golden CSV with nothing missing', () => {
    const csv = readFileSync(path.join(fixturesDir, 'interop-basic.golden.csv'), 'utf-8');
    const parsed = parseStatsCsv(csv);
    expect(parsed.format).toBe('sectioned');
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].teamName).toBe('Away Owls');
    expect(parsed.rows[1].playerName).toBe('H1');
    expect(parsed.missingStats).toEqual([]);
    expect(parsed.ignoredColumns).toEqual([]);
  });

  it('parses original scorekeeper2 CSV without deflection Dodge columns', () => {
    const cells = scorekeeper2Row([
      { section: 'Throws (Deflection) (Individual)', header: 'Catch', value: '2' },
      { section: 'Throws (Error)', header: 'WastedBall', value: '3' },
      { section: 'Targeted (Direct)', header: 'Catch', value: '4' },
      { section: 'Targeted (Deflection)', header: 'Catch', value: '5' },
    ]);
    const csv = [
      getLegacyStatisticsHeaderNames({ deflectionDodge: false }).join(','),
      cells.join(','),
    ].join('\n');

    const parsed = parseStatsCsv(csv);
    const [row] = parsed.rows;

    expect(parsed.missingStats).toEqual([]);
    expect(row.playerName).toBe('BJ Suarez');
    expect(row.aggregates.offenseDeflectionsIndividual[String(DeflectionResult.Catch)]).toBe(2);
    expect(row.aggregates.offenseErrors[String(EThrowError.WastedBall)]).toBe(3);
    expect(row.aggregates.catchesDirect).toBe(4);
    expect(row.aggregates.catchesDeflection).toBe(5);
  });

  it('reads tab-separated clipboard copies', () => {
    const cells = scorekeeper2Row([
      { section: 'Targeted (Direct)', header: 'Catch', value: '4' },
    ]);
    const tsv = [
      getLegacyStatisticsHeaderNames({ deflectionDodge: false }).join('\t'),
      cells.join('\t'),
      ['Other Team', 'Someone'].join('\t'),
    ].join('\n');
    const parsed = parseStatsCsv(tsv);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].aggregates.catchesDirect).toBe(4);
  });

  it('lists missing sections and ignores unknown columns in any order', () => {
    const csv = [
      [
        'Player',
        'Team',
        '********** Targeted (Direct)',
        'Catch',
        'Hit',
        'Mystery',
        '********** Bonus Points',
        'Gold',
      ].join(','),
      ['BJ Suarez', 'Polar Vortex', '9', '3', '6', '1', '', '7'].join(','),
    ].join('\n');

    const parsed = parseStatsCsv(csv);
    const [row] = parsed.rows;

    expect(row.teamName).toBe('Polar Vortex');
    expect(row.aggregates.defenseTargets[String(ThrowResult.Catch)]).toBe(3);
    expect(row.aggregates.defenseTargets[String(ThrowResult.Hit)]).toBe(6);
    expect(parsed.ignoredColumns).toEqual([
      'Targeted (Direct): Mystery',
      '********** Bonus Points',
      'Gold',
    ]);
    expect(parsed.missingStats).toContain('Kills (Direct) (Individual)');
    expect(parsed.missingStats).toContain('Targeted (Direct): Block, BlockFailed, CatchFailed, Dodge, Miss');
    expect(parsed.missingStats).not.toContain('Targeted (Direct)');
  });

  it('skips rows without a team or player and reports bad counts by player', () => {
    const header = getLegacyStatisticsHeaderNames({ deflectionDodge: false });
    const good = scorekeeper2Row([]);
    const blank = header.map(() => '');
    const parsed = parseStatsCsv([header, good, blank].map((r) => r.join(',')).join('\n'));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.notes).toEqual(['Skipped 1 row without a team or player name']);

    const bad = scorekeeper2Row([{ section: 'Games', header: 'Win', value: 'lots' }]);
    expect(() => parseStatsCsv([header, bad].map((r) => r.join(',')).join('\n'))).toThrow(
      'BJ Suarez (Games Win): "lots" is not a valid count',
    );
  });

  it('requires Team and Player columns', () => {
    expect(() => parseStatsCsv('********** Games,Win\n1,2')).toThrow(
      'Statistics CSV needs a Team and a Player column',
    );
  });
});
