import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router';
import { isStatsImportedMatchId } from '../domain/importedMatch';
import { useDatabase } from '../state/DatabaseContext';

/** Redirect stats-imported matches away from Track Match / Track Game routes. */
export function ImportedMatchStatsGuard({ children }: { children: ReactNode }) {
  const { matchId = '' } = useParams();
  const { data } = useDatabase();

  if (matchId && isStatsImportedMatchId(data, matchId)) {
    return <Navigate to={`/matches/${matchId}/stats`} replace />;
  }

  return <>{children}</>;
}
