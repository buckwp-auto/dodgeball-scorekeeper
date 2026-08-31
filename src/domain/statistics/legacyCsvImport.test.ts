import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getStatisticsSummaryHeaderLine } from './statisticsFormatService';
import { parseLegacyStatisticsCsv } from './legacyCsvImport';
import { getLegacyStatisticsHeaderNames } from './legacyCsvSchema';

const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

describe('legacyCsvImport', () => {
  it('matches export header layout', () => {
    const exportHeader = getStatisticsSummaryHeaderLine()
      .split(',')
      .map((cell) => cell.replace(/^"|"$/g, ''));
    expect(getLegacyStatisticsHeaderNames()).toEqual(exportHeader);
  });

  it('parses interop-basic golden CSV', () => {
    const csv = readFileSync(
      path.join(fixturesDir, 'interop-basic.golden.csv'),
      'utf-8',
    );
    const parsed = parseLegacyStatisticsCsv(csv);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].teamName).toBe('Away Owls');
    expect(parsed.rows[1].playerName).toBe('H1');
  });
});
