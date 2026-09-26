import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Firestore } from 'firebase/firestore';
import type { FlushPlan } from '../cloud/leagueApi';
import { QuotaExceededError } from '../cloud/errors';
import {
  diffDirty,
  gainedGameFinish,
  listMatchIds,
} from '../cloud/leagueSplitMerge';
import type {
  CloudRevisions,
  LeagueMember,
  LeagueMeta,
  MemberRole,
  SyncStatus,
} from '../cloud/leagueTypes';
import type { ImageRef } from '../domain/imageRef';
import { canOpenLeagueAsOperator } from '../domain/appRoles';
import {
  CLOUD_FLUSH_IDLE_MS,
  CLOUD_POLL_MS,
} from '../domain/limits';
import type { DatabaseDto } from '../domain/types';
import { canDeleteMatchGame } from '../domain/matchPermissions';
import { canViewLeague } from '../domain/viewerAccess';
import { useAuth } from './AuthContext';
import { useAppRole } from './AppRoleContext';

const ACTIVE_LEAGUE_KEY = 'SCOREKEEPER_ACTIVE_LEAGUE';
const VIEW_LEAGUE_KEY = 'SCOREKEEPER_VIEW_LEAGUE';

export type LeagueAccessMode = 'operate' | 'view';

type LeagueContextValue = {
  leagues: LeagueMeta[];
  memberships: Record<string, LeagueMember | null>;
  membersByLeague: Record<string, LeagueMember[]>;
  activeLeagueId: string | null;
  /** `operate` = scorekeeper membership open; `view` = read-only viewer open. */
  accessMode: LeagueAccessMode;
  /** True when the open league must not accept local mutations or cloud flushes. */
  readOnly: boolean;
  /** True when the signed-in user may replace the open cloud league from a file. */
  canOverrideActiveLeague: boolean;
  /** True for local-only data, or when the signed-in user is admin of the open league. */
  canDeleteMatchesAndGames: boolean;
  /** Local, league admin, or the signed-in user who created the match. */
  canDeleteGame: (createdByUid?: string | null) => boolean;
  syncStatus: SyncStatus;
  lastSavedAt: string | null;
  syncError: string | null;
  refreshing: boolean;
  refreshDirectory: () => Promise<void>;
  createNewLeague: (name: string) => Promise<string>;
  requestJoin: (leagueId: string) => Promise<void>;
  approveMember: (leagueId: string, uid: string) => Promise<void>;
  rejectMember: (leagueId: string, uid: string) => Promise<void>;
  setMemberRole: (
    leagueId: string,
    uid: string,
    role: MemberRole,
  ) => Promise<void>;
  removeMember: (leagueId: string, uid: string) => Promise<void>;
  transferLeagueOwner: (leagueId: string, uid: string) => Promise<void>;
  loadLeagueMembers: (leagueId: string) => Promise<LeagueMember[]>;
  updateLeagueImages: (images: {
    logo?: ImageRef | null;
    banner?: ImageRef | null;
  }) => Promise<void>;
  openLeague: (leagueId: string) => Promise<DatabaseDto>;
  /** Open any readable league without membership; never writes. */
  openLeagueForView: (leagueId: string) => Promise<DatabaseDto>;
  leaveLeague: () => Promise<void>;
  /** Called by DatabaseProvider after local mutations. */
  notifyLocalChange: (prev: DatabaseDto, next: DatabaseDto) => void;
  /**
   * After an admin file/sample import into the open league: mark full replace dirty
   * and flush to cloud immediately.
   */
  queueImportOverrideFlush: (prev: DatabaseDto, next: DatabaseDto) => void;
  /** Flush pending cloud writes if connected. */
  flushNow: (data: DatabaseDto) => Promise<void>;
  /** Flush pending cloud writes using the latest known database snapshot. */
  saveNow: () => Promise<void>;
  isDirty: boolean;
};

const LeagueContext = createContext<LeagueContextValue | null>(null);

