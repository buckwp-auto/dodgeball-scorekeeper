import { Box, Stack, Typography } from '@mui/material';
import { useMemo, type ReactNode } from 'react';
import {
  formatMatchRunningTime,
  isMatchRunningTimeEmpty,
  type MatchRunningTime,
} from '../domain/matchClock';
import {
  buildMatchSeries,
  formatMatchSeriesScore,
} from '../domain/statistics/teamStandings';
import { useDatabase } from '../state/DatabaseContext';

const boardSx = {
  bgcolor: '#0b1524',
  color: '#f5f7fa',
  border: '1px solid #1565c0',
  borderRadius: 1,
} as const;

const digitSx = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 700,
  letterSpacing: '0.04em',
  lineHeight: 1.15,
} as const;

function ScoreboardCell({
  label,
  className,
  compact,
  children,
}: {
  label: string;
  className: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <Box className={className} sx={{ textAlign: 'center', minWidth: 0, flex: 1, px: 0.5 }}>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(245, 247, 250, 0.55)',
          fontSize: compact ? 9 : 11,
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export function DigitalScoreboard({
  matchId,
  runningTime,
  remaining,
  compact = false,
}: {
  matchId: string;
  runningTime?: MatchRunningTime;
  remaining?: { home: number; away: number };
  compact?: boolean;
}) {
  const { data } = useDatabase();
  const series = useMemo(() => buildMatchSeries(data, matchId), [data, matchId]);
  if (!series) return null;

  const score = formatMatchSeriesScore(series);
  const showRemaining = remaining != null;
  const clockEmpty = runningTime != null && isMatchRunningTimeEmpty(runningTime);
  const digitSize = compact ? '1.35rem' : { xs: '1.5rem', sm: '2rem' };

  return (
    <Box
      className="sk-scoreboard"
      sx={{
        ...boardSx,
        px: compact ? 1 : 2,
        py: compact ? 0.75 : 1.25,
        mb: compact ? 0.75 : 1.5,
      }}
    >
      <Stack
        direction="row"
        spacing={compact ? 1 : 2}
        sx={{ alignItems: 'stretch', justifyContent: 'space-around', flexWrap: 'wrap', rowGap: 1 }}
      >
        <ScoreboardCell label="Match score" className="sk-scoreboard-score" compact={compact}>
          <Typography
            className="sk-match-score"
            sx={{
              ...digitSx,
              fontSize: digitSize,
              color: '#f5f7fa',
            }}
          >
            {score}
          </Typography>
        </ScoreboardCell>
        {runningTime ? (
          <ScoreboardCell label="Match time" className="sk-scoreboard-clock" compact={compact}>
            <Typography
              sx={{
                ...digitSx,
                fontSize: clockEmpty ? (compact ? '0.85rem' : '1rem') : digitSize,
                fontWeight: clockEmpty ? 600 : 700,
                color: clockEmpty ? 'rgba(245, 247, 250, 0.45)' : '#ffca28',
              }}
            >
              {formatMatchRunningTime(runningTime)}
            </Typography>
          </ScoreboardCell>
        ) : null}
        {showRemaining && remaining ? (
          <ScoreboardCell
            label="Players remaining"
            className="sk-scoreboard-remaining"
            compact={compact}
          >
            <Typography
              sx={{
                ...digitSx,
                fontSize: digitSize,
                color: '#7dd3fc',
              }}
            >
              {remaining.home} – {remaining.away}
            </Typography>
          </ScoreboardCell>
        ) : null}
      </Stack>
    </Box>
  );
}
