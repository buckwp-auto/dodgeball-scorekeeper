import { useMemo } from 'react';
import { DigitalScoreboard } from './DigitalScoreboard';
import {
  buildMatchSeries,
  formatMatchSeriesScore,
} from '../domain/statistics/teamStandings';
import { useDatabase } from '../state/DatabaseContext';

export function useMatchSeriesScore(matchId: string): string | null {
  const { data } = useDatabase();
  const series = useMemo(() => buildMatchSeries(data, matchId), [data, matchId]);
  return series ? formatMatchSeriesScore(series) : null;
}

export function MatchScoreLine({ matchId }: { matchId: string }) {
  return <DigitalScoreboard matchId={matchId} />;
}
