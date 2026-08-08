import { Box, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import {
  LEADERBOARD_METRICS,
  aggregateThrowMix,
  buildSideComparison,
  filterAndSortDisplayStats,
  metricValue,
  type DisplayPlayerStats,
  type LeaderboardMetric,
  type StatsCountingMode,
} from '../../domain/statistics/displayStats';
import type { EliminationTimelinePoint } from '../../domain/gameElimination';

const TOP_N = 10;

function chartValue(
  row: DisplayPlayerStats,
  metric: LeaderboardMetric,
  counting: StatsCountingMode,
): number | null {
  const value = metricValue(row, metric, counting);
  if (value == null || !Number.isFinite(value)) return null;
  if (metric === 'hitRate') return Math.round(value * 1000) / 10;
  return value;
}

export function StatsCharts({
  rows,
  metric,
  minGames,
  counting = 'counts',
  homeTeamName,
  awayTeamName,
  timeline,
}: {
  rows: DisplayPlayerStats[];
  metric: LeaderboardMetric;
  minGames: number;
  counting?: StatsCountingMode;
  homeTeamName?: string;
  awayTeamName?: string;
  timeline?: EliminationTimelinePoint[];
}) {
  const metricLabel =
    LEADERBOARD_METRICS.find((item) => item.id === metric)?.label ?? 'Kills';
  const ranked = filterAndSortDisplayStats(rows, { metric, minGames, counting }).slice(
    0,
    TOP_N,
  );
  const barPlayers = ranked
    .map((row) => ({ name: row.playerName, value: chartValue(row, metric, counting) }))
    .filter((row): row is { name: string; value: number } => row.value != null);
  const throwMix = aggregateThrowMix(rows);
  const comparison = buildSideComparison(rows, counting);

  return (
    <Box className="sk-stats-charts" sx={{ display: 'grid', gap: 3 }}>
      {barPlayers.length > 0 ? (
        <Box>
          <Typography variant="h6" gutterBottom>
            Top {metricLabel}
          </Typography>
          <BarChart
            layout="horizontal"
            height={Math.max(240, barPlayers.length * 36)}
            yAxis={[{ data: barPlayers.map((row) => row.name), scaleType: 'band' }]}
            series={[{ data: barPlayers.map((row) => row.value), label: metricLabel }]}
            hideLegend
          />
        </Box>
      ) : null}

      {throwMix.length > 0 ? (
        <Box>
          <Typography variant="h6" gutterBottom>
            Throw result mix
          </Typography>
          <PieChart
            height={280}
            series={[
              {
                data: throwMix.map((slice, index) => ({
                  id: index,
                  value: slice.count,
                  label: slice.label,
                })),
                innerRadius: 50,
                paddingAngle: 1,
              },
            ]}
          />
        </Box>
      ) : null}

      {comparison ? (
        <Box>
          <Typography variant="h6" gutterBottom>
            Home vs away
          </Typography>
          <BarChart
            height={280}
            xAxis={[{ data: comparison.map((row) => row.metric), scaleType: 'band' }]}
            series={[
              { data: comparison.map((row) => row.home), label: homeTeamName ?? 'Home' },
              { data: comparison.map((row) => row.away), label: awayTeamName ?? 'Away' },
            ]}
          />
        </Box>
      ) : null}

      {timeline && timeline.length > 1 ? (
        <Box>
          <Typography variant="h6" gutterBottom>
            Players remaining
          </Typography>
          <LineChart
            height={280}
            xAxis={[{ data: timeline.map((point) => point.ordinal), label: 'Event' }]}
            series={[
              {
                data: timeline.map((point) => point.activeHome),
                label: homeTeamName ?? 'Home',
              },
              {
                data: timeline.map((point) => point.activeAway),
                label: awayTeamName ?? 'Away',
              },
            ]}
          />
        </Box>
      ) : null}

      {barPlayers.length === 0 && throwMix.length === 0 && !comparison ? (
        <p>No chart data for this filter.</p>
      ) : null}
    </Box>
  );
}
