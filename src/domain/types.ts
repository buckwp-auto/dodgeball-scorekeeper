import type { ImageRef } from './imageRef';

export type Guid = string;

export type TeamRow = {
  Id: Guid;
  Name: string;
  Notes: string | null;
  Image?: ImageRef | null;
};

export type PlayerRow = {
  Id: Guid;
  Name: string;
  Notes: string | null;
  Image?: ImageRef | null;
  /** Created from Match/Game roster Add, not the team’s core roster. */
  AddedFromMatch?: boolean;
  /** Canonical league player this guest row represents (cross-team sub). */
  LinkedPlayerId?: Guid;
};

export type TeamPlayerRow = {
  Id: Guid;
  TeamId: Guid;
  PlayerId: Guid;
};

export type MatchRow = {
  Id: Guid;
  TeamIdHome: Guid;
  TeamIdAway: Guid;
  Notes: string | null;
  /** Optional YouTube watch/share URL for match VOD. */
  YoutubeUrl?: string | null;
  /** Cloud uid of the user who created the match (match scorer). */
  CreatedByUid?: string | null;
  /** True when the scorer recorded that the match has ended. */
  Ended?: boolean;
  /** Video offset (seconds) of the match-end log row, aligned with last game finish. */
  EndedVideoOffsetSeconds?: number | null;
  /** Match stats were imported from legacy CSV (no event log). */
  StatsImported?: boolean;
  /** User-entered game-series score when StatsImported. */
  ImportedHomeGameWins?: number;
  ImportedAwayGameWins?: number;
  ImportedGameTies?: number;
};

export type ImportedPlayerStatsRow = {
  Id: Guid;
  MatchId: Guid;
  PlayerId: Guid;
  /** JSON blob of aggregate stat maps (see importedMatchStats.ts). */
  AggregatesJson: string;
};

export type MatchPlayerRow = {
  Id: Guid;
  MatchId: Guid;
  PlayerId: Guid;
  TeamHome: boolean;
  /** Official bench/sub for this match (not a name suffix). */
  IsSubstitute?: boolean;
};

export type DatabaseDto = {
  Tables: Record<string, unknown[]>;
};

export type HistoryCommit = {
  message: string;
  timestamp: string;
};
