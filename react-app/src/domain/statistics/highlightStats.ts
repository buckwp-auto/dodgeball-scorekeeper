import {
  DEFAULT_HIGHLIGHT_QUALIFIERS,
  type HighlightQualifierSettings,
} from '../leagueSettings';
import {
  efficiencyRate,
  netScore,
  type DisplayPlayerStats,
  type StatsCountingMode,
} from './displayStats';

export type HighlightMetric =
  | 'caughtRate'
  | 'catchRate'
  | 'elusivenessRate'
  | 'efficiencyRate'
  | 'netScore'
  | 'vor'
  | 'war';

export const HIGHLIGHT_METRICS: {
  id: HighlightMetric;
  label: string;
  /** False for Caught% — throwing fewer catches is better. */
  higherIsBetter: boolean;
}[] = [
  { id: 'caughtRate', label: 'Caught %', higherIsBetter: false },
  { id: 'catchRate', label: 'Catch %', higherIsBetter: true },
  { id: 'elusivenessRate', label: 'Elusiveness %', higherIsBetter: true },
  { id: 'efficiencyRate', label: 'Efficiency %', higherIsBetter: true },
  { id: 'netScore', label: 'Net score', higherIsBetter: true },
  { id: 'vor', label: 'VOR', higherIsBetter: true },
  { id: 'war', label: 'WAR', higherIsBetter: true },
];

export const HIGHLIGHT_FORMULAS: Record<HighlightMetric, string> = {
  caughtRate: 'Caught % = catches thrown / throws',
  catchRate: 'Catch % = catches made / times targeted',
  elusivenessRate: 'Elusiveness % = (times targeted − times hit) / times targeted',
  efficiencyRate: 'Efficiency % = kills / throws',
  netScore: 'Net score = 2×catches + kills − hit/error deaths − 2×times caught',
  vor: 'VOR = equal-weight average of z-scores vs median (Caught % inverted)',
  war: 'WAR = VOR / 6',
};

const VOR_COMPONENTS: {
  invert: boolean;
  value: (row: DisplayPlayerStats, counting: StatsCountingMode) => number | null;
}[] = [
  { invert: true, value: (row) => row.caughtRate },
  { invert: false, value: (row) => row.catchRate },
  { invert: false, value: (row) => row.elusivenessRate },
  { invert: false, value: (row, counting) => efficiencyRate(row, counting) },
  { invert: false, value: (row, counting) => netScore(row, counting) },
];

export function highlightMetricValue(
  row: DisplayPlayerStats,
  metric: HighlightMetric,
  counting: StatsCountingMode = 'counts',
): number | null {
  switch (metric) {
    case 'caughtRate':
      return row.caughtRate;
    case 'catchRate':
      return row.catchRate;
    case 'elusivenessRate':
      return row.elusivenessRate;
    case 'efficiencyRate':
      return efficiencyRate(row, counting);
    case 'netScore':
      return netScore(row, counting);
    case 'vor':
      return row.vor;
    case 'war':
      return row.war;
  }
}

export function playerQualifiesForVor(
  row: DisplayPlayerStats,
  counting: StatsCountingMode = 'counts',
): boolean {
  return (
    row.caughtRate != null &&
    row.catchRate != null &&
    row.elusivenessRate != null &&
    efficiencyRate(row, counting) != null
  );
}

export function playerMeetsHighlightQualifiers(
  row: DisplayPlayerStats,
  qualifiers: HighlightQualifierSettings,
): boolean {
  if (qualifiers.minGamesEnabled && row.gamesPlayed < qualifiers.minGames) return false;
  if (qualifiers.minMatchesEnabled && row.matchesPlayed < qualifiers.minMatches) {
    return false;
  }
  if (
    qualifiers.minVolumeEnabled &&
    (row.throws < qualifiers.minThrows || row.targets < qualifiers.minTargets)
  ) {
    return false;
  }
  return true;
}

