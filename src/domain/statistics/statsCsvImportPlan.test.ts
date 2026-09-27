import { describe, expect, it } from 'vitest';
import {
  addMatch,
  addPlayer,
  addTeam,
  createEmptyDatabase,
  getPlayer,
  getPlayersForTeam,
  getTeams,
} from '../database';
import { getMatchById, getMatchPlayers } from '../matchGame';
import { parseStatsCsv } from './statsCsvImport';
import {
  applyStatsCsvImport,
  reviewStatsImport,
  setImportPlayerChoice,
  setImportSideTeam,
  suggestStatsImportSelection,
  suggestSubstituteLinks,
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

  it('imports an unrecognized player as a match substitute', () => {
    const { data } = league();
    const { rows } = parseStatsCsv(CSV);
    const selection = setImportPlayerChoice(suggestStatsImportSelection(data, rows), 1, {
      kind: 'substitute',
    });
    const review = reviewStatsImport(data, rows, selection);
    expect(review.newPlayerNames).toEqual([]);
    expect(review.substitutePlayerNames).toEqual(['Ellie Bawek']);

    const { matchId, playersCreated } = applyStatsCsvImport(data, {
      rows,
      selection,
      series: SERIES,
    });
    expect(playersCreated).toBe(1);
    const sub = getMatchPlayers(data, matchId).find((row) => row.IsSubstitute)!;
    const player = getPlayer(data, sub.PlayerId)!;
    expect(player.Name).toBe('Ellie Bawek');
    expect(player.AddedFromMatch).toBe(true);
    expect(player.LinkedPlayerId).toBeUndefined();
    expect(sub.TeamHome).toBe(true);
  });

  it('suggests a cross-team sub when the name matches a player on another team', () => {
    const { data, vortex, time } = league();
    const other = addTeam(data, 'Night Owls');
    const ellie = addPlayer(data, other.Id, 'Ellie Bawek');
    const { rows } = parseStatsCsv(CSV);
    const selection = suggestStatsImportSelection(data, rows);
    expect(selection.players[1]).toEqual({ kind: 'substitute', linkedPlayerId: ellie.Id });
    expect(suggestSubstituteLinks(data, selection, 'Ellie').map((c) => c.playerId)).toEqual([
      ellie.Id,
    ]);
    expect(suggestSubstituteLinks(data, selection, 'Tom Duffy')).toEqual([]);

    const { matchId } = applyStatsCsvImport(data, { rows, selection, series: SERIES });
    const sub = getMatchPlayers(data, matchId).find((row) => row.IsSubstitute)!;
    const guest = getPlayer(data, sub.PlayerId)!;
    expect(guest.LinkedPlayerId).toBe(ellie.Id);
    expect(getPlayersForTeam(data, vortex.Id).map((p) => p.Id)).toContain(guest.Id);
    expect(getPlayersForTeam(data, time.Id)).toHaveLength(2);

    const twice = setImportPlayerChoice(selection, 0, {
      kind: 'substitute',
      linkedPlayerId: ellie.Id,
    });
    expect(reviewStatsImport(data, rows, twice).errors).toEqual([
      '"BJ Suarez" and "Ellie Bawek" are both mapped to Ellie Bawek',
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

  it('sets match labels on import and leaves them alone when omitted', () => {
    const { data } = league();
    const { rows } = parseStatsCsv(CSV);
    const selection = suggestStatsImportSelection(data, rows);
    const { matchId } = applyStatsCsvImport(data, {
      rows,
      selection,
      series: SERIES,
      labels: ['Week 3', ' week 3 ', 'Playoffs'],
    });
    const match = getMatchById(data, matchId)!;
    expect(match.Labels).toEqual(['Week 3', 'Playoffs']);

    const fixed = { homeTeamId: match.TeamIdHome, awayTeamId: match.TeamIdAway };
    const reSelection = suggestStatsImportSelection(data, rows, fixed);
    applyStatsCsvImport(data, { rows, selection: reSelection, series: SERIES, matchId });
    expect(match.Labels).toEqual(['Week 3', 'Playoffs']);

    applyStatsCsvImport(data, {
      rows,
      selection: reSelection,
      series: SERIES,
      matchId,
      labels: [],
    });
    expect(match.Labels).toBeUndefined();
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
