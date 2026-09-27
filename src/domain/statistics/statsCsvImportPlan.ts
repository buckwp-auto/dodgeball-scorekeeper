import { addMatch, addTeam, getPlayer, getPlayersForTeam, getTeam, getTeams } from '../database';
import { matchHasGameEvents } from '../importedMatch';
import {
  addPlayerToMatchSide,
  getMatchById,
  isPlayerInMatch,
  toggleMatchPlayer,
} from '../matchGame';
import type { DatabaseDto, Guid, PlayerRow, TeamRow } from '../types';
import {
  addImportedPlayerStats,
  applySeriesToMatch,
  clearImportedStatsForMatch,
  validateImportMatchSeriesInput,
  type ImportMatchSeriesInput,
} from './importedMatchStats';
import { normalizeImportName, type StatsCsvRow } from './statsCsvCommon';
import { getCsvTeamNames } from './statsCsvImport';

export type ImportTeamChoice =
  | { kind: 'existing'; teamId: Guid }
  | { kind: 'create'; name: string };

export type ImportPlayerChoice =
  | { kind: 'existing'; playerId: Guid }
  | { kind: 'create' }
  | { kind: 'skip' };

export type ImportSideKey = 'home' | 'away';

export type StatsImportSide = {
  csvTeamName: string;
  team: ImportTeamChoice;
};

export type StatsImportSelection = {
  home: StatsImportSide;
  away: StatsImportSide;
  /** Index-aligned with the parsed CSV rows. */
  players: ImportPlayerChoice[];
};

/** Existing match teams; the uploader can only swap which CSV team maps to which side. */
export type FixedImportTeams = { homeTeamId: Guid; awayTeamId: Guid };

export function findTeamByImportName(data: DatabaseDto, name: string): TeamRow | undefined {
  const key = normalizeImportName(name);
  return getTeams(data).find((team) => normalizeImportName(team.Name) === key);
}

export function findPlayerByImportName(
  data: DatabaseDto,
  teamId: Guid,
  name: string,
): PlayerRow | undefined {
  const key = normalizeImportName(name);
  return getPlayersForTeam(data, teamId).find(
    (player) => normalizeImportName(player.Name) === key,
  );
}

export function rowImportSide(
  selection: StatsImportSelection,
  row: StatsCsvRow,
): ImportSideKey {
  return normalizeImportName(row.teamName) === normalizeImportName(selection.home.csvTeamName)
    ? 'home'
    : 'away';
}

function suggestPlayerChoice(
  data: DatabaseDto,
  team: ImportTeamChoice,
  playerName: string,
): ImportPlayerChoice {
  if (team.kind !== 'existing') return { kind: 'create' };
  const player = findPlayerByImportName(data, team.teamId, playerName);
  return player ? { kind: 'existing', playerId: player.Id } : { kind: 'create' };
}

function resuggestPlayers(
  data: DatabaseDto,
  rows: StatsCsvRow[],
  selection: Omit<StatsImportSelection, 'players'>,
  previous?: StatsImportSelection,
  onlySide?: ImportSideKey,
): ImportPlayerChoice[] {
  const withSides = { ...selection, players: [] };
  return rows.map((row, index) => {
    const side = rowImportSide(withSides, row);
    if (onlySide && side !== onlySide && previous) return previous.players[index];
    return suggestPlayerChoice(data, selection[side].team, row.playerName);
  });
}

function teamChoiceFor(data: DatabaseDto, csvTeamName: string): ImportTeamChoice {
  const team = findTeamByImportName(data, csvTeamName);
  return team ? { kind: 'existing', teamId: team.Id } : { kind: 'create', name: csvTeamName };
}

