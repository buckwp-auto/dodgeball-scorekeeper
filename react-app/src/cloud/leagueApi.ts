import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  MAX_DISPLAY_NAME,
  MAX_EMAIL,
  MAX_LEAGUE_NAME,
  WRITES_PER_HOUR,
  assertMaxLength,
  clampName,
} from '../domain/limits';
import type { DatabaseDto, Guid } from '../domain/types';
import { newIdTimestamp } from '../domain/id';
import { QuotaExceededError } from './errors';
import {
  emptyRosterTables,
  extractMatchTables,
  extractRosterTables,
  mergeLeagueDocuments,
} from './leagueSplitMerge';
import type {
  CloudRevisions,
  LeagueMember,
  LeagueMeta,
  MatchDoc,
  MemberStatus,
  RosterDoc,
} from './leagueTypes';

function hourBucketKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}${m}${d}${h}`;
}

function rateLimitRef(db: Firestore, uid: string) {
  return doc(db, 'rateLimits', uid, 'hours', hourBucketKey());
}

/** Increment hourly write counter in a batch; throws if quota exceeded. */
export async function appendRateLimitToBatch(
  db: Firestore,
  batch: WriteBatch,
  uid: string,
): Promise<void> {
  const ref = rateLimitRef(db, uid);
  const snap = await getDoc(ref);
  const count = snap.exists() ? Number(snap.data().count ?? 0) : 0;
  if (count >= WRITES_PER_HOUR) {
    throw new QuotaExceededError();
  }
  batch.set(ref, {
    count: count + 1,
    updatedAt: new Date().toISOString(),
  });
}

export async function listLeagues(db: Firestore): Promise<LeagueMeta[]> {
  const snap = await getDocs(collection(db, 'leagues'));
  return snap.docs
    .map((row) => {
      const data = row.data();
      return {
        id: row.id,
        name: String(data.name ?? ''),
        createdAt: String(data.createdAt ?? ''),
        adminUid: String(data.adminUid ?? ''),
        adminDisplayName: String(data.adminDisplayName ?? ''),
        adminEmail: String(data.adminEmail ?? ''),
      } satisfies LeagueMeta;
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export async function getMembership(
  db: Firestore,
  leagueId: string,
  uid: string,
): Promise<LeagueMember | null> {
  const snap = await getDoc(doc(db, 'leagues', leagueId, 'members', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? ''),
    role: data.role === 'admin' ? 'admin' : 'member',
    status: normalizeStatus(data.status),
    requestedAt: String(data.requestedAt ?? ''),
    joinedAt: data.joinedAt ? String(data.joinedAt) : null,
  };
}

function normalizeStatus(value: unknown): MemberStatus {
  if (value === 'active' || value === 'rejected' || value === 'pending') {
    return value;
  }
  return 'pending';
}

export async function listMembers(
  db: Firestore,
  leagueId: string,
): Promise<LeagueMember[]> {
  const snap = await getDocs(collection(db, 'leagues', leagueId, 'members'));
  return snap.docs.map((row) => {
    const data = row.data();
    return {
      uid: row.id,
      email: String(data.email ?? ''),
      displayName: String(data.displayName ?? ''),
      role: data.role === 'admin' ? 'admin' : 'member',
      status: normalizeStatus(data.status),
      requestedAt: String(data.requestedAt ?? ''),
      joinedAt: data.joinedAt ? String(data.joinedAt) : null,
    } satisfies LeagueMember;
  });
}

export async function createLeague(
  db: Firestore,
  user: User,
  name: string,
): Promise<string> {
  const trimmed = clampName(name, MAX_LEAGUE_NAME);
  assertMaxLength(trimmed, MAX_LEAGUE_NAME, 'League name');
  if (!trimmed) throw new Error('League name required');

  const leagueId = newIdTimestamp();
  const now = new Date().toISOString();
  const displayName = clampName(
    user.displayName ?? user.email ?? 'Admin',
    MAX_DISPLAY_NAME,
  );
  const email = clampName(user.email ?? '', MAX_EMAIL);

  const batch = writeBatch(db);
  await appendRateLimitToBatch(db, batch, user.uid);

  batch.set(doc(db, 'leagues', leagueId), {
    name: trimmed,
    createdAt: now,
    adminUid: user.uid,
    adminDisplayName: displayName,
    adminEmail: email,
  });
  batch.set(doc(db, 'leagues', leagueId, 'members', user.uid), {
    email,
    displayName,
    role: 'admin',
    status: 'active',
    requestedAt: now,
    joinedAt: now,
  });
  batch.set(doc(db, 'leagues', leagueId, 'roster', 'current'), {
    tables: emptyRosterTables(),
    updatedAt: now,
    revision: 0,
  });
  await batch.commit();
  return leagueId;
}

export async function requestJoinLeague(
  db: Firestore,
  user: User,
  leagueId: string,
): Promise<void> {
  const existing = await getMembership(db, leagueId, user.uid);
  if (existing?.status === 'active' || existing?.status === 'pending') {
    return;
  }

  const now = new Date().toISOString();
  const displayName = clampName(
    user.displayName ?? user.email ?? 'Player',
    MAX_DISPLAY_NAME,
  );
  const email = clampName(user.email ?? '', MAX_EMAIL);

  const batch = writeBatch(db);
  await appendRateLimitToBatch(db, batch, user.uid);
  batch.set(doc(db, 'leagues', leagueId, 'members', user.uid), {
    email,
    displayName,
    role: 'member',
    status: 'pending',
    requestedAt: now,
    joinedAt: null,
  });
  await batch.commit();
}

export async function setMemberStatus(
  db: Firestore,
  admin: User,
  leagueId: string,
  memberUid: string,
  status: 'active' | 'rejected',
): Promise<void> {
  const batch = writeBatch(db);
  await appendRateLimitToBatch(db, batch, admin.uid);
  const ref = doc(db, 'leagues', leagueId, 'members', memberUid);
  batch.update(ref, {
    status,
    joinedAt: status === 'active' ? new Date().toISOString() : null,
  });
  await batch.commit();
}

export async function loadLeagueDatabase(
  db: Firestore,
  leagueId: string,
): Promise<{ data: DatabaseDto; revisions: CloudRevisions }> {
  const rosterSnap = await getDoc(
    doc(db, 'leagues', leagueId, 'roster', 'current'),
  );
  const rosterData = rosterSnap.exists()
    ? (rosterSnap.data() as RosterDoc)
    : {
        tables: emptyRosterTables(),
        updatedAt: new Date().toISOString(),
        revision: 0,
      };

  const matchesSnap = await getDocs(
    collection(db, 'leagues', leagueId, 'matches'),
  );
  const matchDocs: MatchDoc[] = [];
  const matchRevisions: Record<Guid, number> = {};
  for (const row of matchesSnap.docs) {
    const data = row.data() as MatchDoc;
    matchDocs.push(data);
    matchRevisions[row.id] = Number(data.revision ?? 0);
  }

  return {
    data: mergeLeagueDocuments(rosterData, matchDocs),
    revisions: {
      rosterRevision: Number(rosterData.revision ?? 0),
      matchRevisions,
    },
  };
}

export type FlushPlan = {
  roster: boolean;
  matchIds: Guid[];
  removedMatchIds: Guid[];
};

export async function flushLeagueChanges(
  db: Firestore,
  user: User,
  leagueId: string,
  data: DatabaseDto,
  plan: FlushPlan,
  expected: CloudRevisions,
): Promise<CloudRevisions> {
  if (
    !plan.roster &&
    plan.matchIds.length === 0 &&
    plan.removedMatchIds.length === 0
  ) {
    return expected;
  }

  const batch = writeBatch(db);
  await appendRateLimitToBatch(db, batch, user.uid);
  const now = new Date().toISOString();
  const next: CloudRevisions = {
    rosterRevision: expected.rosterRevision,
    matchRevisions: { ...expected.matchRevisions },
  };

  if (plan.roster) {
    const revision = expected.rosterRevision + 1;
    batch.set(doc(db, 'leagues', leagueId, 'roster', 'current'), {
      tables: extractRosterTables(data),
      updatedAt: now,
      revision,
    } satisfies RosterDoc);
    next.rosterRevision = revision;
  }

  for (const matchId of plan.matchIds) {
    const revision = (expected.matchRevisions[matchId] ?? 0) + 1;
    batch.set(doc(db, 'leagues', leagueId, 'matches', matchId), {
      tables: extractMatchTables(data, matchId),
      updatedAt: now,
      revision,
      updatedByUid: user.uid,
    } satisfies MatchDoc);
    next.matchRevisions[matchId] = revision;
  }

  for (const matchId of plan.removedMatchIds) {
    batch.delete(doc(db, 'leagues', leagueId, 'matches', matchId));
    delete next.matchRevisions[matchId];
  }

  await batch.commit();
  return next;
}
