import {
  DEFAULT_HIGHLIGHT_QUALIFIERS,
  type HighlightQualifierSettings,
} from '../leagueSettings';
import type { Guid } from '../types';
import type { DisplayPlayerStats, StatsCountingMode } from './displayStats';
import {
  highlightMetricValue,
  playerMeetsHighlightQualifiers,
  type HighlightMetric,
} from './highlightStats';

export type PlayerCardStatId = HighlightMetric | 'caught';

export type PlayerCardStatFormat = 'pct' | 'count' | 'rate';

export const PLAYER_CARD_STATS: {
  id: PlayerCardStatId;
  label: string;
  format: PlayerCardStatFormat;
  higherIsBetter: boolean;
}[] = [
  { id: 'elusivenessRate', label: 'Elusiveness %', format: 'pct', higherIsBetter: true },
  { id: 'catchRate', label: 'Catch %', format: 'pct', higherIsBetter: true },
  { id: 'caught', label: 'Caught', format: 'count', higherIsBetter: false },
  { id: 'caughtRate', label: 'Caught %', format: 'pct', higherIsBetter: false },
  { id: 'efficiencyRate', label: 'Efficiency %', format: 'pct', higherIsBetter: true },
  { id: 'netScore', label: 'Net score', format: 'count', higherIsBetter: true },
  { id: 'vor', label: 'VOR', format: 'rate', higherIsBetter: true },
  { id: 'war', label: 'WAR', format: 'rate', higherIsBetter: true },
];

/**
 * Hexagon axes, clockwise from the top. WAR is VOR / 6 (same rank) and Caught
 * count overlaps Caught %, so six axes cover every distinct ranking.
 */
export const PLAYER_CARD_RADAR_AXES: { id: PlayerCardStatId; label: string }[] = [
  { id: 'vor', label: 'VOR' },
  { id: 'efficiencyRate', label: 'Efficiency' },
  { id: 'caughtRate', label: 'Caught %' },
  { id: 'netScore', label: 'Net' },
  { id: 'elusivenessRate', label: 'Elusiveness' },
  { id: 'catchRate', label: 'Catch' },
];

/** Share of the ranked pool a player must clear to be colored top / bottom. */
export const PLAYER_CARD_TIER_CUTOFF = 0.25;

export type PlayerCardTier = 'top' | 'bottom' | null;

export type PlayerCardRank = {
  rank: number;
  total: number;
  /** 1 for #1, 0 for last; 1 when the player is the only one ranked. */
  strength: number;
  tier: PlayerCardTier;
  medal: 1 | 2 | 3 | null;
};

export type PlayerCardStat = {
  id: PlayerCardStatId;
  label: string;
  format: PlayerCardStatFormat;
  value: number | null;
  rank: PlayerCardRank | null;
};

export type PlayerCard = {
  /** False when the player is below League Stat Settings minimums (no ranks). */
  qualified: boolean;
  stats: PlayerCardStat[];
  radar: { id: PlayerCardStatId; label: string; rank: PlayerCardRank | null }[];
};

export function playerCardStatValue(
  row: DisplayPlayerStats,
  id: PlayerCardStatId,
  counting: StatsCountingMode = 'counts',
): number | null {
  if (id === 'caught') return row.catchesThrown;
  return highlightMetricValue(row, id, counting);
}

/**
 * Competition rank (ties share the best place) among qualifier-eligible rows,
 * matching the pool used by the Leaderboards tab.
 */
export function playerCardRank(
  rows: DisplayPlayerStats[],
  playerId: Guid,
  id: PlayerCardStatId,
  options: {
    counting?: StatsCountingMode;
    qualifiers?: HighlightQualifierSettings;
  } = {},
): PlayerCardRank | null {
  const counting = options.counting ?? 'counts';
  const qualifiers = options.qualifiers ?? DEFAULT_HIGHLIGHT_QUALIFIERS;
  const higherIsBetter =
    PLAYER_CARD_STATS.find((stat) => stat.id === id)?.higherIsBetter ?? true;
  const values: { playerId: Guid; value: number }[] = [];
  for (const row of rows) {
    if (!playerMeetsHighlightQualifiers(row, qualifiers)) continue;
    const value = playerCardStatValue(row, id, counting);
    if (value == null || Number.isNaN(value)) continue;
    values.push({ playerId: row.playerId, value });
  }
  const mine = values.find((entry) => entry.playerId === playerId);
  if (!mine) return null;
  const better = values.filter((entry) =>
    higherIsBetter ? entry.value > mine.value : entry.value < mine.value,
  ).length;
  return describeRank(better + 1, values.length);
}

export function describeRank(rank: number, total: number): PlayerCardRank {
  return {
    rank,
    total,
    strength: total <= 1 ? 1 : (total - rank) / (total - 1),
    tier: rankTier(rank, total),
    medal: rank <= 3 ? (rank as 1 | 2 | 3) : null,
  };
}

function rankTier(rank: number, total: number): PlayerCardTier {
  if (total < 2) return null;
  const cutoff = Math.max(1, Math.ceil(total * PLAYER_CARD_TIER_CUTOFF));
  if (rank <= cutoff) return 'top';
  if (rank > total - cutoff) return 'bottom';
  return null;
}

export function buildPlayerCard(
  rows: DisplayPlayerStats[],
  playerId: Guid,
  options: {
    counting?: StatsCountingMode;
    qualifiers?: HighlightQualifierSettings;
  } = {},
): PlayerCard | null {
  const counting = options.counting ?? 'counts';
  const qualifiers = options.qualifiers ?? DEFAULT_HIGHLIGHT_QUALIFIERS;
  const row = rows.find((entry) => entry.playerId === playerId);
  if (!row) return null;
  const qualified = playerMeetsHighlightQualifiers(row, qualifiers);
  const stats = PLAYER_CARD_STATS.map((stat) => ({
    id: stat.id,
    label: stat.label,
    format: stat.format,
    value: playerCardStatValue(row, stat.id, counting),
    rank: qualified
      ? playerCardRank(rows, playerId, stat.id, { counting, qualifiers })
      : null,
  }));
  const radar = PLAYER_CARD_RADAR_AXES.map((axis) => ({
    ...axis,
    rank: stats.find((stat) => stat.id === axis.id)?.rank ?? null,
  }));
  return { qualified, stats, radar };
}
