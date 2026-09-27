import { describe, expect, it } from 'vitest';
import {
  addMatch,
  addPlayer,
  addTeam,
  createEmptyDatabase,
  getPlayersForTeam,
  getTeams,
} from '../database';
import { getMatchPlayers } from '../matchGame';
import { parseStatsCsv } from './statsCsvImport';
import {
  applyStatsCsvImport,
  reviewStatsImport,
  setImportPlayerChoice,
  setImportSideTeam,
  suggestStatsImportSelection,
  swapImportSides,
} from './statsCsvImportPlan';

const CSV = [
  'Team,Player,GP,Kills',
  'Polar Vortex,BJ Suarez,11,6',
  'Polar Vortex,Ellie Bawek,11,8',
  'There’s Always Time,David Yang,13,5',
  'There’s Always Time,Tom Duffy,13,2',
].join('\n');

const SERIES = { homeGameWins: 4, awayGameWins: 8, matchFinished: true };

function league() {
  const data = createEmptyDatabase();
  const vortex = addTeam(data, 'Polar Vortex');
  const time = addTeam(data, "There's always time");
  const bj = addPlayer(data, vortex.Id, 'bj suarez');
  const ellie = addPlayer(data, vortex.Id, 'Ellie B.');
  const david = addPlayer(data, time.Id, 'David Yang');
  const tom = addPlayer(data, time.Id, 'Tom Duffy');
  return { data, vortex, time, bj, ellie, david, tom };
}

describe('stats CSV import matching', () => {
  it('matches teams and players by normalized name with the first CSV team as home', () => {
    const { data, vortex, time, bj, david, tom } = league();
    const { rows } = parseStatsCsv(CSV);
    const selection = suggestStatsImportSelection(data, rows);

    expect(selection.home).toEqual({
      csvTeamName: 'Polar Vortex',
      team: { kind: 'existing', teamId: vortex.Id },
    });
    expect(selection.away.team).toEqual({ kind: 'existing', teamId: time.Id });
    expect(selection.players).toEqual([
      { kind: 'existing', playerId: bj.Id },
      { kind: 'create' },
      { kind: 'existing', playerId: david.Id },
      { kind: 'existing', playerId: tom.Id },
    ]);

    const review = reviewStatsImport(data, rows, selection);
    expect(review.errors).toEqual([]);
    expect(review.unmatchedTeams).toEqual([]);
    expect(review.unmatchedPlayerRows).toEqual([1]);
    expect(review.newPlayerNames).toEqual(['Ellie Bawek']);
  });

  it('flags unknown teams and defaults them to new teams', () => {
    const data = createEmptyDatabase();
    const { rows } = parseStatsCsv(CSV);
    const selection = suggestStatsImportSelection(data, rows);
    expect(selection.home.team).toEqual({ kind: 'create', name: 'Polar Vortex' });
    const review = reviewStatsImport(data, rows, selection);
    expect(review.unmatchedTeams).toEqual(['Polar Vortex', 'There’s Always Time']);
    expect(review.unmatchedPlayerRows).toEqual([0, 1, 2, 3]);
    expect(review.newTeamNames).toHaveLength(2);

    const { matchId, teamsCreated, playersCreated } = applyStatsCsvImport(data, {
      rows,
      selection,
      series: SERIES,
    });
    expect(teamsCreated).toBe(2);
    expect(playersCreated).toBe(4);
    expect(getTeams(data).map((team) => team.Name)).toEqual([
      'Polar Vortex',
      'There’s Always Time',
    ]);
    expect(getMatchPlayers(data, matchId)).toHaveLength(4);
  });

  it('lets the uploader map, skip, and catch duplicate player mappings', () => {
    const { data, ellie, bj } = league();
    const { rows } = parseStatsCsv(CSV);
    let selection = suggestStatsImportSelection(data, rows);
    selection = setImportPlayerChoice(selection, 1, { kind: 'existing', playerId: ellie.Id });
    selection = setImportPlayerChoice(selection, 3, { kind: 'skip' });

    const { matchId, playersImported, playersCreated } = applyStatsCsvImport(data, {
      rows,
      selection,
      series: SERIES,
    });
    expect(playersImported).toBe(3);
    expect(playersCreated).toBe(0);
    expect(getMatchPlayers(data, matchId).map((row) => row.PlayerId)).toContain(ellie.Id);

    const duplicate = setImportPlayerChoice(selection, 1, { kind: 'existing', playerId: bj.Id });
    expect(reviewStatsImport(data, rows, duplicate).errors).toEqual([
      '"BJ Suarez" and "Ellie Bawek" are both mapped to bj suarez',
    ]);
  });

  it('re-suggests players when a side is pointed at a different team', () => {
    const { data, vortex } = league();
    const other = addTeam(data, 'Vortex Juniors');
    const junior = addPlayer(data, other.Id, 'BJ Suarez');
    const { rows } = parseStatsCsv(CSV);
    const selection = setImportSideTeam(
      data,
      rows,
      suggestStatsImportSelection(data, rows),
      'home',
      { kind: 'existing', teamId: other.Id },
    );
    expect(selection.players[0]).toEqual({ kind: 'existing', playerId: junior.Id });
    expect(selection.players[1]).toEqual({ kind: 'create' });
    expect(reviewStatsImport(data, rows, selection).unmatchedTeams).toEqual(['Polar Vortex']);
    expect(getPlayersForTeam(data, vortex.Id)).toHaveLength(2);
  });

  it('keeps an existing match’s teams fixed and swaps which CSV team maps to each side', () => {
    const { data, vortex, time, david } = league();
    const match = addMatch(data, time.Id, vortex.Id);
    const fixed = { homeTeamId: match.TeamIdHome, awayTeamId: match.TeamIdAway };
    const { rows } = parseStatsCsv(CSV);

    const selection = suggestStatsImportSelection(data, rows, fixed);
    expect(selection.home.csvTeamName).toBe('There’s Always Time');
    expect(selection.home.team).toEqual({ kind: 'existing', teamId: time.Id });
    expect(selection.players[2]).toEqual({ kind: 'existing', playerId: david.Id });

    const swapped = swapImportSides(data, rows, selection, fixed);
    expect(swapped.home.team).toEqual({ kind: 'existing', teamId: time.Id });
    expect(swapped.home.csvTeamName).toBe('Polar Vortex');
    expect(swapped.players[2]).toEqual({ kind: 'create' });
    expect(reviewStatsImport(data, rows, swapped).unmatchedTeams).toEqual([
      'Polar Vortex',
      'There’s Always Time',
    ]);

    applyStatsCsvImport(data, { rows, selection, series: SERIES, matchId: match.Id });
    expect(match.StatsImported).toBe(true);
  });

  it('requires exactly two teams', () => {
    const { data } = league();
    const { rows } = parseStatsCsv('Team,Player,Kills\nA,One,1\nB,Two,2\nC,Three,3');
    expect(() => suggestStatsImportSelection(data, rows)).toThrow(
      'The CSV lists 3 teams (A, B, C); a match needs exactly two',
    );
  });

  it('blocks importing the same team on both sides', () => {
    const { data, vortex } = league();
    const { rows } = parseStatsCsv(CSV);
    const selection = setImportSideTeam(
      data,
      rows,
      suggestStatsImportSelection(data, rows),
      'away',
      { kind: 'existing', teamId: vortex.Id },
    );
    expect(() => applyStatsCsvImport(data, { rows, selection, series: SERIES })).toThrow(
      'Home and away must be different teams',
    );
  });
});
