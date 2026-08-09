import type { ImageRef } from '../domain/imageRef';
import type { Guid } from '../domain/types';
import type { MatchTableName, RosterTableName } from './tablePartitions';

export type MemberRole = 'admin' | 'member';
export type MemberStatus = 'pending' | 'active' | 'rejected';

export type LeagueMeta = {
  id: string;
  name: string;
  createdAt: string;
  adminUid: string;
  adminDisplayName: string;
  adminEmail: string;
  logo?: ImageRef | null;
  banner?: ImageRef | null;
};

export type LeagueMember = {
  uid: string;
  email: string;
  displayName: string;
  role: MemberRole;
  status: MemberStatus;
  requestedAt: string;
  joinedAt: string | null;
};

export type RosterDoc = {
  tables: Record<RosterTableName, unknown[]>;
  updatedAt: string;
  revision: number;
};

export type MatchDoc = {
  tables: Record<MatchTableName, unknown[]>;
  updatedAt: string;
  revision: number;
  updatedByUid: string;
};

export type SyncStatus =
  | 'local'
  | 'need-auth'
  | 'unsaved'
  | 'saving'
  | 'saved'
  | 'quota'
  | 'error';

export type CloudRevisions = {
  rosterRevision: number;
  matchRevisions: Record<Guid, number>;
};

export type DirtyState = {
  roster: boolean;
  matchIds: Set<Guid>;
};
