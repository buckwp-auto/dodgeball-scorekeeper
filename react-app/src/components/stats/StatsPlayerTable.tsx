import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useMemo, useState } from 'react';
import {
  LEADERBOARD_METRICS,
  filterAndSortDisplayStats,
  formatPct,
  formatRate,
  formatRecord,
  type DisplayPlayerStats,
  type LeaderboardMetric,
} from '../../domain/statistics/displayStats';

type SortKey =
  | 'team'
  | 'player'
  | LeaderboardMetric
  | 'gp'
  | 'wl'
  | 'deaths'
  | 'recoveries'
  | 'throws';

const metricSortKey: Record<LeaderboardMetric, SortKey> = {
  kills: 'kills',
  catches: 'catches',
  kd: 'kd',
  hitRate: 'hitRate',
  gamesWon: 'wl',
};

function compareRows(
  a: DisplayPlayerStats,
  b: DisplayPlayerStats,
  key: SortKey,
  direction: 'asc' | 'desc',
): number {
  const dir = direction === 'asc' ? 1 : -1;
  const cmp = (left: number | string | null, right: number | string | null) => {
    if (left == null && right == null) return a.playerName.localeCompare(b.playerName);
    if (left == null) return 1;
    if (right == null) return -1;
    if (left === right) return a.playerName.localeCompare(b.playerName);
    return left < right ? -1 * dir : 1 * dir;
  };
  switch (key) {
    case 'team':
      return cmp(a.teamName, b.teamName) || a.playerName.localeCompare(b.playerName);
    case 'player':
      return cmp(a.playerName, b.playerName);
    case 'gp':
      return cmp(a.gamesPlayed, b.gamesPlayed);
    case 'wl':
    case 'gamesWon':
      return cmp(a.gamesWon, b.gamesWon);
    case 'kills':
      return cmp(a.kills, b.kills);
    case 'deaths':
      return cmp(a.deaths, b.deaths);
    case 'kd':
      return cmp(a.kd, b.kd);
    case 'catches':
      return cmp(a.catches, b.catches);
    case 'recoveries':
      return cmp(a.recoveries, b.recoveries);
    case 'hitRate':
      return cmp(a.hitRate, b.hitRate);
    case 'throws':
      return cmp(a.throws, b.throws);
  }
}

export function StatsPlayerTable({
  rows,
  metric,
  onMetricChange,
  minGames,
  onMinGamesChange,
}: {
  rows: DisplayPlayerStats[];
  metric: LeaderboardMetric;
  onMetricChange: (metric: LeaderboardMetric) => void;
  minGames: number;
  onMinGamesChange: (minGames: number) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>(metricSortKey[metric]);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const onMetric = (_: unknown, next: LeaderboardMetric | null) => {
    if (!next) return;
    onMetricChange(next);
    setSortKey(metricSortKey[next]);
    setSortDirection('desc');
  };

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'team' || key === 'player' ? 'asc' : 'desc');
  };

  const visible = useMemo(() => {
    const filtered = filterAndSortDisplayStats(rows, { metric, minGames, direction: 'desc' });
    return [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDirection));
  }, [rows, metric, minGames, sortKey, sortDirection]);

  const header = (key: SortKey, label: string, align: 'left' | 'right' = 'right') => (
    <TableCell align={align} sortDirection={sortKey === key ? sortDirection : false}>
      <TableSortLabel
        active={sortKey === key}
        direction={sortKey === key ? sortDirection : 'asc'}
        onClick={() => onSort(key)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box className="sk-stats-players">
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
          mb: 2,
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={metric}
          onChange={onMetric}
          className="sk-stats-metric"
        >
          {LEADERBOARD_METRICS.map((item) => (
            <ToggleButton key={item.id} value={item.id}>
              {item.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          label="Min games"
          type="number"
          size="small"
          value={minGames}
          onChange={(event) =>
            onMinGamesChange(Math.max(0, Number.parseInt(event.target.value, 10) || 0))
          }
          slotProps={{ htmlInput: { min: 0 } }}
          sx={{ width: 120 }}
        />
      </Box>
      {visible.length === 0 ? (
        <p>No player statistics for this filter.</p>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" className="sk-grid sk-stats-table">
            <TableHead>
              <TableRow>
                {header('team', 'Team', 'left')}
                {header('player', 'Player', 'left')}
                {header('gp', 'GP')}
                {header('wl', 'W-L')}
                {header('kills', 'Kills')}
                {header('deaths', 'Deaths')}
                {header('kd', 'K/D')}
                {header('catches', 'Catches')}
                {header('recoveries', 'Recoveries')}
                {header('hitRate', 'Hit%')}
                {header('throws', 'Throws')}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.playerId}>
                  <TableCell>{row.teamName}</TableCell>
                  <TableCell>{row.playerName}</TableCell>
                  <TableCell align="right">{row.gamesPlayed}</TableCell>
                  <TableCell align="right">
                    {formatRecord(row.gamesWon, row.gamesLost, row.gamesTied)}
                  </TableCell>
                  <TableCell align="right">{row.kills}</TableCell>
                  <TableCell align="right">{row.deaths}</TableCell>
                  <TableCell align="right">{formatRate(row.kd)}</TableCell>
                  <TableCell align="right">{row.catches}</TableCell>
                  <TableCell align="right">{row.recoveries}</TableCell>
                  <TableCell align="right">{formatPct(row.hitRate)}</TableCell>
                  <TableCell align="right">{row.throws}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
