import { Box, Stack, Typography } from '@mui/material';
import { useMemo, type ReactNode } from 'react';
import {
  formatMatchRunningTime,
  isMatchRunningTimeEmpty,
  type MatchRunningTime,
} from '../domain/matchClock';
import { buildMatchSeries } from '../domain/statistics/teamStandings';
import { teamHeaderStyles } from '../domain/timelineColors';
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
  minimal,
  layout = 'centered',
  children,
}: {
  label: string;
  className: string;
  compact?: boolean;
  minimal?: boolean;
  layout?: 'centered' | 'inline';
  children: ReactNode;
}) {
  const labelSx = {
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(245, 247, 250, 0.55)',
    fontSize: minimal ? 8 : compact ? 9 : 11,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  } as const;

  if (layout === 'inline') {
    return (
      <Box
        className={className}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, auto) minmax(3.5rem, 1fr)',
          columnGap: minimal ? 0.75 : compact ? 1 : 1.25,
          alignItems: 'baseline',
          minWidth: 0,
        }}
      >
        <Typography variant="caption" sx={labelSx}>
          {label}
        </Typography>
        <Box sx={{ textAlign: 'right', minWidth: 0 }}>{children}</Box>
      </Box>
    );
  }

  return (
    <Box className={className} sx={{ textAlign: 'center', minWidth: 0, flex: 1, px: 0.5 }}>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          ...labelSx,
          mb: minimal ? 0 : 0.25,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function ScoreboardTeamRow({
  name,
  score,
  teamHome,
  className,
  compact,
  minimal,
  scoreDigitSize,
}: {
  name: string;
  score: number;
  teamHome: boolean;
  className?: string;
  compact?: boolean;
  minimal?: boolean;
  scoreDigitSize: string | { xs: string; sm: string };
}) {
  const nameColor = teamHeaderStyles(teamHome, 'dark').color;

  return (
    <Box
      className={className}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        columnGap: minimal ? 0.75 : compact ? 1 : 1.25,
        alignItems: 'baseline',
        minWidth: 0,
      }}
    >
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: minimal ? '0.8rem' : compact ? '0.95rem' : { xs: '1rem', sm: '1.15rem' },
          color: nameColor,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          lineHeight: 1.15,
        }}
      >
        {name}
      </Typography>
      <Typography
        sx={{
          ...digitSx,
          fontSize: scoreDigitSize,
          color: '#f5f7fa',
        }}
      >
        {score}
      </Typography>
    </Box>
  );
}

