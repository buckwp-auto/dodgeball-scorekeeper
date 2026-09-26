import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  MAX_AUTH_UID,
  MAX_VIEWER_ALLOWED_LEAGUES,
  assertMaxLength,
} from '../domain/limits';
import { appendRateLimitToBatch } from './leagueApi';
import type { ViewerRestriction } from './viewerRestrictionTypes';

function parseViewerRestriction(
  uid: string,
  data: unknown,
): ViewerRestriction | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const allowedRaw = row.allowedLeagueIds;
  const allowedLeagueIds = Array.isArray(allowedRaw)
    ? allowedRaw.map((id) => String(id)).filter(Boolean)
    : [];
  return {
    uid,
    banned: Boolean(row.banned),
    allowedLeagueIds,
    updatedAt: String(row.updatedAt ?? ''),
    updatedBy: String(row.updatedBy ?? ''),
  };
}

export async function getViewerRestriction(
  db: Firestore,
  uid: string,
): Promise<ViewerRestriction | null> {
  const snap = await getDoc(doc(db, 'viewerRestrictions', uid));
  if (!snap.exists()) return null;
  return parseViewerRestriction(uid, snap.data());
}

export async function listViewerRestrictions(
  db: Firestore,
): Promise<ViewerRestriction[]> {
  const snap = await getDocs(collection(db, 'viewerRestrictions'));
  return snap.docs
    .map((row) => parseViewerRestriction(row.id, row.data()))
    .filter((row): row is ViewerRestriction => row !== null)
    .sort((a, b) => a.uid.localeCompare(b.uid));
}

function normalizeAllowedLeagueIds(ids: string[]): string[] {
  const unique = [
    ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
  ];
  if (unique.length > MAX_VIEWER_ALLOWED_LEAGUES) {
    throw new Error(
      `At most ${MAX_VIEWER_ALLOWED_LEAGUES} leagues can be allowlisted`,
    );
  }
  for (const id of unique) {
    assertMaxLength(id, MAX_AUTH_UID, 'League id');
  }
  return unique;
}

export async function setViewerRestriction(
  db: Firestore,
  actor: User,
  uid: string,
  options: { banned: boolean; allowedLeagueIds: string[] },
): Promise<void> {
  const targetUid = uid.trim();
  assertMaxLength(targetUid, MAX_AUTH_UID, 'User id');
  if (!targetUid) throw new Error('User id required');

  const allowedLeagueIds = normalizeAllowedLeagueIds(options.allowedLeagueIds);
  const batch = writeBatch(db);
  await appendRateLimitToBatch(db, batch, actor.uid);
  batch.set(doc(db, 'viewerRestrictions', targetUid), {
    banned: Boolean(options.banned),
    allowedLeagueIds,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.uid,
  });
  await batch.commit();
}

export async function clearViewerRestriction(
  db: Firestore,
  actor: User,
  uid: string,
): Promise<void> {
  const targetUid = uid.trim();
  if (!targetUid) throw new Error('User id required');
  const batch = writeBatch(db);
  await appendRateLimitToBatch(db, batch, actor.uid);
  batch.delete(doc(db, 'viewerRestrictions', targetUid));
  await batch.commit();
}

export async function setViewerBanned(
  db: Firestore,
  actor: User,
  uid: string,
  banned: boolean,
): Promise<void> {
  const existing = await getViewerRestriction(db, uid);
  await setViewerRestriction(db, actor, uid, {
    banned,
    allowedLeagueIds: existing?.allowedLeagueIds ?? [],
  });
}

export async function setViewerAllowedLeagueIds(
  db: Firestore,
  actor: User,
  uid: string,
  allowedLeagueIds: string[],
): Promise<void> {
  const existing = await getViewerRestriction(db, uid);
  await setViewerRestriction(db, actor, uid, {
    banned: existing?.banned ?? false,
    allowedLeagueIds,
  });
}
