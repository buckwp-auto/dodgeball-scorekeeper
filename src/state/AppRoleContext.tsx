import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Firestore } from 'firebase/firestore';
import type { AppAdminRecord, AppRole, AppUserProfile } from '../cloud/appRoleTypes';
import type { ViewerRestriction } from '../cloud/viewerRestrictionTypes';
import { isAppAdminRole, isSuperAdminRole } from '../domain/appRoles';
import { useAuth } from './AuthContext';

type AppRoleContextValue = {
  role: AppRole | null;
  isAppAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  refreshRole: () => Promise<void>;
  listAppAdmins: () => Promise<AppAdminRecord[]>;
  listUsers: () => Promise<AppUserProfile[]>;
  grantAppAdmin: (target: {
    uid: string;
    email: string;
    displayName: string;
  }) => Promise<void>;
  revokeAppAdmin: (uid: string) => Promise<void>;
  getMyViewerRestriction: () => Promise<ViewerRestriction | null>;
  listViewerRestrictions: () => Promise<ViewerRestriction[]>;
  setViewerBanned: (uid: string, banned: boolean) => Promise<void>;
  setViewerAllowedLeagueIds: (
    uid: string,
    allowedLeagueIds: string[],
  ) => Promise<void>;
  clearViewerRestriction: (uid: string) => Promise<void>;
};

const AppRoleContext = createContext<AppRoleContextValue | null>(null);

type AppRoleApi = typeof import('../cloud/appRoleApi');
type ViewerRestrictionApi = typeof import('../cloud/viewerRestrictionApi');

async function loadCloud(): Promise<{
  db: Firestore;
  api: AppRoleApi;
  viewerApi: ViewerRestrictionApi;
} | null> {
  const [{ getDb }, api, viewerApi] = await Promise.all([
    import('../cloud/firestoreDb'),
    import('../cloud/appRoleApi'),
    import('../cloud/viewerRestrictionApi'),
  ]);
  const db = getDb();
  return db ? { db, api, viewerApi } : null;
}

export function AppRoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);

  const refreshRole = useCallback(async () => {
    if (!user) {
      setRole(null);
      setLoadedUid(null);
      return;
    }
    try {
      const cloud = await loadCloud();
      if (!cloud) {
        setRole(null);
        setLoadedUid(user.uid);
        return;
      }
      try {
        await cloud.api.upsertUserProfile(cloud.db, user);
      } catch (error) {
        console.error('upsert user profile failed', error);
      }
      const record = await cloud.api.getAppRole(cloud.db, user.uid);
      setRole(record?.role ?? null);
      setLoadedUid(user.uid);
    } catch (error) {
      console.error('load app role failed', error);
      setRole(null);
      setLoadedUid(user.uid);
    }
  }, [user]);

  useEffect(() => {
    void refreshRole();
  }, [refreshRole]);

  const listAppAdmins = useCallback(async () => {
    const cloud = await loadCloud();
    if (!cloud) return [];
    return cloud.api.listAppAdmins(cloud.db);
  }, []);

  const listUsers = useCallback(async () => {
    const cloud = await loadCloud();
    if (!cloud) return [];
    return cloud.api.listUsers(cloud.db);
  }, []);

  const grantAppAdmin = useCallback(
    async (target: { uid: string; email: string; displayName: string }) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.api.grantAppAdmin(cloud.db, user, target);
    },
    [user],
  );

  const revokeAppAdmin = useCallback(
    async (uid: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.api.revokeAppAdmin(cloud.db, user, uid);
    },
    [user],
  );

  const getMyViewerRestriction = useCallback(async () => {
    if (!user) return null;
    const cloud = await loadCloud();
    if (!cloud) return null;
    return cloud.viewerApi.getViewerRestriction(cloud.db, user.uid);
  }, [user]);

  const listViewerRestrictions = useCallback(async () => {
    const cloud = await loadCloud();
    if (!cloud) return [];
    return cloud.viewerApi.listViewerRestrictions(cloud.db);
  }, []);

  const setViewerBanned = useCallback(
    async (uid: string, banned: boolean) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.viewerApi.setViewerBanned(cloud.db, user, uid, banned);
    },
    [user],
  );

  const setViewerAllowedLeagueIds = useCallback(
    async (uid: string, allowedLeagueIds: string[]) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.viewerApi.setViewerAllowedLeagueIds(
        cloud.db,
        user,
        uid,
        allowedLeagueIds,
      );
    },
    [user],
  );

  const clearViewerRestriction = useCallback(
    async (uid: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.viewerApi.clearViewerRestriction(cloud.db, user, uid);
    },
    [user],
  );

  const loading = Boolean(user) && loadedUid !== user?.uid;

  const value = useMemo(
    () => ({
      role,
      isAppAdmin: isAppAdminRole(role),
      isSuperAdmin: isSuperAdminRole(role),
      loading,
      refreshRole,
      listAppAdmins,
      listUsers,
      grantAppAdmin,
      revokeAppAdmin,
      getMyViewerRestriction,
      listViewerRestrictions,
      setViewerBanned,
      setViewerAllowedLeagueIds,
      clearViewerRestriction,
    }),
    [
      role,
      loading,
      refreshRole,
      listAppAdmins,
      listUsers,
      grantAppAdmin,
      revokeAppAdmin,
      getMyViewerRestriction,
      listViewerRestrictions,
      setViewerBanned,
      setViewerAllowedLeagueIds,
      clearViewerRestriction,
    ],
  );

  return (
    <AppRoleContext.Provider value={value}>{children}</AppRoleContext.Provider>
  );
}

export function useAppRole(): AppRoleContextValue {
  const ctx = useContext(AppRoleContext);
  if (!ctx) throw new Error('useAppRole requires AppRoleProvider');
  return ctx;
}
