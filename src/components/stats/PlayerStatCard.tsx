import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import {
  Box,
  Chip,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link } from 'react-router';
import type { ImageRef } from '../../domain/imageRef';
import {
  formatCountValue,
  formatPct1,
  formatRate,
} from '../../domain/statistics/displayStats';
import type {
  PlayerCard,
  PlayerCardRank,
  PlayerCardStatFormat,
} from '../../domain/statistics/playerCard';
import { EntityAvatar } from '../EntityAvatar';
import {
  BRONZE,
  GOLD,
  NAVY,
  NAVY_DEEP,
  RANK_BOTTOM,
  RANK_TOP,
  SILVER,
  SplitName,
} from './leaderboardStyle';

export type PlayerCardBasic = {
  label: string;
  value: string;
  rank: PlayerCardRank | null;
};

const MEDAL_COLORS = { 1: GOLD, 2: SILVER, 3: BRONZE } as const;

export function PlayerStatCard({
  playerName,
  image,
  photoSrc,
  team,
  addedFromMatch,
  leagueName,
  leagueLogo,
  card,
  basics,
  qualifierText,
}: {
  playerName: string;
  image?: ImageRef | null;
  photoSrc?: string | null;
  team?: { name: string; href?: string };
  addedFromMatch?: boolean;
  leagueName?: string;
  leagueLogo?: ImageRef | null;
  card: PlayerCard | null;
  basics: PlayerCardBasic[];
  qualifierText: string;
}) {
  return (
    <Box
      className="sk-player-card"
      sx={{
        bgcolor: NAVY,
        color: '#fff',
        borderRadius: 3,
        p: 0.75,
        border: `3px solid ${GOLD}`,
        boxShadow: '0 12px 40px rgba(7, 21, 38, 0.35)',
        maxWidth: 820,
        mb: 3,
      }}
    >
      <Box
        sx={{
          borderRadius: 2,
          border: '1px solid rgba(240, 193, 75, 0.35)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            pt: 1.5,
            pb: 0.5,
          }}
        >
          <EntityAvatar name={leagueName ?? 'League'} image={leagueLogo} size={40} />
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
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: 2,
            px: 2,
            py: 1.5,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 1,
              minWidth: 0,
            }}
          >
            <CardPhoto name={playerName} image={image} photoSrc={photoSrc} />
            <Typography
              sx={{
                fontSize: { xs: 20, sm: 26 },
                lineHeight: 1.1,
                mt: 0.5,
                overflowWrap: 'anywhere',
              }}
            >
              <SplitName name={playerName} />
            </Typography>
            {team ? (
              <Typography
                sx={{
                  fontWeight: 700,
                  letterSpacing: 1,
                  fontSize: 13,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {team.href ? (
                  <MuiLink
                    component={Link}
                    to={team.href}
                    underline="hover"
                    sx={{ color: 'inherit' }}
                  >
                    {team.name}
                  </MuiLink>
                ) : (
                  team.name
                )}
              </Typography>
            ) : null}
            {addedFromMatch ? (
              <Chip
                size="small"
                label="Added from match"
                className="sk-player-added-from-match"
                sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }}
              />
            ) : null}
          </Box>
          <PowerGraph card={card} />
        </Box>

        <Box sx={{ display: 'flex', width: '100%' }}>
          <Box sx={{ flex: 1, bgcolor: NAVY_DEEP, py: { xs: 1, sm: 1.25 }, px: 2 }}>
            <Typography sx={bannerSx}>PLAYER</Typography>
          </Box>
          <Box sx={{ flex: 1, bgcolor: GOLD, py: { xs: 1, sm: 1.25 }, px: 2 }}>
            <Typography sx={{ ...bannerSx, color: NAVY }}>STAT CARD</Typography>
          </Box>
        </Box>

        <Box sx={{ bgcolor: NAVY_DEEP }}>
          {basics.length > 0 ? (
            <Box
              className="sk-player-card-basics"
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${basics.length}, 1fr)`,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {basics.map((basic) => (
                <Box key={basic.label} sx={{ textAlign: 'center', py: 1.25, px: 0.5 }}>
                  <Typography sx={headerTextSx}>{basic.label}</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>
                    {basic.value}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: 20 }}>
                    {basic.rank ? <RankBadge rank={basic.rank} size="small" /> : null}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : null}

          {card ? (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" className="sk-player-card-table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={headerSx}>Stat</TableCell>
                    <TableCell align="center" sx={headerSx}>
                      Value
                    </TableCell>
                    <TableCell align="left" sx={headerSx}>
                      League rank
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {card.stats.map((stat) => (
                    <TableRow key={stat.id} className="sk-player-card-row">
                      <TableCell
                        sx={{
                          ...cellSx,
                          fontWeight: 800,
                          letterSpacing: 0.8,
                          textTransform: 'uppercase',
                          fontSize: 13,
                        }}
                      >
                        {stat.label}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ ...cellSx, fontWeight: 800, fontSize: 18 }}
                      >
                        {formatCardValue(stat.value, stat.format)}
                      </TableCell>
                      <TableCell sx={{ ...cellSx, width: '40%' }}>
                        {stat.rank ? (
                          <RankBadge rank={stat.rank} />
                        ) : (
                          <Typography
                            component="span"
                            sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}
                          >
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : (
            <Typography sx={{ px: 2, py: 2, color: 'rgba(255,255,255,0.7)' }}>
              No scored games yet for this player.
            </Typography>
          )}

          <Typography
            className="sk-player-card-qualifiers"
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
            {card && !card.qualified
              ? `Unranked — below league minimums (${qualifierText})`
              : `Ranked among players meeting league minimums (${qualifierText})`}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function CardPhoto({
  name,
  image,
  photoSrc,
}: {
  name: string;
  image?: ImageRef | null;
  photoSrc?: string | null;
}) {
  const frameSx = {
    borderRadius: 2,
    border: `3px solid ${GOLD}`,
    boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
    overflow: 'hidden',
    display: 'block',
    flexShrink: 0,
  };
  if (!photoSrc) {
    return (
      <Box sx={{ ...frameSx, borderRadius: '50%' }}>
        <EntityAvatar name={name} image={image} size={150} />
      </Box>
    );
  }
  return (
    <Box component="a" href={photoSrc} target="_blank" rel="noreferrer" sx={frameSx}>
      <Box
        component="img"
        src={photoSrc}
        alt=""
        referrerPolicy="no-referrer"
        sx={{
          width: { xs: 130, sm: 170 },
          height: { xs: 130, sm: 170 },
          objectFit: 'cover',
          display: 'block',
          background: 'linear-gradient(160deg, #e9eef5 0%, #b8c5d6 100%)',
        }}
      />
    </Box>
  );
}

function RankBadge({
  rank,
  size = 'medium',
}: {
  rank: PlayerCardRank;
  size?: 'small' | 'medium';
}) {
  const small = size === 'small';
  return (
    <Box
      component="span"
      className="sk-player-card-rank"
      data-tier={rank.tier ?? undefined}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
    >
      <Box
        component="span"
        sx={{
          fontWeight: 800,
          fontSize: small ? 13 : 18,
          color: rankColor(rank),
        }}
      >
        #{rank.rank}
      </Box>
      <Box
        component="span"
        sx={{ fontSize: small ? 11 : 12, color: 'rgba(255,255,255,0.5)' }}
      >
        of {rank.total}
      </Box>
      {rank.medal ? (
        <MilitaryTechIcon
          className="sk-player-card-medal"
          aria-label={medalLabel(rank.medal)}
          sx={{ fontSize: small ? 16 : 22, color: MEDAL_COLORS[rank.medal] }}
        />
      ) : null}
    </Box>
  );
}

const RADAR_WIDTH = 380;
const RADAR_HEIGHT = 290;
const RADAR_CX = RADAR_WIDTH / 2;
const RADAR_CY = RADAR_HEIGHT / 2;
const RADAR_RADIUS = 92;

function PowerGraph({ card }: { card: PlayerCard | null }) {
  const axes = card?.radar ?? [];
  const count = axes.length || 6;
  const point = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    return {
      x: RADAR_CX + Math.cos(angle) * RADAR_RADIUS * scale,
      y: RADAR_CY + Math.sin(angle) * RADAR_RADIUS * scale,
    };
  };
  const ring = (scale: number) =>
    Array.from({ length: count }, (_, index) => {
      const p = point(index, scale);
      return `${p.x},${p.y}`;
    }).join(' ');
  const ranked = Boolean(card?.qualified) && axes.some((axis) => axis.rank);
  const shape = axes
    .map((axis, index) => {
      const p = point(index, axis.rank?.strength ?? 0);
      return `${p.x},${p.y}`;
    })
    .join(' ');
  const summary = ranked
    ? axes
        .map((axis) =>
          axis.rank
            ? `${axis.label} #${axis.rank.rank} of ${axis.rank.total}`
            : `${axis.label} unranked`,
        )
        .join(', ')
    : 'Unranked';

  return (
    <Box
      className="sk-player-card-power"
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <Box
        component="svg"
        viewBox={`0 0 ${RADAR_WIDTH} ${RADAR_HEIGHT}`}
        role="img"
        aria-label={`Power graph: ${summary}`}
        sx={{
          width: { xs: 300, sm: RADAR_WIDTH },
          maxWidth: '100%',
          height: 'auto',
          display: 'block',
        }}
      >
        <circle
          cx={RADAR_CX}
          cy={RADAR_CY}
          r={RADAR_RADIUS}
          fill="none"
          stroke="rgba(240,193,75,0.35)"
          strokeDasharray="3 4"
        />
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={ring(scale)}
            fill={scale === 1 ? 'rgba(255,255,255,0.04)' : 'none'}
            stroke="rgba(255,255,255,0.14)"
          />
        ))}
        {Array.from({ length: count }, (_, index) => {
          const p = point(index, 1);
          return (
            <line
              key={index}
              x1={RADAR_CX}
              y1={RADAR_CY}
              x2={p.x}
              y2={p.y}
              stroke="rgba(255,255,255,0.14)"
            />
          );
        })}
        {ranked ? (
          <>
            <polygon
              points={shape}
              fill="rgba(240,193,75,0.35)"
              stroke={GOLD}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {axes.map((axis, index) => {
              if (!axis.rank) return null;
              const p = point(index, axis.rank.strength);
              return (
                <circle
                  key={axis.id}
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill={rankColor(axis.rank, GOLD)}
                  stroke={NAVY}
                  strokeWidth={1.5}
                />
              );
            })}
          </>
        ) : (
          <text
            x={RADAR_CX}
            y={RADAR_CY + 4}
            textAnchor="middle"
            fill="rgba(255,255,255,0.55)"
            fontSize={12}
            fontWeight={800}
            letterSpacing={1.5}
          >
            UNRANKED
          </text>
        )}
        {axes.map((axis, index) => {
          const p = point(index, 1.28);
          const anchor =
            Math.abs(p.x - RADAR_CX) < 4 ? 'middle' : p.x > RADAR_CX ? 'start' : 'end';
          const dx = anchor === 'start' ? -10 : anchor === 'end' ? 10 : 0;
          return (
            <text
              key={axis.id}
              x={p.x + dx}
              y={p.y}
              textAnchor={anchor}
              fontWeight={800}
              letterSpacing={0.8}
            >
              <tspan x={p.x + dx} dy={-2} fontSize={10} fill="rgba(255,255,255,0.7)">
                {axis.label.toUpperCase()}
              </tspan>
              <tspan
                x={p.x + dx}
                dy={13}
                fontSize={12}
                fill={axis.rank && ranked ? rankColor(axis.rank) : 'rgba(255,255,255,0.35)'}
              >
                {axis.rank && ranked ? `#${axis.rank.rank}` : '—'}
              </tspan>
            </text>
          );
        })}
      </Box>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        Power graph · edge = #1
      </Typography>
    </Box>
  );
}

function rankColor(rank: PlayerCardRank, fallback = '#fff'): string {
  if (rank.tier === 'top') return RANK_TOP;
  if (rank.tier === 'bottom') return RANK_BOTTOM;
  return fallback;
}

function medalLabel(medal: 1 | 2 | 3): string {
  return medal === 1 ? 'Gold medal' : medal === 2 ? 'Silver medal' : 'Bronze medal';
}

function formatCardValue(value: number | null, format: PlayerCardStatFormat): string {
  if (format === 'pct') return formatPct1(value);
  if (format === 'rate') return formatRate(value);
  return value == null ? '—' : formatCountValue(value);
}

const bannerSx = {
  color: '#fff',
  fontWeight: 800,
  letterSpacing: { xs: 1, sm: 2 },
  fontSize: { xs: 16, sm: 24 },
  lineHeight: 1.1,
};

const headerTextSx = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
};

const headerSx = {
  ...headerTextSx,
  borderColor: 'rgba(255,255,255,0.08)',
  py: 1,
};

const cellSx = {
  color: '#fff',
  borderColor: 'rgba(255,255,255,0.08)',
  py: 1,
};
