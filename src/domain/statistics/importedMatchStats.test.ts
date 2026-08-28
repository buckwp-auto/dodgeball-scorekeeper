import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from '../database';
import { getStatisticsSummaryCsvText } from './statisticsFormatService';
import {
  createMatchFromStatisticsCsv,
  importMatchStatistics,
} from './importedMatchStats';
import { createStatisticsSummary } from './statisticsService';
import { buildMatchSeries } from './teamStandings';

const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

function loadFixture(name: string) {
  const raw = readFileSync(path.join(fixturesDir, name), 'utf-8');
  return JSON.parse(raw);
}

describe('importedMatchStats', () => {
  it('imports CSV into an empty match and records series score', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home Hawks');
    const away = addTeam(data, 'Away Owls');
    addPlayer(data, home.Id, 'H1');
    addPlayer(data, away.Id, 'A1');
    const match = addMatch(data, home.Id, away.Id);
    const csv = readFileSync(
      path.join(fixturesDir, 'interop-basic.golden.csv'),
      'utf-8',
    );

    const result = importMatchStatistics(data, match.Id, csv, {
      homeGameWins: 1,
      awayGameWins: 0,
      tiedGames: 0,
      matchFinished: true,
    });

    expect(result.playersImported).toBe(2);
    expect(match.StatsImported).toBe(true);
    expect(match.ImportedHomeGameWins).toBe(1);
    expect(match.Ended).toBe(true);

    const series = buildMatchSeries(data, match.Id);
    expect(series?.homeGameWins).toBe(1);
    expect(series?.awayGameWins).toBe(0);
  });

  it('creates a match from CSV', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home Hawks');
    const away = addTeam(data, 'Away Owls');
    const csv = readFileSync(
      path.join(fixturesDir, 'interop-basic.golden.csv'),
      'utf-8',
    );
    const matchId = createMatchFromStatisticsCsv(data, home.Id, away.Id, csv, {
      homeGameWins: 0,
      awayGameWins: 1,
      matchFinished: true,
    });
    const stats = createStatisticsSummary(data, [matchId]);
    expect(stats).toHaveLength(2);
  });

  it('round-trips fixture export through import', () => {
    const fixture = loadFixture('interop-with-throw.scrkpr');
    const matchId = fixture.Tables.Match[0].Id as string;
    const csv = getStatisticsSummaryCsvText(fixture, [matchId]);

    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home Hawks');
    const away = addTeam(data, 'Away Owls');
    const match = addMatch(data, home.Id, away.Id);
    importMatchStatistics(data, match.Id, csv, {
      homeGameWins: 1,
      awayGameWins: 0,
      matchFinished: true,
    });

    const importedCsv = getStatisticsSummaryCsvText(data, [match.Id]);
    expect(importedCsv).toBe(csv);
  });
});
