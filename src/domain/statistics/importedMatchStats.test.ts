import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from '../database';
import {
  addGame,
  toggleGamePlayer,
  toggleMatchPlayer,
} from '../matchGame';
import { persistThrowGameEvent, persistFinishGameEvent } from '../gameEvents';
import { ThrowResult, GameEventFinishResult } from './constants';
import { buildDisplayStats, displayedDeaths } from './displayStats';
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

function gpFor(data: ReturnType<typeof createEmptyDatabase>, playerId: string) {
  const gamePlayers = data.Tables.GamePlayer as { Id: string; MatchPlayerId: string }[];
  const matchPlayers = data.Tables.MatchPlayer as { Id: string; PlayerId: string }[];
  return gamePlayers.find(
    (row) =>
      matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === playerId,
  )!;
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

  it('derives catches and death credit from legacy CSV breakdown columns', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home Hawks');
    const away = addTeam(data, 'Away Owls');
    const h1 = addPlayer(data, home.Id, 'Alex');
    const a1 = addPlayer(data, away.Id, 'Casey');
    const a2 = addPlayer(data, away.Id, 'Drew');
    const match = addMatch(data, home.Id, away.Id);
    toggleMatchPlayer(data, match.Id, h1.Id, true);
    toggleMatchPlayer(data, match.Id, a1.Id, false);
    toggleMatchPlayer(data, match.Id, a2.Id, false);
    const gameId = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, gameId, h1.Id);
    toggleGamePlayer(data, match.Id, gameId, a1.Id);
    toggleGamePlayer(data, match.Id, gameId, a2.Id);
    const homeGp = gpFor(data, h1.Id);
    const awayGp = gpFor(data, a1.Id);
    const awayGp2 = gpFor(data, a2.Id);

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
        recoveredId: awayGp2.Id,
      },
    ]);
    persistFinishGameEvent(data, gameId, { resultId: GameEventFinishResult.WinHome });

    const tracked = buildDisplayStats(data, { kind: 'match', matchId: match.Id });
    const alexTracked = tracked.find((r) => r.playerName === 'Alex')!;
    const caseyTracked = tracked.find((r) => r.playerName === 'Casey')!;

    const csv = getStatisticsSummaryCsvText(data, [match.Id]);
    const data2 = createEmptyDatabase();
    const home2 = addTeam(data2, 'Home Hawks');
    const away2 = addTeam(data2, 'Away Owls');
    addPlayer(data2, home2.Id, 'Alex');
    addPlayer(data2, away2.Id, 'Casey');
    addPlayer(data2, away2.Id, 'Drew');
    const match2 = addMatch(data2, home2.Id, away2.Id);
    importMatchStatistics(data2, match2.Id, csv, {
      homeGameWins: 1,
      awayGameWins: 0,
      matchFinished: true,
    });

    const imported = buildDisplayStats(data2, { kind: 'match', matchId: match2.Id });
    const alexImported = imported.find((r) => r.playerName === 'Alex')!;
    const caseyImported = imported.find((r) => r.playerName === 'Casey')!;

    expect(alexImported.catchesThrown).toBe(alexTracked.catchesThrown);
    expect(caseyImported.catches).toBe(caseyTracked.catches);
    expect(caseyImported.deaths).toBe(caseyTracked.deaths);
    expect(displayedDeaths(caseyImported, 'credit')).toBe(
      displayedDeaths(caseyTracked, 'credit'),
    );
  });
});
