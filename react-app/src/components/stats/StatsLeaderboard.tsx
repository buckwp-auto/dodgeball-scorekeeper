import {
  Box,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { getPlayer } from '../../domain/database';
import type { ImageRef } from '../../domain/imageRef';
import type { HighlightQualifierSettings } from '../../domain/leagueSettings';
import { playerHref } from '../../domain/playerProfile';
import {
  displayedDeaths,
  displayedKills,
  formatCountValue,
  formatPct1,
  formatRate,
  type DisplayPlayerStats,
  type StatsCountingMode,
} from '../../domain/statistics/displayStats';
import {
  HIGHLIGHT_FORMULAS,
  HIGHLIGHT_METRICS,
  formatHighlightQualifiers,
  highlightMetricValue,
  topHighlightPlayers,
  type HighlightMetric,
} from '../../domain/statistics/highlightStats';
import type { DatabaseDto } from '../../domain/types';
import { EntityAvatar } from '../EntityAvatar';

const NAVY = '#0b1f3a';
const NAVY_DEEP = '#071526';
const GOLD = '#f0c14b';

export function StatsLeaderboard({
  rows,
  counting,
  qualifiers,
  leagueName,
  leagueLogo,
  data,
}: {
  rows: DisplayPlayerStats[];
  counting: StatsCountingMode;
  qualifiers: HighlightQualifierSettings;
  leagueName?: string;
  leagueLogo?: ImageRef | null;
  data: DatabaseDto;
}) {
  const [metric, setMetric] = useState<HighlightMetric>('elusivenessRate');
  const meta = HIGHLIGHT_METRICS.find((item) => item.id === metric)!;
  const top5 = useMemo(
    () => topHighlightPlayers(rows, metric, { counting, qualifiers, limit: 5 }),
    [rows, metric, counting, qualifiers],
  );
  const first = top5[0];
  const second = top5[1];
  const third = top5[2];

  return (
    <Box className="sk-stats-leaderboard">
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
          onChange={(_, next: HighlightMetric | null) => {
            if (next) setMetric(next);
          }}
          className="sk-stats-highlight-metric"
          sx={{ flexWrap: 'wrap' }}
        >
          {HIGHLIGHT_METRICS.map((item) => (
            <ToggleButton key={item.id} value={item.id}>
              {item.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography
          variant="body2"
          color="text.secondary"
          className="sk-stats-leaderboard-qualifiers"
        >
          Minimums: {formatHighlightQualifiers(qualifiers)} ·{' '}
          <MuiLink component={Link} to="/settings" underline="hover">
            League Stat Settings
          </MuiLink>
        </Typography>
      </Box>

      {top5.length === 0 ? (
        <p>No player statistics for this filter.</p>
      ) : (
        <Box
          sx={{
            bgcolor: NAVY,
            color: '#fff',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(7, 21, 38, 0.35)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              pt: 2,
              pb: 0.5,
            }}
          >
            <EntityAvatar name={leagueName ?? 'League'} image={leagueLogo} size={48} />
            <Typography
              sx={{
                fontWeight: 800,
                letterSpacing: 1.5,
                fontSize: { xs: 12, sm: 14 },
                textAlign: 'right',
                textTransform: 'uppercase',
              }}
            >
              {leagueName ?? 'League'}
            </Typography>
          </Box>

          <Box
            className="sk-stats-leaderboard-podium"
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: { xs: 1, sm: 2 },
              px: 2,
              pt: 1,
              pb: 2,
              minHeight: { xs: 160, sm: 210 },
            }}
          >
            <PodiumSlot
              row={second}
              place={2}
              size={100}
              data={data}
              featured={false}
            />
            <PodiumSlot
              row={first}
              place={1}
              size={148}
              data={data}
              featured
            />
            <PodiumSlot
              row={third}
              place={3}
              size={100}
              data={data}
              featured={false}
            />
          </Box>

          <Box sx={{ display: 'flex', width: '100%' }}>
            <Box
              sx={{
                flex: 1,
                bgcolor: NAVY_DEEP,
                py: { xs: 1.25, sm: 1.75 },
                px: 2,
              }}
            >
              <Typography
                sx={{
                  color: '#fff',
                  fontWeight: 800,
                  letterSpacing: { xs: 1, sm: 2 },
                  fontSize: { xs: 16, sm: 28 },
                  lineHeight: 1.1,
                }}
              >
                {bannerLabel(meta.label)}
              </Typography>
            </Box>
            <Box
              sx={{
                flex: 1,
                bgcolor: GOLD,
                py: { xs: 1.25, sm: 1.75 },
                px: 2,
              }}
            >
              <Typography
                sx={{
                  color: NAVY,
                  fontWeight: 800,
                  letterSpacing: { xs: 1, sm: 2 },
                  fontSize: { xs: 16, sm: 28 },
                  lineHeight: 1.1,
                }}
              >
                LEADERBOARD
              </Typography>
            </Box>
          </Box>

          <Box sx={{ overflowX: 'auto', bgcolor: NAVY_DEEP }}>
            <Table size="small" className="sk-stats-leaderboard-table">
              <TableHead>
                <TableRow>
                  {leaderboardHeaders(metric).map((header) => (
                    <TableCell
                      key={header}
                      align={header === 'Player' || header === 'Rank' ? 'left' : 'center'}
                      sx={headerSx}
                    >
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {top5.map((row, index) => (
                  <TableRow key={row.playerId} className="sk-stats-leaderboard-row">
                    <TableCell sx={{ ...cellSx, color: GOLD, fontWeight: 800, fontSize: 22, width: 64 }}>
                      {index + 1}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Box
                        component={Link}
                        to={playerHref(row.playerId)}
                        sx={{ textDecoration: 'none' }}
                      >
                        <SplitName name={row.playerName} />
                      </Box>
                    </TableCell>
                    {leaderboardCells(row, metric, counting).map((cell) => (
                      <TableCell
                        key={cell.key}
                        align="center"
                        sx={{
                          ...cellSx,
                          fontWeight: cell.primary ? 800 : 600,
                          fontSize: cell.primary ? 18 : 14,
                        }}
                      >
                        {cell.text}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          <Typography
            sx={{
              px: 2,
              py: 1.5,
              fontSize: 11,
              letterSpacing: 0.6,
              color: 'rgba(255,255,255,0.55)',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            {HIGHLIGHT_FORMULAS[metric]}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function PodiumSlot({
  row,
  place,
  size,
  data,
  featured,
}: {
  row?: DisplayPlayerStats;
  place: 1 | 2 | 3;
  size: number;
  data: DatabaseDto;
  featured: boolean;
}) {
  if (!row) {
    return <Box sx={{ width: size, flexShrink: 0 }} />;
  }
  const player = getPlayer(data, row.playerId);
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: featured ? 2 : 1,
        mb: featured ? 0 : 1.5,
        flex: featured ? '0 0 auto' : '0 1 auto',
      }}
    >
      <Box
        component={Link}
        to={playerHref(row.playerId)}
        sx={{
          textDecoration: 'none',
          borderRadius: '50%',
          boxShadow: featured
            ? `0 0 0 4px ${GOLD}, 0 10px 28px rgba(0,0,0,0.45)`
            : '0 6px 16px rgba(0,0,0,0.35)',
        }}
      >
        <EntityAvatar
          name={row.playerName}
          image={player?.Image}
          size={size}
        />
      </Box>
      <Typography
        sx={{
          mt: 1,
          fontWeight: 800,
          fontSize: featured ? 13 : 11,
          letterSpacing: 0.8,
          color: GOLD,
        }}
      >
        #{place}
      </Typography>
    </Box>
  );
}

function SplitName({ name }: { name: string }) {
  const trimmed = name.trim();
  const index = trimmed.indexOf(' ');
  const first = index < 0 ? trimmed : trimmed.slice(0, index);
  const last = index < 0 ? '' : trimmed.slice(index + 1);
  return (
    <Box component="span" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
      <Box component="span" sx={{ color: '#fff' }}>
        {first.toUpperCase()}
      </Box>
      {last ? (
        <>
          {' '}
          <Box component="span" sx={{ color: GOLD }}>
            {last.toUpperCase()}
          </Box>
        </>
      ) : null}
    </Box>
  );
}

function bannerLabel(label: string): string {
  return label.replace(/\s*%$/, '').replace(/\s*score$/i, '').toUpperCase();
}

const headerSx = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  borderColor: 'rgba(255,255,255,0.08)',
  py: 1,
};

const cellSx = {
  color: '#fff',
  borderColor: 'rgba(255,255,255,0.08)',
  py: 1.25,
};

function leaderboardHeaders(metric: HighlightMetric): string[] {
  switch (metric) {
    case 'caughtRate':
      return ['Rank', 'Player', 'Throws', 'Caught', 'Caught %'];
    case 'catchRate':
      return ['Rank', 'Player', 'Targeted', 'Catches', 'Catch %'];
    case 'elusivenessRate':
      return ['Rank', 'Player', 'Targeted', 'Hit', 'Elusiveness %'];
    case 'efficiencyRate':
      return ['Rank', 'Player', 'Throws', 'Kills', 'Efficiency %'];
    case 'netScore':
      return ['Rank', 'Player', 'Catches', 'Kills', 'Elim', 'Caught', 'Net'];
    case 'vor':
      return ['Rank', 'Player', 'VOR', 'WAR'];
    case 'war':
      return ['Rank', 'Player', 'VOR', 'WAR'];
  }
}

function leaderboardCells(
  row: DisplayPlayerStats,
  metric: HighlightMetric,
  counting: StatsCountingMode,
): { key: string; text: string; primary?: boolean }[] {
  switch (metric) {
    case 'caughtRate':
      return [
        { key: 'throws', text: String(row.throws) },
        { key: 'caught', text: String(row.catchesThrown) },
        { key: 'pct', text: formatPct1(row.caughtRate), primary: true },
      ];
    case 'catchRate':
      return [
        { key: 'targets', text: String(row.targets) },
        { key: 'catches', text: String(row.catches) },
        { key: 'pct', text: formatPct1(row.catchRate), primary: true },
      ];
    case 'elusivenessRate':
      return [
        { key: 'targets', text: String(row.targets) },
        { key: 'hits', text: String(row.targetHits) },
        { key: 'pct', text: formatPct1(row.elusivenessRate), primary: true },
      ];
    case 'efficiencyRate':
      return [
        { key: 'throws', text: String(row.throws) },
        { key: 'kills', text: formatCountValue(displayedKills(row, counting)) },
        {
          key: 'pct',
          text: formatPct1(highlightMetricValue(row, 'efficiencyRate', counting)),
          primary: true,
        },
      ];
    case 'netScore':
      return [
        { key: 'catches', text: String(row.catches) },
        { key: 'kills', text: formatCountValue(displayedKills(row, counting)) },
        { key: 'elim', text: formatCountValue(displayedDeaths(row, counting)) },
        { key: 'caught', text: String(row.catchesThrown) },
        {
          key: 'net',
          text: formatCountValue(highlightMetricValue(row, 'netScore', counting) ?? 0),
          primary: true,
        },
      ];
    case 'vor':
    case 'war':
      return [
        { key: 'vor', text: formatRate(row.vor), primary: metric === 'vor' },
        { key: 'war', text: formatRate(row.war), primary: metric === 'war' },
      ];
  }
}
