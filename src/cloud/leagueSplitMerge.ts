import { createEmptyDatabase } from '../domain/database';
import type { DatabaseDto, Guid } from '../domain/types';
import {
  MATCH_TABLES,
  ROSTER_TABLES,
  type MatchTableName,
  type RosterTableName,
} from './tablePartitions';
import type { MatchDoc, RosterDoc } from './leagueTypes';

function tableRows<T>(data: DatabaseDto, name: string): T[] {
  return (data.Tables[name] ?? []) as T[];
}

function pickTables<T extends string>(
  data: DatabaseDto,
  names: readonly T[],
): Record<T, unknown[]> {
  return Object.fromEntries(
    names.map((name) => [name, structuredClone(tableRows(data, name))]),
  ) as Record<T, unknown[]>;
}

export function extractRosterTables(
  data: DatabaseDto,
): Record<RosterTableName, unknown[]> {
  return pickTables(data, ROSTER_TABLES);
}

export function serializeRoster(data: DatabaseDto): string {
  return JSON.stringify(extractRosterTables(data));
}

/** Extract all match-scoped rows belonging to one match. */
export function extractMatchTables(
  data: DatabaseDto,
  matchId: Guid,
): Record<MatchTableName, unknown[]> {
  const match = tableRows<{ Id: Guid }>(data, 'Match').filter(
    (row) => row.Id === matchId,
  );
  const matchPlayers = tableRows<{ MatchId: Guid }>(data, 'MatchPlayer').filter(
    (row) => row.MatchId === matchId,
  );
  const matchEvents = tableRows<{ Id: Guid; MatchId: Guid }>(
    data,
    'MatchEvent',
  ).filter((row) => row.MatchId === matchId);
  const matchEventIds = new Set(matchEvents.map((row) => row.Id));
  const matchEventGames = tableRows<{ MatchEventId: Guid; GameId: Guid }>(
    data,
    'MatchEventGame',
  ).filter((row) => matchEventIds.has(row.MatchEventId));
  const gameIds = new Set(matchEventGames.map((row) => row.GameId));
  const games = tableRows<{ Id: Guid }>(data, 'Game').filter((row) =>
    gameIds.has(row.Id),
  );
  const gamePlayers = tableRows<{ GameId: Guid }>(data, 'GamePlayer').filter(
    (row) => gameIds.has(row.GameId),
  );
  const gameEvents = tableRows<{ Id: Guid; GameId: Guid }>(
    data,
    'GameEvent',
  ).filter((row) => gameIds.has(row.GameId));
  const gameEventIds = new Set(gameEvents.map((row) => row.Id));
  const gameEventThrows = tableRows<{ GameEventId: Guid }>(
    data,
    'GameEventThrow',
  ).filter((row) => gameEventIds.has(row.GameEventId));
  const gameEventErrors = tableRows<{ GameEventId: Guid }>(
    data,
    'GameEventError',
  ).filter((row) => gameEventIds.has(row.GameEventId));
  const gameEventNoBlocking = tableRows<{ GameEventId: Guid }>(
    data,
    'GameEventNoBlocking',
  ).filter((row) => gameEventIds.has(row.GameEventId));
  const gameEventFinishes = tableRows<{ GameEventId: Guid }>(
    data,
    'GameEventFinish',
  ).filter((row) => gameEventIds.has(row.GameEventId));
  const gameEventStarts = tableRows<{ GameEventId: Guid }>(
    data,
    'GameEventStart',
  ).filter((row) => gameEventIds.has(row.GameEventId));
  // Throw.GameEventThrowId references GameEvent.Id (legacy naming).
  const throws = tableRows<{ Id: Guid; GameEventThrowId: Guid }>(
    data,
    'Throw',
  ).filter((row) => gameEventIds.has(row.GameEventThrowId));
  const throwIds = new Set(throws.map((row) => row.Id));
  const deflections = tableRows<{ ThrowId: Guid }>(data, 'Deflection').filter(
    (row) => throwIds.has(row.ThrowId),
  );
  const importedPlayerStats = tableRows<{ MatchId: Guid }>(
    data,
    'ImportedPlayerStats',
  ).filter((row) => row.MatchId === matchId);

  return {
    Match: structuredClone(match),
    MatchPlayer: structuredClone(matchPlayers),
    MatchEvent: structuredClone(matchEvents),
    MatchEventGame: structuredClone(matchEventGames),
    Game: structuredClone(games),
    GamePlayer: structuredClone(gamePlayers),
    GameEvent: structuredClone(gameEvents),
    GameEventThrow: structuredClone(gameEventThrows),
    GameEventError: structuredClone(gameEventErrors),
    GameEventNoBlocking: structuredClone(gameEventNoBlocking),
    GameEventFinish: structuredClone(gameEventFinishes),
    GameEventStart: structuredClone(gameEventStarts),
    Throw: structuredClone(throws),
    Deflection: structuredClone(deflections),
    ImportedPlayerStats: structuredClone(importedPlayerStats),
  };
}

