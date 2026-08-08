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
  SyncStatus,
} from '../cloud/leagueTypes';
import {
  CLOUD_FLUSH_IDLE_MS,
  CLOUD_POLL_MS,
} from '../domain/limits';
import type { DatabaseDto } from '../domain/types';
import { useAuth } from './AuthContext';

const ACTIVE_LEAGUE_KEY = 'SCOREKEEPER_ACTIVE_LEAGUE';

type LeagueContextValue = {
  leagues: LeagueMeta[];
  memberships: Record<string, LeagueMember | null>;
  membersByLeague: Record<string, LeagueMember[]>;
  activeLeagueId: string | null;
  /** True when the signed-in user may replace the open cloud league from a file. */
  canOverrideActiveLeague: boolean;
  /** True for local-only data, or when the signed-in user is admin of the open league. */
  canDeleteMatchesAndGames: boolean;
  syncStatus: SyncStatus;
  lastSavedAt: string | null;
  syncError: string | null;
  refreshing: boolean;
  refreshDirectory: () => Promise<void>;
  createNewLeague: (name: string) => Promise<string>;
  requestJoin: (leagueId: string) => Promise<void>;
  approveMember: (leagueId: string, uid: string) => Promise<void>;
  rejectMember: (leagueId: string, uid: string) => Promise<void>;
  openLeague: (leagueId: string) => Promise<DatabaseDto>;
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
  const [leagues, setLeagues] = useState<LeagueMeta[]>([]);
  const [memberships, setMemberships] = useState<
    Record<string, LeagueMember | null>
  >({});
  const [membersByLeague, setMembersByLeague] = useState<
    Record<string, LeagueMember[]>
  >({});
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
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
  const [isDirty, setIsDirty] = useState(false);

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
          if (league.adminUid === user.uid) {
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

  const flushNow = useCallback(
    async (data: DatabaseDto) => {
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
    if (!user || !activeLeagueId) return false;
    const league = leagues.find((row) => row.id === activeLeagueId);
    const membership = memberships[activeLeagueId];
    return (
      league?.adminUid === user.uid ||
      (membership?.status === 'active' && membership.role === 'admin')
    );
  }, [user, activeLeagueId, leagues, memberships]);

  const canDeleteMatchesAndGames = !activeLeagueId || canOverrideActiveLeague;

  const openLeague = useCallback(
    async (leagueId: string) => {
      const cloud = await loadCloud();
      if (!cloud || !user) throw new Error('Sign in required');
      const membership = await cloud.api.getMembership(
        cloud.db,
        leagueId,
        user.uid,
      );
      if (membership?.status !== 'active') {
        throw new Error('You must be an approved member to open this league');
      }
      clearFlushTimer();
      const { data, revisions } = await cloud.api.loadLeagueDatabase(
        cloud.db,
        leagueId,
      );
      revisionsRef.current = revisions;
      markClean(data);
      setActiveLeagueId(leagueId);
      storeActiveLeagueId(leagueId);
      setSyncStatus('saved');
      setLastSavedAt(new Date().toISOString());
      setSyncError(null);
      window.dispatchEvent(
        new CustomEvent('scorekeeper-cloud-refresh', { detail: data }),
      );
      return data;
    },
    [user, markClean],
  );

  const leaveLeague = useCallback(async () => {
    const latest = latestDataRef.current;
    if (latest && isDirty) {
      await flushNow(latest);
    }
    clearFlushTimer();
    setActiveLeagueId(null);
    clearStoredActiveLeagueId();
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
      setSyncStatus('local');
      setIsDirty(false);
      autoOpenAttemptedRef.current = false;
    }
  }, [user, activeLeagueId]);

  // Auto-open the last league after sign-in when membership is still active
  useEffect(() => {
    if (!user || activeLeagueId || autoOpenAttemptedRef.current) return;
    if (!directoryReady || refreshing) return;
    const storedId = loadStoredLeagueId();
    autoOpenAttemptedRef.current = true;
    if (!storedId) return;
    if (memberships[storedId]?.status !== 'active') return;
    void openLeague(storedId).catch((error) => {
      console.error('auto-open league failed', error);
      setSyncError(
        error instanceof Error ? error.message : 'Failed to reopen last league',
      );
    });
  }, [user, activeLeagueId, directoryReady, refreshing, memberships, openLeague]);

  const value = useMemo(
    () => ({
      leagues,
      memberships,
      membersByLeague,
      activeLeagueId,
      canOverrideActiveLeague,
      canDeleteMatchesAndGames,
      syncStatus,
      lastSavedAt,
      syncError,
      refreshing,
      refreshDirectory,
      createNewLeague,
      requestJoin,
      approveMember,
      rejectMember,
      openLeague,
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
      canOverrideActiveLeague,
      canDeleteMatchesAndGames,
      syncStatus,
      lastSavedAt,
      syncError,
      refreshing,
      refreshDirectory,
      createNewLeague,
      requestJoin,
      approveMember,
      rejectMember,
      openLeague,
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
