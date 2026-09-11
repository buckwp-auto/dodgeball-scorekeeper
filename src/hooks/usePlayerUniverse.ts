import { useEffect, useMemo, useState } from 'react';
import {
  buildUniversePlayers,
  type UniversePlayer,
} from '../domain/playerUniverse';
import type { DatabaseDto } from '../domain/types';
import { useAuth } from '../state/AuthContext';
import { useLeague } from '../state/LeagueContext';

type CachedRoster = {
  leagueId: string;
  leagueName: string;
  data: DatabaseDto;
};

/** Session cache so Team pages don't re-fetch every mount. */
const rosterCache = new Map<string, CachedRoster>();

export type PlayerUniverseState = {
  universe: UniversePlayer[];
  loading: boolean;
  error: string | null;
};

export function usePlayerUniverse(): PlayerUniverseState {
  const { configured, user } = useAuth();
  const { leagues, memberships, activeLeagueId } = useLeague();
  const [entries, setEntries] = useState<CachedRoster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(
    () =>
      !configured || !user
        ? []
        : leagues
            .filter(
              (league) =>
                league.id !== activeLeagueId &&
                memberships[league.id]?.status === 'active',
            )
            .map((league) => ({ id: league.id, name: league.name }))
            .sort((a, b) => a.id.localeCompare(b.id)),
    [configured, user, leagues, memberships, activeLeagueId],
  );

  const targetsKey = targets.map((row) => `${row.id}:${row.name}`).join(',');

  useEffect(() => {
    if (targets.length === 0) {
      setEntries([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const [{ getDb }, api] = await Promise.all([
          import('../cloud/firestoreDb'),
          import('../cloud/leagueApi'),
        ]);
        const db = getDb();
        if (!db) {
          if (!cancelled) {
            setEntries([]);
            setLoading(false);
          }
          return;
        }

        const loaded: CachedRoster[] = [];
        const failures: string[] = [];

        await Promise.all(
          targets.map(async (league) => {
            const cached = rosterCache.get(league.id);
            if (cached) {
              loaded.push({
                ...cached,
                leagueName: league.name,
              });
              return;
            }
            try {
              const data = await api.loadLeagueRoster(db, league.id);
              const entry: CachedRoster = {
                leagueId: league.id,
                leagueName: league.name,
                data,
              };
              rosterCache.set(league.id, entry);
              loaded.push(entry);
            } catch {
              failures.push(league.name);
            }
          }),
        );

        if (cancelled) return;
        setEntries(
          loaded.sort((a, b) => a.leagueId.localeCompare(b.leagueId)),
        );
        setError(
          failures.length > 0
            ? `Could not load players from: ${failures.join(', ')}`
            : null,
        );
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setEntries([]);
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load player suggestions',
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targets, targetsKey]);

  const universe = useMemo(() => buildUniversePlayers(entries), [entries]);

  return { universe, loading, error };
}
