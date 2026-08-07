import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeDatabase, serializeDatabase } from '../domain/database';
import { ENTITY_TABLE_NAMES } from '../domain/tableNames';
import {
  diffDirty,
  extractMatchTables,
  extractRosterTables,
  gainedGameFinish,
  listMatchIds,
  mergeLeagueDocuments,
  serializeMatch,
  serializeRoster,
  splitDatabase,
} from './leagueSplitMerge';
import { MATCH_TABLES, ROSTER_TABLES } from './tablePartitions';

const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

function loadSixTeamFixture() {
  const raw = readFileSync(
    path.join(fixturesDir, 'league-six-teams.scrkpr'),
    'utf-8',
  );
  return normalizeDatabase(JSON.parse(raw));
}

describe('leagueSplitMerge', () => {
  it('partitions every entity table into roster or match', () => {
    const covered = new Set<string>([...ROSTER_TABLES, ...MATCH_TABLES]);
    expect([...ENTITY_TABLE_NAMES].sort()).toEqual([...covered].sort());
  });

  it('round-trips the six-team fixture through split/merge', () => {
    const original = loadSixTeamFixture();
    const { roster, matches } = splitDatabase(original);
    const matchDocs = Object.values(matches);
    const merged = mergeLeagueDocuments(roster, matchDocs);

    expect(serializeDatabase(merged)).toBe(serializeDatabase(original));
    expect(Object.keys(matches)).toHaveLength(listMatchIds(original).length);
  });

  it('keeps match slices disjoint and cover all match rows', () => {
    const data = loadSixTeamFixture();
    const ids = listMatchIds(data);
    const seenGames = new Set<string>();
    for (const matchId of ids) {
      const slice = extractMatchTables(data, matchId);
      expect(slice.Match).toHaveLength(1);
      for (const game of slice.Game as { Id: string }[]) {
        expect(seenGames.has(game.Id)).toBe(false);
        seenGames.add(game.Id);
      }
    }
    expect(seenGames.size).toBe((data.Tables.Game as unknown[]).length);
  });

  it('diffDirty detects roster vs match changes', () => {
    const prev = loadSixTeamFixture();
    const nextRoster = structuredClone(prev);
    (nextRoster.Tables.Team[0] as { Name: string }).Name = 'Renamed Team';

    const rosterDiff = diffDirty(prev, nextRoster);
    expect(rosterDiff.roster).toBe(true);
    expect(rosterDiff.matchIds).toHaveLength(0);

    const nextMatch = structuredClone(prev);
    const matchId = listMatchIds(nextMatch)[0];
    (
      nextMatch.Tables.Match.find(
        (row) => (row as { Id: string }).Id === matchId,
      ) as { Notes: string | null }
    ).Notes = 'tracked';

    const matchDiff = diffDirty(prev, nextMatch);
    expect(matchDiff.roster).toBe(false);
    expect(matchDiff.matchIds).toEqual([matchId]);
    expect(serializeRoster(prev)).toBe(serializeRoster(nextMatch));
    expect(serializeMatch(prev, matchId)).not.toBe(
      serializeMatch(nextMatch, matchId),
    );
  });

  it('gainedGameFinish detects new finish rows', () => {
    const prev = loadSixTeamFixture();
    const next = structuredClone(prev);
    expect(gainedGameFinish(prev, next)).toBe(false);

    (next.Tables.GameEventFinish as { GameEventId: string }[]).push({
      GameEventId: 'new-finish-event',
    });
    expect(gainedGameFinish(prev, next)).toBe(true);
  });

  it('extractRosterTables only includes roster keys', () => {
    const data = loadSixTeamFixture();
    const roster = extractRosterTables(data);
    expect(Object.keys(roster).sort()).toEqual([...ROSTER_TABLES].sort());
    expect((roster.Team as unknown[]).length).toBeGreaterThan(0);
    expect((roster.Player as unknown[]).length).toBeGreaterThan(0);
  });
});
