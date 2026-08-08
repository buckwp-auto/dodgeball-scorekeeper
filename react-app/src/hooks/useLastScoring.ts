import { useEffect, useMemo, useState } from 'react';
import {
  LAST_SCORING_EVENT,
  loadLastScoring,
  resolveLastScoring,
  type LastScoringLink,
} from '../domain/lastScoring';
import { useDatabase } from '../state/DatabaseContext';

/** Current resume target, or null if nothing is stored / still in this database. */
export function useLastScoring(): LastScoringLink | null {
  const { data } = useDatabase();
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

  return useMemo(() => resolveLastScoring(data, stored), [data, stored]);
}
