import { useEffect, useMemo, useState } from 'react';
import {
  LAST_SCORING_EVENT,
  loadLastScoring,
  resolveLastScoring,
  type LastScoringLink,
  type LastScoringStored,
} from '../domain/lastScoring';
import { useDatabase } from '../state/DatabaseContext';

/** Raw last-scoring preference from localStorage (updates on remember + storage). */
export function useLastScoringStored(): LastScoringStored | null {
  const [stored, setStored] = useState(loadLastScoring);

  useEffect(() => {
    const refresh = () => setStored(loadLastScoring());
    window.addEventListener(LAST_SCORING_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LAST_SCORING_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return stored;
}

/** Current resume target, or null if nothing is stored / still in this database. */
export function useLastScoring(): LastScoringLink | null {
  const { data } = useDatabase();
  const stored = useLastScoringStored();

  return useMemo(() => resolveLastScoring(data, stored), [data, stored]);
}