function loadStoredLeagueId(): string | null {
  try {
    const fromLocal = localStorage.getItem(ACTIVE_LEAGUE_KEY);
    if (fromLocal) return fromLocal;
    // Migrate from the older sessionStorage key once
    const fromSession = sessionStorage.getItem(ACTIVE_LEAGUE_KEY);
    if (fromSession) {
      localStorage.setItem(ACTIVE_LEAGUE_KEY, fromSession);
      sessionStorage.removeItem(ACTIVE_LEAGUE_KEY);
      return fromSession;
    }
    return null;
  } catch {
    return null;
  }
}

function storeActiveLeagueId(leagueId: string): void {
  try {
    localStorage.setItem(ACTIVE_LEAGUE_KEY, leagueId);
    sessionStorage.removeItem(ACTIVE_LEAGUE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

function clearStoredActiveLeagueId(): void {
  try {
    localStorage.removeItem(ACTIVE_LEAGUE_KEY);
    sessionStorage.removeItem(ACTIVE_LEAGUE_KEY);
  } catch {
    /* ignore */
  }
}

function loadStoredViewLeagueId(): string | null {
  try {
    return localStorage.getItem(VIEW_LEAGUE_KEY);
  } catch {
    return null;
  }
}

function storeViewLeagueId(leagueId: string): void {
  try {
    localStorage.setItem(VIEW_LEAGUE_KEY, leagueId);
  } catch {
    /* ignore */
  }
}

function clearStoredViewLeagueId(): void {
  try {
    localStorage.removeItem(VIEW_LEAGUE_KEY);
  } catch {
    /* ignore */
  }
}

type LeagueApi = typeof import('../cloud/leagueApi');

/**
 * Loads the Firebase SDK and cloud API on demand so local-only sessions never
 * download them. Resolves to null when Firebase is not configured.
 */
async function loadCloud(): Promise<{ db: Firestore; api: LeagueApi } | null> {
  const [{ getDb }, api] = await Promise.all([
    import('../cloud/firestoreDb'),
    import('../cloud/leagueApi'),
  ]);
  const db = getDb();
  return db ? { db, api } : null;
}

function hasDirtyChanges(plan: FlushPlan): boolean {
  return (
    plan.roster ||
    plan.matchIds.length > 0 ||
    plan.removedMatchIds.length > 0
  );
}

export function LeagueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    isAppAdmin,
    loading: appRoleLoading,
    getMyViewerRestriction,
  } = useAppRole();
  const [leagues, setLeagues] = useState<LeagueMeta[]>([]);
  const [memberships, setMemberships] = useState<
    Record<string, LeagueMember | null>
  >({});
  const [membersByLeague, setMembersByLeague] = useState<
    Record<string, LeagueMember[]>
  >({});
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<LeagueAccessMode>('operate');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [directoryReady, setDirectoryReady] = useState(false);

  const revisionsRef = useRef<CloudRevisions>({
    rosterRevision: 0,
    matchRevisions: {},
  });
  const syncedDataRef = useRef<DatabaseDto | null>(null);
  const latestDataRef = useRef<DatabaseDto | null>(null);
  const dirtyRef = useRef<FlushPlan>({
    roster: false,
    matchIds: [],
    removedMatchIds: [],
  });
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);
  const autoOpenAttemptedRef = useRef(false);
  const accessModeRef = useRef<LeagueAccessMode>('operate');
  accessModeRef.current = accessMode;
  const [isDirty, setIsDirty] = useState(false);

  const readOnly = Boolean(activeLeagueId) && accessMode === 'view';

  const clearFlushTimer = () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  };

  const markClean = useCallback((data: DatabaseDto) => {
    syncedDataRef.current = structuredClone(data);
    latestDataRef.current = structuredClone(data);
    dirtyRef.current = { roster: false, matchIds: [], removedMatchIds: [] };
    setIsDirty(false);
  }, []);

  const refreshDirectory = useCallback(async () => {
    const cloud = user ? await loadCloud() : null;
    if (!cloud || !user) {
      setLeagues([]);
      setMemberships({});
      setMembersByLeague({});
      setDirectoryReady(false);
      return;
    }
    setRefreshing(true);
    try {
      const list = await cloud.api.listLeagues(cloud.db);
      setLeagues(list);
      const nextMemberships: Record<string, LeagueMember | null> = {};
      const nextMembers: Record<string, LeagueMember[]> = {};
      await Promise.all(
        list.map(async (league) => {
          nextMemberships[league.id] = await cloud.api.getMembership(
            cloud.db,
            league.id,
            user.uid,
          );
          const membership = nextMemberships[league.id];
          const canListMembers =
            league.adminUid === user.uid ||
            (membership?.status === 'active' && membership.role === 'admin');
          if (canListMembers) {
            nextMembers[league.id] = await cloud.api.listMembers(
              cloud.db,
              league.id,
            );
          }
        }),
      );
      setMemberships(nextMemberships);
      setMembersByLeague(nextMembers);
      setSyncError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load leagues';
      const hint =
        /permission|insufficient/i.test(message)
          ? ' If App Check is Enforced in Firebase, set VITE_FIREBASE_APPCHECK_SITE_KEY or switch App Check to Monitor.'
          : '';
      setSyncError(`${message}.${hint}`.replace(/\.\./g, '.'));
      console.error('refreshDirectory failed', error);
    } finally {
      setRefreshing(false);
      setDirectoryReady(true);
    }
  }, [user]);

  useEffect(() => {
    void refreshDirectory();
  }, [refreshDirectory]);

  const createNewLeague = useCallback(
    async (name: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      const id = await cloud.api.createLeague(cloud.db, user, name);
      await refreshDirectory();
      return id;
    },
    [user, refreshDirectory],
  );

  const requestJoin = useCallback(
    async (leagueId: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.api.requestJoinLeague(cloud.db, user, leagueId);
      await refreshDirectory();
    },
    [user, refreshDirectory],
  );

  const approveMember = useCallback(
    async (leagueId: string, uid: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.api.setMemberStatus(cloud.db, user, leagueId, uid, 'active');
      await refreshDirectory();
    },
    [user, refreshDirectory],
  );

  const rejectMember = useCallback(
    async (leagueId: string, uid: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.api.setMemberStatus(cloud.db, user, leagueId, uid, 'rejected');
      await refreshDirectory();
    },
    [user, refreshDirectory],
  );

  const setMemberRole = useCallback(
    async (leagueId: string, uid: string, role: MemberRole) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.api.setMemberRole(cloud.db, user, leagueId, uid, role);
      await refreshDirectory();
    },
    [user, refreshDirectory],
  );

  const removeMember = useCallback(
    async (leagueId: string, uid: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.api.removeMember(cloud.db, user, leagueId, uid);
      await refreshDirectory();
    },
    [user, refreshDirectory],
  );

  const transferLeagueOwner = useCallback(
    async (leagueId: string, uid: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      await cloud.api.transferLeagueOwner(cloud.db, user, leagueId, uid);
      await refreshDirectory();
    },
    [user, refreshDirectory],
  );

  const loadLeagueMembers = useCallback(async (leagueId: string) => {
    const cloud = await loadCloud();
    if (!cloud) return [];
    const members = await cloud.api.listMembers(cloud.db, leagueId);
    setMembersByLeague((prev) => ({ ...prev, [leagueId]: members }));
    return members;
  }, []);

  const updateLeagueImages = useCallback(
    async (images: { logo?: ImageRef | null; banner?: ImageRef | null }) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      const leagueId = activeLeagueId;
      if (!leagueId) throw new Error('Open a cloud league first');
      await cloud.api.updateLeagueImages(cloud.db, user, leagueId, images);
      await refreshDirectory();
    },
    [user, activeLeagueId, refreshDirectory],
  );

  const flushNow = useCallback(
    async (data: DatabaseDto) => {
      if (accessModeRef.current === 'view') return;
      const leagueId = activeLeagueId;
      if (!user || !leagueId) return;

      const plan = dirtyRef.current;
      if (!hasDirtyChanges(plan)) {
        setSyncStatus('saved');
        return;
      }
      // Claim the flush before awaiting so concurrent callers cannot overlap.
      if (flushingRef.current) return;
      flushingRef.current = true;
      clearFlushTimer();
      setSyncStatus('saving');
      setSyncError(null);
      try {
        const cloud = await loadCloud();
        if (!cloud) return;
        const nextRevisions = await cloud.api.flushLeagueChanges(
          cloud.db,
          user,
          leagueId,
          data,
          {
            roster: plan.roster,
            matchIds: [...new Set(plan.matchIds)],
            removedMatchIds: [...new Set(plan.removedMatchIds)],
          },
          revisionsRef.current,
        );
        revisionsRef.current = nextRevisions;
        markClean(data);
        setLastSavedAt(new Date().toISOString());
        setSyncStatus('saved');
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          setSyncStatus('quota');
          setSyncError(error.message);
        } else {
          setSyncStatus('error');
          setSyncError(
            error instanceof Error ? error.message : 'Save failed',
          );
        }
      } finally {
        flushingRef.current = false;
      }
    },
    [activeLeagueId, user, markClean],
  );

  const scheduleFlush = useCallback(
    (data: DatabaseDto, immediate: boolean) => {
      latestDataRef.current = data;
      clearFlushTimer();
      if (immediate) {
        void flushNow(data);
        return;
      }
      flushTimerRef.current = setTimeout(() => {
        const latest = latestDataRef.current;
        if (latest) void flushNow(latest);
      }, CLOUD_FLUSH_IDLE_MS);
    },
    [flushNow],
  );

  const notifyLocalChange = useCallback(
    (prev: DatabaseDto, next: DatabaseDto) => {
      if (!activeLeagueId || !user) return;
      if (accessModeRef.current === 'view') return;
      const diff = diffDirty(syncedDataRef.current ?? prev, next);
      const dirty = dirtyRef.current;
      if (diff.roster) dirty.roster = true;
      dirty.matchIds = [
        ...new Set([
          ...dirty.matchIds.filter((id) => !diff.removedMatchIds.includes(id)),
          ...diff.matchIds.filter((id) => !diff.removedMatchIds.includes(id)),
        ]),
      ];
      dirty.removedMatchIds = [
        ...new Set([...dirty.removedMatchIds, ...diff.removedMatchIds]),
      ];
      dirtyRef.current = dirty;
      const dirtyChanges = hasDirtyChanges(dirty);
      setIsDirty(dirtyChanges);
      if (!dirtyChanges) return;
      setSyncStatus('unsaved');
      scheduleFlush(next, gainedGameFinish(prev, next));
    },
    [activeLeagueId, user, scheduleFlush],
  );

  const queueImportOverrideFlush = useCallback(
    (prev: DatabaseDto, next: DatabaseDto) => {
      if (accessModeRef.current === 'view') {
        throw new Error('Cannot override a league in view-only mode');
      }
      if (!activeLeagueId || !user) {
        throw new Error('Open a cloud league before overriding it');
      }
      const base = syncedDataRef.current ?? prev;
      const nextIds = listMatchIds(next);
      const baseIds = listMatchIds(base);
      const nextIdSet = new Set(nextIds);
      dirtyRef.current = {
        roster: true,
        matchIds: nextIds,
        removedMatchIds: baseIds.filter((id) => !nextIdSet.has(id)),
      };
      latestDataRef.current = next;
      setIsDirty(true);
      setSyncStatus('unsaved');
      scheduleFlush(next, true);
    },
    [activeLeagueId, user, scheduleFlush],
  );

  const canOverrideActiveLeague = useMemo(() => {
    if (accessMode === 'view') return false;
    if (!user || !activeLeagueId) return false;
    if (isAppAdmin) return true;
    const league = leagues.find((row) => row.id === activeLeagueId);
    const membership = memberships[activeLeagueId];
    return (
      league?.adminUid === user.uid ||
      (membership?.status === 'active' && membership.role === 'admin')
    );
  }, [user, activeLeagueId, leagues, memberships, isAppAdmin, accessMode]);

  const canDeleteMatchesAndGames =
    !activeLeagueId || (accessMode === 'operate' && canOverrideActiveLeague);

  const canDeleteGame = useCallback(
    (createdByUid?: string | null) => {
      if (accessMode === 'view') return false;
      return canDeleteMatchGame({
        hasActiveLeague: Boolean(activeLeagueId),
        isLeagueAdmin: canOverrideActiveLeague,
        userUid: user?.uid,
        createdByUid,
      });
    },
    [activeLeagueId, canOverrideActiveLeague, user?.uid, accessMode],
  );

  const openLeague = useCallback(
    async (leagueId: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      const membership = await cloud.api.getMembership(
        cloud.db,
        leagueId,
        user.uid,
      );
      if (
        !canOpenLeagueAsOperator({
          membershipStatus: membership?.status,
          isAppAdmin,
        })
      ) {
        throw new Error('You must be an approved member to open this league');
      }
      clearFlushTimer();
      const { data, revisions } = await cloud.api.loadLeagueDatabase(
        cloud.db,
        leagueId,
      );
      revisionsRef.current = revisions;
      markClean(data);
      setAccessMode('operate');
      setActiveLeagueId(leagueId);
      storeActiveLeagueId(leagueId);
      clearStoredViewLeagueId();
      setSyncStatus('saved');
      setLastSavedAt(new Date().toISOString());
      setSyncError(null);
      window.dispatchEvent(
        new CustomEvent('scorekeeper-cloud-refresh', { detail: data }),
      );
      return data;
    },
    [user, markClean, isAppAdmin],
  );

  const openLeagueForView = useCallback(
    async (leagueId: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      if (!isAppAdmin) {
        const restriction = await getMyViewerRestriction();
        if (!canViewLeague(leagueId, restriction)) {
          throw new Error(
            restriction?.banned
              ? 'Your account is blocked from viewing league stats'
              : 'You are not allowed to view this league',
          );
        }
      }
      clearFlushTimer();
      dirtyRef.current = { roster: false, matchIds: [], removedMatchIds: [] };
      setIsDirty(false);
      const { data, revisions } = await cloud.api.loadLeagueDatabase(
        cloud.db,
        leagueId,
      );
      revisionsRef.current = revisions;
      markClean(data);
      setAccessMode('view');
      setActiveLeagueId(leagueId);
      storeViewLeagueId(leagueId);
      setSyncStatus('saved');
      setLastSavedAt(new Date().toISOString());
      setSyncError(null);
      window.dispatchEvent(
        new CustomEvent('scorekeeper-cloud-refresh', { detail: data }),
      );
      return data;
    },
    [user, markClean, isAppAdmin, getMyViewerRestriction],
  );

  const leaveLeague = useCallback(async () => {
    const latest = latestDataRef.current;
    if (latest && isDirty && accessModeRef.current === 'operate') {
      await flushNow(latest);
    }
    clearFlushTimer();
    const wasView = accessModeRef.current === 'view';
    setActiveLeagueId(null);
    setAccessMode('operate');
    if (wasView) {
      clearStoredViewLeagueId();
    } else {
      clearStoredActiveLeagueId();
    }
    syncedDataRef.current = null;
    latestDataRef.current = null;
    dirtyRef.current = { roster: false, matchIds: [], removedMatchIds: [] };
    setIsDirty(false);
    setSyncStatus('local');
  }, [flushNow, isDirty]);

  const saveNow = useCallback(async () => {
    const latest = latestDataRef.current;
    if (!latest) return;
    await flushNow(latest);
  }, [flushNow]);

  // Poll remote while connected and clean
  useEffect(() => {
    if (!activeLeagueId || !user) return;

    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      if (hasDirtyChanges(dirtyRef.current)) return;
      try {
        const cloud = await loadCloud();
        if (!cloud) return;
        const { data, revisions } = await cloud.api.loadLeagueDatabase(
          cloud.db,
          activeLeagueId,
        );
        revisionsRef.current = revisions;
        markClean(data);
        // Signal consumers via custom event — DatabaseProvider listens
        window.dispatchEvent(
          new CustomEvent('scorekeeper-cloud-refresh', { detail: data }),
        );
      } catch {
        // ignore poll errors
      }
    };

    const onFocus = () => {
      void tick();
    };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => void tick(), CLOUD_POLL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [activeLeagueId, user, markClean]);

  // Flush on unload
  useEffect(() => {
    const onHide = () => {
      if (accessModeRef.current === 'view') return;
      const latest = latestDataRef.current;
      if (!latest || !activeLeagueId) return;
      if (!hasDirtyChanges(dirtyRef.current)) return;
      void flushNow(latest);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onHide);
    };
  }, [activeLeagueId, flushNow]);

  // Clear active league on sign-out (keep stored id for next sign-in)
  useEffect(() => {
    if (!user && activeLeagueId) {
      clearFlushTimer();
      setActiveLeagueId(null);
      setAccessMode('operate');
      setSyncStatus('local');
      setIsDirty(false);
      autoOpenAttemptedRef.current = false;
    }
  }, [user, activeLeagueId]);

  // Auto-open the last league after sign-in when membership is still active
  // (or the signed-in user is an app admin). Skip on the view-stats shell.
  useEffect(() => {
    if (!user || activeLeagueId || autoOpenAttemptedRef.current) return;
    if (!directoryReady || refreshing || appRoleLoading) return;
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname.includes('/view-stats') ||
        window.location.pathname.endsWith('/view-stats'))
    ) {
      autoOpenAttemptedRef.current = true;
      return;
    }
    const storedId = loadStoredLeagueId();
    autoOpenAttemptedRef.current = true;
    if (!storedId) return;
    if (
      !canOpenLeagueAsOperator({
        membershipStatus: memberships[storedId]?.status,
        isAppAdmin,
      })
    ) {
      return;
    }
    void openLeague(storedId).catch((error) => {
      console.error('auto-open league failed', error);
      setSyncError(
        error instanceof Error ? error.message : 'Failed to reopen last league',
      );
    });
  }, [
    user,
    activeLeagueId,
    directoryReady,
    refreshing,
    appRoleLoading,
    memberships,
    isAppAdmin,
    openLeague,
  ]);

  const value = useMemo(
    () => ({
      leagues,
      memberships,
      membersByLeague,
      activeLeagueId,
      accessMode,
      readOnly,
      canOverrideActiveLeague,
      canDeleteMatchesAndGames,
      canDeleteGame,
      syncStatus,
      lastSavedAt,
      syncError,
      refreshing,
      refreshDirectory,
      createNewLeague,
      requestJoin,
      approveMember,
      rejectMember,
      setMemberRole,
      removeMember,
      transferLeagueOwner,
      loadLeagueMembers,
      updateLeagueImages,
      openLeague,
      openLeagueForView,
      leaveLeague,
      notifyLocalChange,
      queueImportOverrideFlush,
      flushNow,
      saveNow,
      isDirty,
    }),
    [
      leagues,
      memberships,
      membersByLeague,
      activeLeagueId,
      accessMode,
      readOnly,
      canOverrideActiveLeague,
      canDeleteMatchesAndGames,
      canDeleteGame,
      syncStatus,
      lastSavedAt,
      syncError,
      refreshing,
      refreshDirectory,
      createNewLeague,
      requestJoin,
      approveMember,
      rejectMember,
      setMemberRole,
      removeMember,
      transferLeagueOwner,
      loadLeagueMembers,
      updateLeagueImages,
      openLeague,
      openLeagueForView,
      leaveLeague,
      notifyLocalChange,
      queueImportOverrideFlush,
      flushNow,
      saveNow,
      isDirty,
    ],
  );

  return (
    <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>
  );
}

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error('useLeague requires LeagueProvider');
  return ctx;
}

export function getStoredActiveLeagueId(): string | null {
  return loadStoredLeagueId();
}

export function getStoredViewLeagueId(): string | null {
  return loadStoredViewLeagueId();
}