export function suggestStatsImportSelection(
  data: DatabaseDto,
  rows: StatsCsvRow[],
  fixed?: FixedImportTeams | null,
): StatsImportSelection {
  const teamNames = getCsvTeamNames(rows);
  if (teamNames.length !== 2) {
    throw new Error(
      `The CSV lists ${teamNames.length} team${teamNames.length === 1 ? '' : 's'} (${teamNames.join(', ')}); a match needs exactly two`,
    );
  }
  let [homeName, awayName] = teamNames;
  let sides: Omit<StatsImportSelection, 'players'>;
  if (fixed) {
    const first = findTeamByImportName(data, homeName)?.Id;
    const second = findTeamByImportName(data, awayName)?.Id;
    if (first === fixed.awayTeamId || second === fixed.homeTeamId) {
      [homeName, awayName] = [awayName, homeName];
    }
    sides = {
      home: { csvTeamName: homeName, team: { kind: 'existing', teamId: fixed.homeTeamId } },
      away: { csvTeamName: awayName, team: { kind: 'existing', teamId: fixed.awayTeamId } },
    };
  } else {
    sides = {
      home: { csvTeamName: homeName, team: teamChoiceFor(data, homeName) },
      away: { csvTeamName: awayName, team: teamChoiceFor(data, awayName) },
    };
  }
  return { ...sides, players: resuggestPlayers(data, rows, sides) };
}

/** Swap home/away. With fixed teams the match sides stay put and the CSV teams trade places. */
export function swapImportSides(
  data: DatabaseDto,
  rows: StatsCsvRow[],
  selection: StatsImportSelection,
  fixed?: FixedImportTeams | null,
): StatsImportSelection {
  if (!fixed) {
    return { ...selection, home: selection.away, away: selection.home };
  }
  const sides = {
    home: { ...selection.home, csvTeamName: selection.away.csvTeamName },
    away: { ...selection.away, csvTeamName: selection.home.csvTeamName },
  };
  return { ...sides, players: resuggestPlayers(data, rows, sides) };
}

export function setImportSideTeam(
  data: DatabaseDto,
  rows: StatsCsvRow[],
  selection: StatsImportSelection,
  side: ImportSideKey,
  team: ImportTeamChoice,
): StatsImportSelection {
  const sides = {
    home: side === 'home' ? { ...selection.home, team } : selection.home,
    away: side === 'away' ? { ...selection.away, team } : selection.away,
  };
  return { ...sides, players: resuggestPlayers(data, rows, sides, selection, side) };
}

export function setImportPlayerChoice(
  selection: StatsImportSelection,
  rowIndex: number,
  choice: ImportPlayerChoice,
): StatsImportSelection {
  const players = [...selection.players];
  players[rowIndex] = choice;
  return { ...selection, players };
}

export type StatsImportReview = {
  /** Problems that block the import. */
  errors: string[];
  /** CSV team names with no league team of that name. */
  unmatchedTeams: string[];
  /** Rows whose player name did not match anyone on the chosen team. */
  unmatchedPlayerRows: number[];
  newTeamNames: string[];
  newPlayerNames: string[];
  skippedPlayerNames: string[];
};

export function reviewStatsImport(
  data: DatabaseDto,
  rows: StatsCsvRow[],
  selection: StatsImportSelection,
): StatsImportReview {
  const errors: string[] = [];
  const unmatchedTeams: string[] = [];
  const newTeamNames: string[] = [];
  for (const side of [selection.home, selection.away]) {
    if (side.team.kind === 'create') {
      newTeamNames.push(side.team.name);
      if (!side.team.name.trim()) errors.push('New team name is required');
    }
    const matchedId =
      side.team.kind === 'existing' ? side.team.teamId : null;
    const byName = findTeamByImportName(data, side.csvTeamName);
    if (!byName || byName.Id !== matchedId) unmatchedTeams.push(side.csvTeamName);
  }
  const { home, away } = selection;
  if (
    home.team.kind === 'existing' &&
    away.team.kind === 'existing' &&
    home.team.teamId === away.team.teamId
  ) {
    errors.push('Home and away must be different teams');
  }
  if (
    home.team.kind === 'create' &&
    away.team.kind === 'create' &&
    normalizeImportName(home.team.name) === normalizeImportName(away.team.name)
  ) {
    errors.push('Home and away must be different teams');
  }

  const unmatchedPlayerRows: number[] = [];
  const newPlayerNames: string[] = [];
  const skippedPlayerNames: string[] = [];
  const usedPlayers = new Map<Guid, string>();
  rows.forEach((row, index) => {
    const team = selection[rowImportSide(selection, row)].team;
    const autoMatch =
      team.kind === 'existing' ? findPlayerByImportName(data, team.teamId, row.playerName) : null;
    if (!autoMatch) unmatchedPlayerRows.push(index);
    const choice = selection.players[index] ?? { kind: 'create' };
    if (choice.kind === 'create') newPlayerNames.push(row.playerName);
    if (choice.kind === 'skip') skippedPlayerNames.push(row.playerName);
    if (choice.kind === 'existing') {
      const earlier = usedPlayers.get(choice.playerId);
      if (earlier) {
        const name = getPlayer(data, choice.playerId)?.Name ?? 'the same player';
        errors.push(`"${earlier}" and "${row.playerName}" are both mapped to ${name}`);
      }
      usedPlayers.set(choice.playerId, row.playerName);
    }
  });
  if (skippedPlayerNames.length === rows.length) {
    errors.push('Every player row is skipped');
  }

  return {
    errors,
    unmatchedTeams,
    unmatchedPlayerRows,
    newTeamNames,
    newPlayerNames,
    skippedPlayerNames,
  };
}