export function formatHighlightQualifiers(qualifiers: HighlightQualifierSettings): string {
  const parts: string[] = [];
  if (qualifiers.minGamesEnabled) parts.push(`${qualifiers.minGames} games`);
  if (qualifiers.minMatchesEnabled) parts.push(`${qualifiers.minMatches} matches`);
  if (qualifiers.minVolumeEnabled) {
    parts.push(`${qualifiers.minThrows} throws & ${qualifiers.minTargets} targets`);
  }
  return parts.length > 0 ? parts.join(', ') : 'none';
}

/**
 * Value over replacement: mean of (x − median) / σ for Caught%, Catch%,
 * Elusiveness%, Efficiency%, and Net score. Caught% is inverted so fewer
 * catches thrown is better. WAR is VOR / 6. Median/σ use qualifier-eligible
 * players only.
 */
export function attachVorWar(
  rows: DisplayPlayerStats[],
  counting: StatsCountingMode = 'counts',
  qualifiers: HighlightQualifierSettings = DEFAULT_HIGHLIGHT_QUALIFIERS,
): DisplayPlayerStats[] {
  const eligible = rows.filter(
    (row) =>
      playerQualifiesForVor(row, counting) &&
      playerMeetsHighlightQualifiers(row, qualifiers),
  );
  const prepared = VOR_COMPONENTS.map((component) => {
    const values = eligible
      .map((row) => component.value(row, counting))
      .filter((value): value is number => value != null && Number.isFinite(value));
    return {
      ...component,
      median: median(values),
      stdev: populationStdev(values),
    };
  });

  return rows.map((row) => {
    if (
      !playerQualifiesForVor(row, counting) ||
      !playerMeetsHighlightQualifiers(row, qualifiers)
    ) {
      return { ...row, vor: null, war: null };
    }
    const zScores = prepared.map((stat) => {
      const value = stat.value(row, counting);
      if (value == null || !Number.isFinite(value) || stat.stdev === 0) return 0;
      const z = (value - stat.median) / stat.stdev;
      return stat.invert ? -z : z;
    });
    const vor = zScores.reduce((sum, z) => sum + z, 0) / zScores.length;
    return { ...row, vor, war: vor / 6 };
  });
}

export function topHighlightPlayers(
  rows: DisplayPlayerStats[],
  metric: HighlightMetric,
  options: {
    counting?: StatsCountingMode;
    qualifiers?: HighlightQualifierSettings;
    limit?: number;
  } = {},
): DisplayPlayerStats[] {
  const counting = options.counting ?? 'counts';
  const qualifiers = options.qualifiers ?? DEFAULT_HIGHLIGHT_QUALIFIERS;
  const limit = options.limit ?? 5;
  const higherIsBetter =
    HIGHLIGHT_METRICS.find((item) => item.id === metric)?.higherIsBetter ?? true;
  const ranked = rows
    .filter((row) => playerMeetsHighlightQualifiers(row, qualifiers))
    .filter((row) => highlightMetricValue(row, metric, counting) != null)
    .sort((a, b) =>
      compareHighlight(a, b, metric, higherIsBetter ? 'desc' : 'asc', counting),
    );
  return ranked.slice(0, limit);
}

export function compareHighlight(
  a: DisplayPlayerStats,
  b: DisplayPlayerStats,
  metric: HighlightMetric,
  direction: 'asc' | 'desc',
  counting: StatsCountingMode = 'counts',
): number {
  const av = highlightMetricValue(a, metric, counting);
  const bv = highlightMetricValue(b, metric, counting);
  if (av == null && bv == null) return a.playerName.localeCompare(b.playerName);
  if (av == null) return 1;
  if (bv == null) return -1;
  if (av === bv) return a.playerName.localeCompare(b.playerName);
  const cmp = av < bv ? -1 : 1;
  return direction === 'asc' ? cmp : -cmp;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1]! + sorted[mid]!) / 2;
  return sorted[mid]!;
}

export function populationStdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
