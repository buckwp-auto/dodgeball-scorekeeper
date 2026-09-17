import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  MAX_AUTH_UID,
  MAX_DISPLAY_NAME,
  MAX_EMAIL,
  assertMaxLength,
  clampName,
} from '../domain/limits';
import { appendRateLimitToBatch } from './leagueApi';
import type { AppAdminRecord, AppRole, AppUserProfile } from './appRoleTypes';

function parseAppRole(value: unknown): AppRole | null {
  if (value === 'superAdmin' || value === 'appAdmin') return value;
  return null;
}

function parseAppAdmin(uid: string, data: unknown): AppAdminRecord | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const role = parseAppRole(row.role);
  if (!role) return null;
  return {
    uid,
    role,
    email: String(row.email ?? ''),
    displayName: String(row.displayName ?? ''),
    grantedAt: String(row.grantedAt ?? ''),
    grantedBy: String(row.grantedBy ?? ''),
  };
}

export async function upsertUserProfile(
  db: Firestore,
  user: User,
): Promise<void> {
  const email = clampName(user.email ?? '', MAX_EMAIL);
  const displayName = clampName(
    user.displayName ?? user.email ?? 'User',
    MAX_DISPLAY_NAME,
  );
  await setDoc(doc(db, 'users', user.uid), {
    email,
    displayName,
    lastSeenAt: new Date().toISOString(),
  });
}

export async function getAppRole(
  db: Firestore,
  uid: string,
): Promise<AppAdminRecord | null> {
  const snap = await getDoc(doc(db, 'appAdmins', uid));
  if (!snap.exists()) return null;
  return parseAppAdmin(uid, snap.data());
}

export async function listAppAdmins(db: Firestore): Promise<AppAdminRecord[]> {
  const snap = await getDocs(collection(db, 'appAdmins'));
  return snap.docs
    .map((row) => parseAppAdmin(row.id, row.data()))
    .filter((row): row is AppAdminRecord => row !== null)
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName) ||
        a.email.localeCompare(b.email) ||
        a.uid.localeCompare(b.uid),
    );
}

export async function listUsers(db: Firestore): Promise<AppUserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map((row) => {
      const data = row.data();
      return {
        uid: row.id,
        email: String(data.email ?? ''),
        displayName: String(data.displayName ?? ''),
        lastSeenAt: String(data.lastSeenAt ?? ''),
      } satisfies AppUserProfile;
    })
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName) ||
        a.email.localeCompare(b.email) ||
        a.uid.localeCompare(b.uid),
    );
}

export async function grantAppAdmin(
  db: Firestore,
  actor: User,
  target: { uid: string; email: string; displayName: string },
): Promise<void> {
  const uid = target.uid.trim();
  assertMaxLength(uid, MAX_AUTH_UID, 'User id');
  if (!uid) throw new Error('User id required');
  if (uid === actor.uid) throw new Error('You cannot grant app admin to yourself');

  const existing = await getAppRole(db, uid);
  if (existing) {
    throw new Error(
      existing.role === 'superAdmin'
        ? 'That user is already a super admin'
        : 'That user is already an app admin',
    );
  }

  const email = clampName(target.email, MAX_EMAIL);
  const displayName = clampName(
    target.displayName || target.email || 'App admin',
    MAX_DISPLAY_NAME,
  );
  const batch = writeBatch(db);
  await appendRateLimitToBatch(db, batch, actor.uid);
  batch.set(doc(db, 'appAdmins', uid), {
    role: 'appAdmin',
    email,
    displayName,
    grantedAt: new Date().toISOString(),
    grantedBy: actor.uid,
  });
  await batch.commit();
}

export async function revokeAppAdmin(
  db: Firestore,
  actor: User,
  uid: string,
): Promise<void> {
  const targetUid = uid.trim();
  if (!targetUid) throw new Error('User id required');
  if (targetUid === actor.uid) {
    throw new Error('You cannot remove your own operator role');
  }
  const existing = await getAppRole(db, targetUid);
  if (!existing) throw new Error('That user is not an app admin');
  if (existing.role === 'superAdmin') {
    throw new Error('Super admin can only be changed from the Firebase console');
  }

  const batch = writeBatch(db);
  await appendRateLimitToBatch(db, batch, actor.uid);
  batch.delete(doc(db, 'appAdmins', targetUid));
  await batch.commit();
}
