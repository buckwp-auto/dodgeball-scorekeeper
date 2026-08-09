import {
  Box,
  Link as MuiLink,
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
import { Link } from 'react-router';
import { playerHref } from '../../domain/playerProfile';
import {
  LEADERBOARD_METRICS,
  displayedDeaths,
  displayedKd,
  displayedKills,
  filterAndSortDisplayStats,
  formatCountValue,
  formatPct,
  formatRate,
  formatRecord,
  type DisplayPlayerStats,
  type LeaderboardMetric,
  type StatsCountingMode,
} from '../../domain/statistics/displayStats';

type SortKey =
  | 'team'
  | 'player'
  | LeaderboardMetric
  | 'gp'
  | 'wl'
  | 'deaths'
  | 'assists'
  | 'doubleKills'
  | 'tripleKills'
  | 'quadKills'
  | 'doubleCatches'
  | 'tripleCatches'
  | 'quadCatches'
  | 'catchesDeflection'
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
  counting: StatsCountingMode,
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
      return cmp(displayedKills(a, counting), displayedKills(b, counting));
    case 'deaths':
      return cmp(displayedDeaths(a, counting), displayedDeaths(b, counting));
    case 'kd':
      return cmp(displayedKd(a, counting), displayedKd(b, counting));
    case 'assists':
      return cmp(a.assists, b.assists);
    case 'doubleKills':
      return cmp(a.doubleKills, b.doubleKills);
    case 'tripleKills':
      return cmp(a.tripleKills, b.tripleKills);
    case 'quadKills':
      return cmp(a.quadKills, b.quadKills);
    case 'doubleCatches':
      return cmp(a.doubleCatches, b.doubleCatches);
    case 'tripleCatches':
      return cmp(a.tripleCatches, b.tripleCatches);
    case 'quadCatches':
      return cmp(a.quadCatches, b.quadCatches);
    case 'catchesDeflection':
      return cmp(a.catchesDeflection, b.catchesDeflection);
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
  counting,
  showAssists,
  showMultiKills,
  showMultiCatches,
  showDeflectionCatches,
  hideFilters = false,
}: {
  rows: DisplayPlayerStats[];
  metric: LeaderboardMetric;
  onMetricChange: (metric: LeaderboardMetric) => void;
  minGames: number;
  onMinGamesChange: (minGames: number) => void;
  counting: StatsCountingMode;
  showAssists: boolean;
  showMultiKills: boolean;
  showMultiCatches: boolean;
  showDeflectionCatches: boolean;
  hideFilters?: boolean;
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
    if (hideFilters) return rows;
    const filtered = filterAndSortDisplayStats(rows, {
      metric,
      minGames,
      direction: 'desc',
      counting,
    });
    return [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDirection, counting));
  }, [rows, metric, minGames, sortKey, sortDirection, counting, hideFilters]);

  const header = (key: SortKey, label: string, align: 'left' | 'center' = 'center') => (
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
      {hideFilters ? null : (
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
      )}
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
                {showAssists ? header('assists', 'Ast') : null}
                {showMultiKills ? header('doubleKills', 'Dbl') : null}
                {showMultiKills ? header('tripleKills', 'Trp') : null}
                {showMultiKills ? header('quadKills', 'Quad') : null}
                {header('catches', 'Catches')}
                {showDeflectionCatches ? header('catchesDeflection', 'Defl. catches') : null}
                {showMultiCatches ? header('doubleCatches', '2x catch') : null}
                {showMultiCatches ? header('tripleCatches', '3x catch') : null}
                {showMultiCatches ? header('quadCatches', '4x catch') : null}
                {header('recoveries', 'Recoveries')}
                {header('hitRate', 'Hit%')}
                {header('throws', 'Throws')}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.playerId}>
                  <TableCell>{row.teamName}</TableCell>
                  <TableCell>
                    <MuiLink
                      component={Link}
                      to={playerHref(row.playerId)}
                      underline="hover"
                    >
                      {row.playerName}
                    </MuiLink>
                  </TableCell>
                  <TableCell align="center">{row.gamesPlayed}</TableCell>
                  <TableCell align="center">
                    {formatRecord(row.gamesWon, row.gamesLost, row.gamesTied)}
                  </TableCell>
                  <TableCell align="center">
                    {formatCountValue(displayedKills(row, counting))}
                  </TableCell>
                  <TableCell align="center">
                    {formatCountValue(displayedDeaths(row, counting))}
                  </TableCell>
                  <TableCell align="center">{formatRate(displayedKd(row, counting))}</TableCell>
                  {showAssists ? <TableCell align="center">{row.assists}</TableCell> : null}
                  {showMultiKills ? <TableCell align="center">{row.doubleKills}</TableCell> : null}
                  {showMultiKills ? <TableCell align="center">{row.tripleKills}</TableCell> : null}
                  {showMultiKills ? <TableCell align="center">{row.quadKills}</TableCell> : null}
                  <TableCell align="center">{row.catches}</TableCell>
                  {showDeflectionCatches ? (
                    <TableCell align="center">{row.catchesDeflection}</TableCell>
                  ) : null}
                  {showMultiCatches ? (
                    <TableCell align="center">{row.doubleCatches}</TableCell>
                  ) : null}
                  {showMultiCatches ? (
                    <TableCell align="center">{row.tripleCatches}</TableCell>
                  ) : null}
                  {showMultiCatches ? (
                    <TableCell align="center">{row.quadCatches}</TableCell>
                  ) : null}
                  <TableCell align="center">{row.recoveries}</TableCell>
                  <TableCell align="center">{formatPct(row.hitRate)}</TableCell>
                  <TableCell align="center">{row.throws}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
