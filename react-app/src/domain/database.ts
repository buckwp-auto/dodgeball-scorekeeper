import { ENTITY_TABLE_NAMES } from './tableNames';
import { newIdTimestamp } from './id';
import type { DatabaseDto, Guid, MatchRow, PlayerRow, TeamPlayerRow, TeamRow } from './types';

export const STORAGE_KEY = 'SCOREKEEPER_DATA';

export function createEmptyDatabase(): DatabaseDto {
  return {
    Tables: Object.fromEntries(
      ENTITY_TABLE_NAMES.map((name) => [name, []]),
    ),
  };
}

export function normalizeDatabase(raw: unknown): DatabaseDto {
  if (typeof raw !== 'object' || raw === null || !('Tables' in raw)) {
    throw new Error('Invalid database JSON');
  }
  const tables = (raw as DatabaseDto).Tables;
  const merged = createEmptyDatabase();
  for (const name of ENTITY_TABLE_NAMES) {
    const rows = tables[name];
    merged.Tables[name] = Array.isArray(rows) ? structuredClone(rows) : [];
  }
  return merged;
}

export function serializeDatabase(data: DatabaseDto): string {
  return JSON.stringify(data);
}

export function loadFromSession(): DatabaseDto | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return normalizeDatabase(JSON.parse(raw));
}

export function saveToSession(data: DatabaseDto): void {
  sessionStorage.setItem(STORAGE_KEY, serializeDatabase(data));
}

function table<T>(data: DatabaseDto, name: string): T[] {
  return data.Tables[name] as T[];
}

function pushRow<T extends { Id: Guid }>(data: DatabaseDto, tableName: string, row: T): T {
  const rows = table<T>(data, tableName);
  rows.push(row);
  return row;
}

export function getTeams(data: DatabaseDto): TeamRow[] {
  return [...table<TeamRow>(data, 'Team')].sort(
    (a, b) => a.Name.localeCompare(b.Name) || a.Id.localeCompare(b.Id),
  );
}

export function getTeam(data: DatabaseDto, teamId: Guid): TeamRow | undefined {
  return table<TeamRow>(data, 'Team').find((team) => team.Id === teamId);
}

export function getPlayersForTeam(data: DatabaseDto, teamId: Guid): PlayerRow[] {
  const playerIds = new Set(
    table<TeamPlayerRow>(data, 'TeamPlayer')
      .filter((row) => row.TeamId === teamId)
      .map((row) => row.PlayerId),
  );
  return table<PlayerRow>(data, 'Player')
    .filter((player) => playerIds.has(player.Id))
    .sort((a, b) => a.Name.localeCompare(b.Name) || a.Id.localeCompare(b.Id));
}

export function getMatchName(data: DatabaseDto, match: MatchRow): string {
  const teams = table<TeamRow>(data, 'Team');
  const home = teams.find((team) => team.Id === match.TeamIdHome);
  const away = teams.find((team) => team.Id === match.TeamIdAway);
  if (!home || !away) return 'Match';
  return `${home.Name} vs. ${away.Name}`;
}

export function getMatches(data: DatabaseDto): { match: MatchRow; matchName: string }[] {
  return table<MatchRow>(data, 'Match')
    .map((match) => ({ match, matchName: getMatchName(data, match) }))
    .sort((a, b) => a.matchName.localeCompare(b.matchName));
}

export function addTeam(data: DatabaseDto, teamName: string): TeamRow {
  const name = teamName.trim();
  if (!name) throw new Error('Team name required');
  return pushRow(data, 'Team', {
    Id: newIdTimestamp(),
    Name: name,
    Notes: null,
  });
}

export function addPlayer(
  data: DatabaseDto,
  teamId: Guid,
  playerName: string,
): PlayerRow {
  const name = playerName.trim();
  if (!name) throw new Error('Player name required');
  const team = getTeam(data, teamId);
  if (!team) throw new Error('Team not found');
  const player = pushRow(data, 'Player', {
    Id: newIdTimestamp(),
    Name: name,
    Notes: null,
  });
  pushRow(data, 'TeamPlayer', {
    Id: newIdTimestamp(),
    TeamId: teamId,
    PlayerId: player.Id,
  });
  return player;
}

export function addMatch(
  data: DatabaseDto,
  teamIdHome: Guid,
  teamIdAway: Guid,
): MatchRow {
  const home = getTeam(data, teamIdHome);
  const away = getTeam(data, teamIdAway);
  if (!home || !away) throw new Error('Teams not found');
  const match = pushRow(data, 'Match', {
    Id: newIdTimestamp(),
    TeamIdHome: teamIdHome,
    TeamIdAway: teamIdAway,
    Notes: null,
  });
  return match;
}
