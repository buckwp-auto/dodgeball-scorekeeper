import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeDatabase } from '../database';
import { getStatisticsSummaryCsvText } from './statisticsFormatService';

const fixturesDir = path.resolve(__dirname, '../../../../tests/fixtures');

function loadFixture(name: string) {
  const raw = readFileSync(path.join(fixturesDir, name), 'utf-8');
  return normalizeDatabase(JSON.parse(raw));
}

function matchIdFromFixture(name: string): string {
  const data = loadFixture(name);
  const matches = data.Tables.Match as { Id: string }[];
  if (!matches?.length) throw new Error(`No match in ${name}`);
  return matches[0].Id;
}

describe('statistics CSV interop', () => {
  for (const fixture of ['interop-basic.scrkpr', 'interop-with-throw.scrkpr']) {
    it(`matches golden CSV bytes for ${fixture}`, () => {
      const data = loadFixture(fixture);
      const matchId = matchIdFromFixture(fixture);
      const golden = readFileSync(
        path.join(fixturesDir, fixture.replace('.scrkpr', '.golden.csv')),
        'utf-8',
      );
      const actual = getStatisticsSummaryCsvText(data, [matchId]);
      expect(actual).toBe(golden);
    });
  }
});

describe('database normalization', () => {
  it('loads exported fixture tables', () => {
    const data = loadFixture('interop-basic.scrkpr');
    expect(data.Tables.Team).toHaveLength(2);
    expect(data.Tables.Player).toHaveLength(2);
    expect(data.Tables.Match).toHaveLength(1);
    expect(data.Tables.MatchPlayer).toHaveLength(2);
  });
});
