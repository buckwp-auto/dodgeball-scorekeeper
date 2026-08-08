import type { EntityTableName } from '../domain/tableNames';

/** League-wide tables stored on `leagues/{id}/roster/current`. */
export const ROSTER_TABLES = [
  'Team',
  'Player',
  'TeamPlayer',
  'LeagueSettings',
] as const satisfies readonly EntityTableName[];

/** Match-scoped tables stored on `leagues/{id}/matches/{matchId}`. */
export const MATCH_TABLES = [
  'Match',
  'MatchPlayer',
  'MatchEvent',
  'MatchEventGame',
  'Game',
  'GamePlayer',
  'GameEvent',
  'GameEventError',
  'GameEventFinish',
  'GameEventStart',
  'GameEventThrow',
  'Throw',
  'Deflection',
] as const satisfies readonly EntityTableName[];

export type RosterTableName = (typeof ROSTER_TABLES)[number];
export type MatchTableName = (typeof MATCH_TABLES)[number];
