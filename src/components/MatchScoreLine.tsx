import { Typography } from '@mui/material';
import { useMemo } from 'react';
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

export function MatchScoreLine({
  matchId,
  variant = 'subtitle1',
}: {
  matchId: string;
  variant?: 'subtitle1' | 'subtitle2' | 'body2';
}) {
  const score = useMatchSeriesScore(matchId);
  if (!score) return null;
  return (
    <Typography
      variant={variant}
      className="sk-match-score"
      color="text.secondary"
      sx={{ mb: 1 }}
    >
      {score}
    </Typography>
  );
}
