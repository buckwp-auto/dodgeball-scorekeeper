export type Guid = string;

export type TeamRow = {
  Id: Guid;
  Name: string;
  Notes: string | null;
};

export type PlayerRow = {
  Id: Guid;
  Name: string;
  Notes: string | null;
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
};

export type MatchPlayerRow = {
  Id: Guid;
  MatchId: Guid;
  PlayerId: Guid;
  TeamHome: boolean;
};

export type DatabaseDto = {
  Tables: Record<string, unknown[]>;
};

export type HistoryCommit = {
  message: string;
  timestamp: string;
};