export function serializeMatch(data: DatabaseDto, matchId: Guid): string {
  return JSON.stringify(extractMatchTables(data, matchId));
}

export function listMatchIds(data: DatabaseDto): Guid[] {
  return tableRows<{ Id: Guid }>(data, 'Match').map((row) => row.Id);
}

export function splitDatabase(data: DatabaseDto): {
  roster: Record<RosterTableName, unknown[]>;
  matches: Record<Guid, Record<MatchTableName, unknown[]>>;
} {
  const matches: Record<Guid, Record<MatchTableName, unknown[]>> = {};
  for (const matchId of listMatchIds(data)) {
    matches[matchId] = extractMatchTables(data, matchId);
  }
  return {
    roster: extractRosterTables(data),
    matches,
  };
}

function appendTables(
  target: DatabaseDto,
  source: Record<string, unknown[]>,
): void {
  for (const [name, rows] of Object.entries(source)) {
    const existing = tableRows(target, name);
    existing.push(...structuredClone(rows));
    target.Tables[name] = existing;
  }
}

export function mergeLeagueDocuments(
  roster: RosterDoc | Record<RosterTableName, unknown[]>,
  matchDocs: Array<MatchDoc | Record<MatchTableName, unknown[]>>,
): DatabaseDto {
  const data = createEmptyDatabase();
  const rosterTables = 'tables' in roster ? roster.tables : roster;
  appendTables(data, rosterTables);
  for (const match of matchDocs) {
    const tables = 'tables' in match ? match.tables : match;
    appendTables(data, tables);
  }
  return data;
}

export type DirtyDiff = {
  roster: boolean;
  matchIds: Guid[];
  /** Match ids present in `next` but not `prev` (also included in matchIds). */
  addedMatchIds: Guid[];
  /** Match ids present in `prev` but not `next`. */
  removedMatchIds: Guid[];
};

export function diffDirty(
  prev: DatabaseDto,
  next: DatabaseDto,
): DirtyDiff {
  const roster = serializeRoster(prev) !== serializeRoster(next);
  const prevIds = new Set(listMatchIds(prev));
  const nextIds = new Set(listMatchIds(next));
  const addedMatchIds = [...nextIds].filter((id) => !prevIds.has(id));
  const removedMatchIds = [...prevIds].filter((id) => !nextIds.has(id));
  const matchIds = new Set<Guid>([...addedMatchIds, ...removedMatchIds]);
  for (const id of nextIds) {
    if (prevIds.has(id) && serializeMatch(prev, id) !== serializeMatch(next, id)) {
      matchIds.add(id);
    }
  }
  return {
    roster,
    matchIds: [...matchIds],
    addedMatchIds,
    removedMatchIds,
  };
}

/** True if `next` gained a finish event that `prev` did not have. */
export function gainedGameFinish(
  prev: DatabaseDto,
  next: DatabaseDto,
): boolean {
  const prevFinishes = new Set(
    tableRows<{ GameEventId: Guid }>(prev, 'GameEventFinish').map(
      (row) => row.GameEventId,
    ),
  );
  return tableRows<{ GameEventId: Guid }>(next, 'GameEventFinish').some(
    (row) => !prevFinishes.has(row.GameEventId),
  );
}

export function emptyMatchTables(): Record<MatchTableName, unknown[]> {
  return Object.fromEntries(MATCH_TABLES.map((name) => [name, []])) as unknown as Record<
    MatchTableName,
    unknown[]
  >;
}

export function emptyRosterTables(): Record<RosterTableName, unknown[]> {
  return Object.fromEntries(ROSTER_TABLES.map((name) => [name, []])) as unknown as Record<
    RosterTableName,
    unknown[]
  >;
}

export function matchIdForGame(data: DatabaseDto, gameId: Guid): Guid | null {
  const link = tableRows<{ MatchEventId: Guid; GameId: Guid }>(
    data,
    'MatchEventGame',
  ).find((row) => row.GameId === gameId);
  if (!link) return null;
  const matchEvent = tableRows<{ Id: Guid; MatchId: Guid }>(
    data,
    'MatchEvent',
  ).find((row) => row.Id === link.MatchEventId);
  return matchEvent?.MatchId ?? null;
}
