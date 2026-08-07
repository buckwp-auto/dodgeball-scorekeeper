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
  addMatch as addMatchOp,
  addPlayer as addPlayerOp,
  addTeam as addTeamOp,
  createEmptyDatabase,
  deletePlayer as deletePlayerOp,
  deleteTeam as deleteTeamOp,
  getMatchName,
  loadFromSession,
  normalizeDatabase,
  renamePlayer as renamePlayerOp,
  renameTeam as renameTeamOp,
  saveToSession,
  serializeDatabase,
} from '../domain/database';
import {
  toggleGamePlayer as toggleGamePlayerOp,
  toggleMatchPlayer as toggleMatchPlayerOp,
} from '../domain/matchGame';
import { autoSelectMatchRoster } from '../domain/rosterAutoSelect';
import type { DatabaseDto, Guid, HistoryCommit } from '../domain/types';
import { useLeague } from './LeagueContext';

type DatabaseContextValue = {
  data: DatabaseDto;
  commits: HistoryCommit[];
  addTeam: (name: string) => void;
  addPlayer: (teamId: Guid, name: string) => void;
  renameTeam: (teamId: Guid, name: string) => void;
  renamePlayer: (playerId: Guid, name: string) => void;
  deleteTeam: (teamId: Guid) => void;
  deletePlayer: (playerId: Guid) => void;
  addMatch: (teamIdHome: Guid, teamIdAway: Guid) => Guid;
  toggleMatchPlayer: (matchId: Guid, playerId: Guid, teamHome: boolean) => void;
  toggleGamePlayer: (matchId: Guid, gameId: Guid, playerId: Guid) => void;
  mutate: <T>(
    fn: (data: DatabaseDto) => T,
    commitMessage: string | ((result: T) => string),
  ) => T;
  replaceDatabase: (raw: unknown) => void;
  exportBytes: () => Uint8Array;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

function initialData(): DatabaseDto {
  return loadFromSession() ?? createEmptyDatabase();
}

function pushCommit(
  commits: HistoryCommit[],
  message: string,
): HistoryCommit[] {
  return [...commits, { message, timestamp: new Date().toISOString() }];
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { notifyLocalChange, activeLeagueId } = useLeague();
  const [data, setData] = useState<DatabaseDto>(initialData);
  const dataRef = useRef(data);
  dataRef.current = data;

  const [commits, setCommits] = useState<HistoryCommit[]>(() =>
    loadFromSession()
      ? [{ message: 'Restored data.', timestamp: new Date().toISOString() }]
      : [{ message: 'Initialized data.', timestamp: new Date().toISOString() }],
  );

  const persist = useCallback(
    (next: DatabaseDto, prev: DatabaseDto | null) => {
      dataRef.current = next;
      setData(next);
      saveToSession(next);
      if (prev) {
        notifyLocalChange(prev, next);
      }
    },
    [notifyLocalChange],
  );

  useEffect(() => {
    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<DatabaseDto>).detail;
      if (!detail) return;
      if (serializeDatabase(detail) === serializeDatabase(dataRef.current)) {
        return;
      }
      dataRef.current = detail;
      setData(detail);
      saveToSession(detail);
      setCommits((prevCommits) =>
        pushCommit(prevCommits, 'Synced from cloud.'),
      );
    };
    window.addEventListener('scorekeeper-cloud-refresh', onRefresh);
    return () =>
      window.removeEventListener('scorekeeper-cloud-refresh', onRefresh);
  }, []);

  const mutate = useCallback(
    <T,>(
      fn: (draft: DatabaseDto) => T,
      commitMessage: string | ((result: T) => string),
    ) => {
      const prev = dataRef.current;
      const next = structuredClone(prev);
      const result = fn(next);
      // Skip no-op updates (e.g. auto-select when roster already full) to avoid
      // useEffect → mutate → new mutate/data → infinite re-render loops.
      if (serializeDatabase(prev) === serializeDatabase(next)) {
        return result;
      }
      persist(next, prev);
      const message =
        typeof commitMessage === 'function'
          ? commitMessage(result)
          : commitMessage;
      if (message) {
        setCommits((prevCommits) => pushCommit(prevCommits, message));
      }
      return result;
    },
    [persist],
  );

  const addTeam = useCallback(
    (name: string) => {
      mutate(
        (draft) => addTeamOp(draft, name).Name,
        (teamName) => `Added team (${teamName}).`,
      );
    },
    [mutate],
  );

  const addPlayer = useCallback(
    (teamId: Guid, name: string) => {
      mutate(
        (draft) => {
          const team = draft.Tables.Team.find(
            (row) => (row as { Id: Guid }).Id === teamId,
          ) as { Name: string } | undefined;
          const player = addPlayerOp(draft, teamId, name);
          return { playerName: player.Name, teamName: team?.Name ?? '?' };
        },
        ({ playerName, teamName }) =>
          `Added player (${playerName}) to team (${teamName}).`,
      );
    },
    [mutate],
  );

  const renameTeam = useCallback(
    (teamId: Guid, name: string) => {
      mutate(
        (draft) => renameTeamOp(draft, teamId, name).Name,
        (teamName) => `Renamed team to (${teamName}).`,
      );
    },
    [mutate],
  );

  const renamePlayer = useCallback(
    (playerId: Guid, name: string) => {
      mutate(
        (draft) => renamePlayerOp(draft, playerId, name).Name,
        (playerName) => `Renamed player to (${playerName}).`,
      );
    },
    [mutate],
  );

  const deleteTeam = useCallback(
    (teamId: Guid) => {
      mutate(
        (draft) => {
          const team = draft.Tables.Team.find(
            (row) => (row as { Id: Guid }).Id === teamId,
          ) as { Name: string } | undefined;
          const name = team?.Name ?? '?';
          deleteTeamOp(draft, teamId);
          return name;
        },
        (teamName) => `Deleted team (${teamName}).`,
      );
    },
    [mutate],
  );

  const deletePlayer = useCallback(
    (playerId: Guid) => {
      mutate(
        (draft) => {
          const player = draft.Tables.Player.find(
            (row) => (row as { Id: Guid }).Id === playerId,
          ) as { Name: string } | undefined;
          const name = player?.Name ?? '?';
          deletePlayerOp(draft, playerId);
          return name;
        },
        (playerName) => `Deleted player (${playerName}).`,
      );
    },
    [mutate],
  );

  const addMatch = useCallback(
    (teamIdHome: Guid, teamIdAway: Guid) =>
      mutate(
        (draft) => {
          const match = addMatchOp(draft, teamIdHome, teamIdAway);
          autoSelectMatchRoster(draft, match.Id);
          return { id: match.Id, name: getMatchName(draft, match) };
        },
        ({ name }) => `Added match (${name}).`,
      ).id,
    [mutate],
  );

  const toggleMatchPlayer = useCallback(
    (matchId: Guid, playerId: Guid, teamHome: boolean) => {
      mutate(
        (draft) => toggleMatchPlayerOp(draft, matchId, playerId, teamHome),
        '',
      );
    },
    [mutate],
  );

  const toggleGamePlayer = useCallback(
    (matchId: Guid, gameId: Guid, playerId: Guid) => {
      mutate(
        (draft) => toggleGamePlayerOp(draft, matchId, gameId, playerId),
        '',
      );
    },
    [mutate],
  );

  const replaceDatabase = useCallback(
    (raw: unknown) => {
      const prev = dataRef.current;
      const next = normalizeDatabase(raw);
      persist(next, activeLeagueId ? prev : null);
      setCommits((prevCommits) => pushCommit(prevCommits, 'Replaced data.'));
    },
    [persist, activeLeagueId],
  );

  const exportBytes = useCallback(() => {
    return new TextEncoder().encode(serializeDatabase(data));
  }, [data]);

  const value = useMemo(
    () => ({
      data,
      commits,
      addTeam,
      addPlayer,
      renameTeam,
      renamePlayer,
      deleteTeam,
      deletePlayer,
      addMatch,
      toggleMatchPlayer,
      toggleGamePlayer,
      mutate,
      replaceDatabase,
      exportBytes,
    }),
    [
      data,
      commits,
      addTeam,
      addPlayer,
      renameTeam,
      renamePlayer,
      deleteTeam,
      deletePlayer,
      addMatch,
      toggleMatchPlayer,
      toggleGamePlayer,
      mutate,
      replaceDatabase,
      exportBytes,
    ],
  );

  return (
    <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase requires DatabaseProvider');
  return ctx;
}
