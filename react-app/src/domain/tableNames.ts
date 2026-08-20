/** Entity table names in dodgeball scorekeeper `Data` (PascalCase keys). */
export const ENTITY_TABLE_NAMES = [
  'Deflection',
  'Game',
  'GameEvent',
  'GameEventError',
  'GameEventFinish',
  'GameEventNoBlocking',
  'GameEventStart',
  'GameEventThrow',
  'GamePlayer',
  'LeagueSettings',
  'Match',
  'MatchEvent',
  'MatchEventGame',
  'MatchPlayer',
  'Player',
  'Team',
  'TeamPlayer',
  'Throw',
] as const;

export type EntityTableName = (typeof ENTITY_TABLE_NAMES)[number];
