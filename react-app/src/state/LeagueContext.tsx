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
import {
  createLeague,
  flushLeagueChanges,
  getMembership,
  listLeagues,
  listMembers,
  loadLeagueDatabase,
  QuotaExceededError,
  requestJoinLeague,
  setMemberStatus,
  type FlushPlan,
} from '../cloud/leagueApi';
import { getFirebase } from '../cloud/firebase';
import {
  diffDirty,
  gainedGameFinish,
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
  /** Flush pending cloud writes if connected. */
  flushNow: (data: DatabaseDto) => Promise<void>;
  isDirty: boolean;
};

const LeagueContext = createContext<LeagueContextValue | null>(null);

function loadStoredLeagueId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_LEAGUE_KEY);
  } catch {
    return null;
  }
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
    const fb = getFirebase();
    if (!fb || !user) {
      setLeagues([]);
      setMemberships({});
      setMembersByLeague({});
      return;
    }
    setRefreshing(true);
    try {
      const list = await listLeagues(fb.db);
      setLeagues(list);
      const nextMemberships: Record<string, LeagueMember | null> = {};
      const nextMembers: Record<string, LeagueMember[]> = {};
      await Promise.all(
        list.map(async (league) => {
          nextMemberships[league.id] = await getMembership(
            fb.db,
            league.id,
            user.uid,
          );
          if (league.adminUid === user.uid) {
            nextMembers[league.id] = await listMembers(fb.db, league.id);
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
    }
  }, [user]);

  useEffect(() => {
    void refreshDirectory();
  }, [refreshDirectory]);

  const createNewLeague = useCallback(
    async (name: string) => {
      const fb = getFirebase();
      if (!fb || !user) throw new Error('Sign in required');
      const id = await createLeague(fb.db, user, name);
      await refreshDirectory();
      return id;
    },
    [user, refreshDirectory],
  );

  const requestJoin = useCallback(
    async (leagueId: string) => {
      const fb = getFirebase();
      if (!fb || !user) throw new Error('Sign in required');
      await requestJoinLeague(fb.db, user, leagueId);
      await refreshDirectory();
    },
    [user, refreshDirectory],
  );

  const approveMember = useCallback(
    async (leagueId: string, uid: string) => {
      const fb = getFirebase();
      if (!fb || !user) throw new Error('Sign in required');
      await setMemberStatus(fb.db, user, leagueId, uid, 'active');
      await refreshDirectory();
    },
    [user, refreshDirectory],
  );

  const rejectMember = useCallback(
    async (leagueId: string, uid: string) => {
      const fb = getFirebase();
      if (!fb || !user) throw new Error('Sign in required');
      await setMemberStatus(fb.db, user, leagueId, uid, 'rejected');
      await refreshDirectory();
    },
    [user, refreshDirectory],
  );

  const flushNow = useCallback(
    async (data: DatabaseDto) => {
      const fb = getFirebase();
      const leagueId = activeLeagueId;
      if (!fb || !user || !leagueId) return;

      const plan = dirtyRef.current;
      if (
        !plan.roster &&
        plan.matchIds.length === 0 &&
        plan.removedMatchIds.length === 0
      ) {
        setSyncStatus('saved');
        return;
      }
      if (flushingRef.current) return;
      flushingRef.current = true;
      clearFlushTimer();
      setSyncStatus('saving');
      setSyncError(null);
      try {
        const nextRevisions = await flushLeagueChanges(
          fb.db,
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
      const hasDirty =
        dirty.roster ||
        dirty.matchIds.length > 0 ||
        dirty.removedMatchIds.length > 0;
      setIsDirty(hasDirty);
      if (!hasDirty) return;
      setSyncStatus('unsaved');
      scheduleFlush(next, gainedGameFinish(prev, next));
    },
    [activeLeagueId, user, scheduleFlush],
  );

  const openLeague = useCallback(
    async (leagueId: string) => {
      const fb = getFirebase();
      if (!fb || !user) throw new Error('Sign in required');
      const membership = await getMembership(fb.db, leagueId, user.uid);
      if (membership?.status !== 'active') {
        throw new Error('You must be an approved member to open this league');
      }
      clearFlushTimer();
      const { data, revisions } = await loadLeagueDatabase(fb.db, leagueId);
      revisionsRef.current = revisions;
      markClean(data);
      setActiveLeagueId(leagueId);
      sessionStorage.setItem(ACTIVE_LEAGUE_KEY, leagueId);
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
    sessionStorage.removeItem(ACTIVE_LEAGUE_KEY);
    syncedDataRef.current = null;
    latestDataRef.current = null;
    dirtyRef.current = { roster: false, matchIds: [], removedMatchIds: [] };
    setIsDirty(false);
    setSyncStatus(user ? 'need-auth' : 'local');
    // need-auth is wrong when signed in but local — use local
    setSyncStatus('local');
  }, [flushNow, isDirty, user]);

  // Poll remote while connected and clean
  useEffect(() => {
    if (!activeLeagueId || !user) return;
    const fb = getFirebase();
    if (!fb) return;

    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      if (dirtyRef.current.roster || dirtyRef.current.matchIds.length > 0) {
        return;
      }
      try {
        const { data, revisions } = await loadLeagueDatabase(
          fb.db,
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
      if (
        !dirtyRef.current.roster &&
        dirtyRef.current.matchIds.length === 0 &&
        dirtyRef.current.removedMatchIds.length === 0
      ) {
        return;
      }
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

  // Clear active league on sign-out
  useEffect(() => {
    if (!user && activeLeagueId) {
      clearFlushTimer();
      setActiveLeagueId(null);
      sessionStorage.removeItem(ACTIVE_LEAGUE_KEY);
      setSyncStatus('local');
      setIsDirty(false);
    }
  }, [user, activeLeagueId]);

  const value = useMemo(
    () => ({
      leagues,
      memberships,
      membersByLeague,
      activeLeagueId,
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
      flushNow,
      isDirty,
    }),
    [
      leagues,
      memberships,
      membersByLeague,
      activeLeagueId,
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
      flushNow,
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