export type ApplyStatsImportInput = {
  rows: StatsCsvRow[];
  selection: StatsImportSelection;
  series: ImportMatchSeriesInput;
  /** Import into this match; omit to create a new match. */
  matchId?: Guid;
  createdByUid?: string | null;
};

export type ApplyStatsImportResult = {
  matchId: Guid;
  playersImported: number;
  playersCreated: number;
  teamsCreated: number;
};

function resolveTeamId(data: DatabaseDto, choice: ImportTeamChoice): { id: Guid; created: boolean } {
  if (choice.kind === 'existing') {
    if (!getTeam(data, choice.teamId)) throw new Error('Selected team not found');
    return { id: choice.teamId, created: false };
  }
  return { id: addTeam(data, choice.name).Id, created: true };
}

export function applyStatsCsvImport(
  data: DatabaseDto,
  input: ApplyStatsImportInput,
): ApplyStatsImportResult {
  const { rows, selection, series } = input;
  validateImportMatchSeriesInput(series);
  const review = reviewStatsImport(data, rows, selection);
  if (review.errors.length > 0) throw new Error(review.errors[0]);

  if (input.matchId) {
    const match = getMatchById(data, input.matchId);
    if (!match) throw new Error('Match not found');
    if (matchHasGameEvents(data, input.matchId)) {
      throw new Error('Cannot import statistics into a match that already has tracked events');
    }
    if (
      selection.home.team.kind !== 'existing' ||
      selection.away.team.kind !== 'existing' ||
      selection.home.team.teamId !== match.TeamIdHome ||
      selection.away.team.teamId !== match.TeamIdAway
    ) {
      throw new Error("Import teams must be this match's home and away teams");
    }
  }

  const home = resolveTeamId(data, selection.home.team);
  const away = resolveTeamId(data, selection.away.team);
  const matchId = input.matchId ?? addMatch(data, home.id, away.id, input.createdByUid).Id;

  clearImportedStatsForMatch(data, matchId);
  let playersImported = 0;
  let playersCreated = 0;
  rows.forEach((row, index) => {
    const choice = selection.players[index] ?? { kind: 'create' };
    if (choice.kind === 'skip') return;
    const teamHome = rowImportSide(selection, row) === 'home';
    let playerId: Guid;
    if (choice.kind === 'existing') {
      playerId = choice.playerId;
      if (!isPlayerInMatch(data, matchId, playerId)) {
        toggleMatchPlayer(data, matchId, playerId, teamHome);
      }
    } else {
      playerId = addPlayerToMatchSide(data, matchId, teamHome, row.playerName).Id;
      playersCreated += 1;
    }
    addImportedPlayerStats(data, matchId, playerId, row.aggregates);
    playersImported += 1;
  });
  applySeriesToMatch(data, matchId, series);

  return {
    matchId,
    playersImported,
    playersCreated,
    teamsCreated: Number(home.created) + Number(away.created),
  };
}
