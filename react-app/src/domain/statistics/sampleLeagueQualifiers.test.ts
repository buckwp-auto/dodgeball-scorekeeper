import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeDatabase } from '../database';
import { DEFAULT_HIGHLIGHT_QUALIFIERS } from '../leagueSettings';
import { buildDisplayStats } from './displayStats';
import {
  playerMeetsHighlightQualifiers,
  topHighlightPlayers,
} from './highlightStats';

const fixturePath = path.resolve(
  __dirname,
  '../../../../tests/fixtures/league-six-teams.scrkpr',
);

describe('sample league highlight qualifiers', () => {
  it('has enough volume for default 15 games / 2 matches / 20 throws & targets', () => {
    const data = normalizeDatabase(JSON.parse(readFileSync(fixturePath, 'utf-8')));
    const rows = buildDisplayStats(data, { kind: 'league' });
    const eligible = rows.filter((row) =>
      playerMeetsHighlightQualifiers(row, DEFAULT_HIGHLIGHT_QUALIFIERS),
    );

    expect(eligible.length).toBeGreaterThanOrEqual(5);
    expect(Math.min(...eligible.map((row) => row.gamesPlayed))).toBeGreaterThanOrEqual(15);
    expect(Math.min(...eligible.map((row) => row.matchesPlayed))).toBeGreaterThanOrEqual(2);
    expect(Math.min(...eligible.map((row) => row.throws))).toBeGreaterThanOrEqual(20);
    expect(Math.min(...eligible.map((row) => row.targets))).toBeGreaterThanOrEqual(20);
    expect(topHighlightPlayers(rows, 'elusivenessRate')).toHaveLength(5);
  });
});