export function DigitalScoreboard({
  matchId,
  runningTime,
  gameRunningTime,
  remaining,
  compact = false,
  minimal = false,
}: {
  matchId: string;
  runningTime?: MatchRunningTime;
  gameRunningTime?: MatchRunningTime;
  remaining?: { home: number; away: number };
  compact?: boolean;
  /** Smallest footprint for Track Game stacked (tall / pop-out) layout. */
  minimal?: boolean;
}) {
  const { data } = useDatabase();
  const series = useMemo(() => buildMatchSeries(data, matchId), [data, matchId]);
  if (!series) return null;

  const showRemaining = remaining != null;
  const showMetrics = runningTime != null || gameRunningTime != null || showRemaining;
  const matchClockEmpty = runningTime != null && isMatchRunningTimeEmpty(runningTime);
  const gameClockEmpty =
    gameRunningTime != null && isMatchRunningTimeEmpty(gameRunningTime);
  const scoreDigitSize = minimal
    ? '1.05rem'
    : compact
      ? '1.5rem'
      : { xs: '1.65rem', sm: '2.1rem' };
  const metricDigitSize = minimal ? '0.85rem' : compact ? '1.05rem' : '1.2rem';

  const clockDigitSx = (empty: boolean) => ({
    ...digitSx,
    fontSize: empty
      ? minimal
        ? '0.7rem'
        : compact
          ? '0.8rem'
          : '0.9rem'
      : metricDigitSize,
    fontWeight: empty ? 600 : 700,
    color: empty ? 'rgba(245, 247, 250, 0.45)' : '#ffca28',
  });

  return (
    <Box
      className="sk-scoreboard"
      data-tour="scoreboard"
      sx={{
        ...boardSx,
        px: minimal ? 0.75 : compact ? 1 : 2,
        py: minimal ? 0.35 : compact ? 0.75 : 1.25,
        mb: minimal ? 0 : compact ? 0.75 : 1.5,
      }}
    >
      <Stack
        direction="row"
        spacing={minimal ? 1 : compact ? 1.25 : 2}
        sx={{ alignItems: 'center', minWidth: 0 }}
      >
        <Box
          className="sk-scoreboard-score"
          sx={{
            flex: 1,
            minWidth: 0,
            pr: showMetrics ? 0.5 : 0,
            ...(showMetrics ? null : { maxWidth: '20rem', mx: 'auto', width: '100%' }),
          }}
        >
          {!showMetrics ? (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textAlign: 'center',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(245, 247, 250, 0.55)',
                fontSize: minimal ? 8 : compact ? 9 : 11,
                mb: minimal ? 0 : 0.25,
              }}
            >
              Match score
            </Typography>
          ) : null}
          <Stack
            className="sk-match-score"
            spacing={minimal ? 0.1 : compact ? 0.15 : 0.2}
            sx={{ minWidth: 0 }}
          >
            <ScoreboardTeamRow
              name={series.homeTeam.Name}
              score={series.homeGameWins}
              teamHome
              className="sk-scoreboard-home"
              compact={compact}
              minimal={minimal}
              scoreDigitSize={scoreDigitSize}
            />
            <ScoreboardTeamRow
              name={series.awayTeam.Name}
              score={series.awayGameWins}
              teamHome={false}
              className="sk-scoreboard-away"
              compact={compact}
              minimal={minimal}
              scoreDigitSize={scoreDigitSize}
            />
            {series.ties > 0 ? (
              <Typography
                variant="caption"
                sx={{
                  textAlign: 'right',
                  color: 'rgba(245, 247, 250, 0.55)',
                  fontSize: minimal ? 8 : compact ? 9 : 11,
                  letterSpacing: '0.08em',
                }}
              >
                {series.ties} T
              </Typography>
            ) : null}
          </Stack>
        </Box>
        {showMetrics ? (
          <Stack
            className="sk-scoreboard-metrics"
            spacing={minimal ? 0.15 : compact ? 0.25 : 0.35}
            sx={{ flexShrink: 0, minWidth: minimal ? '7.5rem' : compact ? '8.5rem' : '10rem' }}
          >
            {runningTime ? (
              <ScoreboardCell
                label="Match time"
                className="sk-scoreboard-clock"
                compact={compact}
                minimal={minimal}
                layout="inline"
              >
                <Typography sx={clockDigitSx(matchClockEmpty)}>
                  {formatMatchRunningTime(runningTime)}
                </Typography>
              </ScoreboardCell>
            ) : null}
            {gameRunningTime ? (
              <ScoreboardCell
                label="Game time"
                className="sk-scoreboard-game-clock"
                compact={compact}
                minimal={minimal}
                layout="inline"
              >
                <Typography sx={clockDigitSx(gameClockEmpty)}>
                  {formatMatchRunningTime(gameRunningTime)}
                </Typography>
              </ScoreboardCell>
            ) : null}
            {showRemaining && remaining ? (
              <ScoreboardCell
                label="Remaining"
                className="sk-scoreboard-remaining"
                compact={compact}
                minimal={minimal}
                layout="inline"
              >
                <Typography
                  sx={{
                    ...digitSx,
                    fontSize: metricDigitSize,
                    color: '#7dd3fc',
                  }}
                >
                  {remaining.home} – {remaining.away}
                </Typography>
              </ScoreboardCell>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
