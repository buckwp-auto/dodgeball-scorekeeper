import { getMatchName, getMatches } from '../database';
import { getGameName, getMatchById, getMatchPlayers } from '../matchGame';
import { throwResultLabels, throwResultUiOrder } from '../gameEvents';
import type { DatabaseDto, Guid } from '../types';
import {
  DeflectionResult,
  ECompetitionOutcome,
  EDeathError,
  EThrowError,
  ThrowResult,
  enumValues,
} from './constants';
import {
  buildGameEventsByGame,
  buildMatchEventsByMatch,
  buildThrowsDetail,
  indexGameEventThrows,
  indexGamePlayers,
  indexMatchEventGames,
  indexMatchPlayers,
  type ThrowDetail,
} from './databaseViews';
import { createStatisticsSummary, type PlayerStatistics } from './statisticsService';
import type { StatisticAggregates } from './statisticAggregates';

export type StatsScope =
  | { kind: 'league' }
  | { kind: 'match'; matchId: Guid }
  | { kind: 'game'; matchId: Guid; gameId: Guid };

export type LeaderboardMetric = 'kills' | 'catches' | 'kd' | 'hitRate' | 'gamesWon';

export type StatsCountingMode = 'counts' | 'credit';

export const STATS_COUNTING_STORAGE_KEY = 'SCOREKEEPER_STATS_COUNTING';

export function loadStatsCountingMode(): StatsCountingMode {
  try {
    const raw = sessionStorage.getItem(STATS_COUNTING_STORAGE_KEY);
    if (raw === 'counts' || raw === 'credit') return raw;
  } catch {
    /* ignore */
  }
  return 'counts';
}

export function saveStatsCountingMode(mode: StatsCountingMode): void {
  try {
    sessionStorage.setItem(STATS_COUNTING_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export type DisplayPlayerStats = {
  playerId: Guid;
  teamId: Guid;
  teamName: string;
  playerName: string;
  /** Match side when the scope is a single match or game; null for league rollups. */
  teamHome: boolean | null;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesTied: number;
  gamesIncomplete: number;
  gameWinPct: number | null;
  matchesPlayed: number;
  kills: number;
  killsCredit: number;
  killsSupportCredit: number;
  deaths: number;
  deathsCredit: number;
  assists: number;
  doubleKills: number;
  tripleKills: number;
  quadKills: number;
  doubleCatches: number;
  tripleCatches: number;
  quadCatches: number;
  throws: number;
  throwHits: number;
  throwCounts: Partial<Record<ThrowResult, number>>;
  targets: number;
  /** Incoming Hit + failed block (target or deflection receiver). */
  targetHits: number;
  catches: number;
  catchesDeflection: number;
  /** Direct + deflection catches against this thrower. */
  catchesThrown: number;
  recoveries: number;
  wastedBalls: number;
  lineOuts: number;
  illegalBlocks: number;
  kd: number | null;
  kdCredit: number | null;
  hitRate: number | null;
  catchRate: number | null;
  /** Catches thrown / throws. Lower is better. */
  caughtRate: number | null;
  /** (targeted − hit) / targeted. */
  elusivenessRate: number | null;
  /** Equal-weight z-scores vs median; null until `attachVorWar`. */
  vor: number | null;
  war: number | null;
};

export type ThrowMixSlice = {
  resultId: ThrowResult;
  label: string;
  count: number;
};

export type SideComparisonRow = {
  metric: string;
  home: number;
  away: number;
};

export function resolveStatsQuery(
  data: DatabaseDto,
  scope: StatsScope,
): { matchIds: Guid[]; gameIds?: Set<Guid> } {
  if (scope.kind === 'league') {
    return { matchIds: getMatches(data).map((row) => row.match.Id) };
  }
  if (scope.kind === 'match') {
    return { matchIds: [scope.matchId] };
  }
  return { matchIds: [scope.matchId], gameIds: new Set([scope.gameId]) };
}

export function statsPageTitle(data: DatabaseDto, scope: StatsScope): string {
  if (scope.kind === 'league') return 'League stats';
  const match = getMatchById(data, scope.matchId);
  const matchName = match ? getMatchName(data, match) : 'Match';
  if (scope.kind === 'match') return `Match stats — ${matchName}`;
  const label = getGameName(data, scope.matchId, scope.gameId);
  return `${label} stats — ${matchName}`;
}

export function buildDisplayStats(
  data: DatabaseDto,
  scope: StatsScope,
): DisplayPlayerStats[] {
  const { matchIds, gameIds } = resolveStatsQuery(data, scope);
  if (matchIds.length === 0) return [];

  const summary = createStatisticsSummary(data, matchIds, gameIds);
  const extras = countCatchesAndRecoveries(data, matchIds, gameIds);
  const sideByPlayer =
    scope.kind === 'league' ? null : teamHomeByPlayer(data, scope.matchId);

  return summary.map((row) => toDisplayPlayer(row, extras, sideByPlayer));
}

export type LeaderboardRank = {
  rank: number;
  total: number;
  value: number | null;
};

/** Competition rank (ties share the best place) among rows with a non-null metric. */
export function leaderboardRank(
  rows: DisplayPlayerStats[],
  playerId: Guid,
  metric: LeaderboardMetric,
  counting: StatsCountingMode = 'counts',
): LeaderboardRank | null {
  const eligible = rows.filter((row) => metricValue(row, metric, counting) != null);
  const sorted = [...eligible].sort((a, b) =>
    compareMetric(a, b, metric, 'desc', counting),
  );
  const index = sorted.findIndex((row) => row.playerId === playerId);
  if (index < 0) return null;
  const value = metricValue(sorted[index], metric, counting);
  let rank = index + 1;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (metricValue(sorted[i], metric, counting) === value) rank = i + 1;
    else break;
  }
  return { rank, total: eligible.length, value };
}

export function filterAndSortDisplayStats(
  rows: DisplayPlayerStats[],
  options: {
    metric: LeaderboardMetric;
    minGames: number;
    direction?: 'asc' | 'desc';
    counting?: StatsCountingMode;
  },
): DisplayPlayerStats[] {
  const direction = options.direction ?? 'desc';
  const counting = options.counting ?? 'counts';
  return rows
    .filter((row) => row.gamesPlayed >= options.minGames)
    .sort((a, b) => compareMetric(a, b, options.metric, direction, counting));
}

export function metricValue(
  row: DisplayPlayerStats,
  metric: LeaderboardMetric,
  counting: StatsCountingMode = 'counts',
): number | null {
  switch (metric) {
    case 'kills':
      return counting === 'credit' ? row.killsCredit : row.kills;
    case 'catches':
      return row.catches;
    case 'kd':
      return counting === 'credit' ? row.kdCredit : row.kd;
    case 'hitRate':
      return row.hitRate;
    case 'gamesWon':
      return row.gamesWon;
  }
}

export function displayedKills(
  row: DisplayPlayerStats,
  counting: StatsCountingMode,
): number {
  return counting === 'credit' ? row.killsCredit : row.kills;
}

export function displayedDeaths(
  row: DisplayPlayerStats,
  counting: StatsCountingMode,
): number {
  return counting === 'credit' ? row.deathsCredit : row.deaths;
}

export function displayedKd(
  row: DisplayPlayerStats,
  counting: StatsCountingMode,
): number | null {
  return counting === 'credit' ? row.kdCredit : row.kd;
}

export function aggregateThrowMix(rows: DisplayPlayerStats[]): ThrowMixSlice[] {
  const counts = new Map<ThrowResult, number>();
  for (const row of rows) {
    for (const resultId of enumValues(ThrowResult) as ThrowResult[]) {
      const count = row.throwCounts[resultId] ?? 0;
      if (!count) continue;
      counts.set(resultId, (counts.get(resultId) ?? 0) + count);
    }
  }
  return throwResultUiOrder
    .map((resultId) => ({
      resultId,
      label: throwResultLabels[resultId],
      count: counts.get(resultId) ?? 0,
    }))
    .filter((slice) => slice.count > 0);
}

export function buildSideComparison(
  rows: DisplayPlayerStats[],
  counting: StatsCountingMode = 'counts',
): SideComparisonRow[] | null {
  if (rows.length === 0 || rows.some((row) => row.teamHome == null)) return null;
  const home = rows.filter((row) => row.teamHome);
  const away = rows.filter((row) => row.teamHome === false);
  const sum = (side: DisplayPlayerStats[], key: keyof DisplayPlayerStats) =>
    side.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const sumFn = (
    side: DisplayPlayerStats[],
    pick: (row: DisplayPlayerStats) => number,
  ) => side.reduce((total, row) => total + pick(row), 0);
  return [
    {
      metric: 'Kills',
      home: sumFn(home, (row) => displayedKills(row, counting)),
      away: sumFn(away, (row) => displayedKills(row, counting)),
    },
    { metric: 'Catches', home: sum(home, 'catches'), away: sum(away, 'catches') },
    {
      metric: 'Deaths',
      home: sumFn(home, (row) => displayedDeaths(row, counting)),
      away: sumFn(away, (row) => displayedDeaths(row, counting)),
    },
    { metric: 'Throws', home: sum(home, 'throws'), away: sum(away, 'throws') },
  ];
}

export function formatRate(value: number | null): string {
  if (value == null) return '—';
  if (!Number.isFinite(value)) return '∞';
  return value.toFixed(2);
}

export function formatPct(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

/** One-decimal percent for highlight stats (e.g. 84.6%). */
export function formatPct1(value: number | null): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function efficiencyRate(
  row: DisplayPlayerStats,
  counting: StatsCountingMode = 'counts',
): number | null {
  if (row.throws <= 0) return null;
  return displayedKills(row, counting) / row.throws;
}

export function netScore(
  row: DisplayPlayerStats,
  counting: StatsCountingMode = 'counts',
): number {
  return (
    2 * row.catches +
    displayedKills(row, counting) -
    displayedDeaths(row, counting) -
    2 * row.catchesThrown
  );
}

export function formatCountValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

export function formatRecord(wins: number, losses: number, ties: number): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

export const LEADERBOARD_METRICS: { id: LeaderboardMetric; label: string }[] = [
  { id: 'kills', label: 'Kills' },
  { id: 'catches', label: 'Catches' },
  { id: 'kd', label: 'K/D' },
  { id: 'hitRate', label: 'Hit%' },
  { id: 'gamesWon', label: 'Games won' },
];

function toDisplayPlayer(
  row: PlayerStatistics,
  extras: Map<Guid, { recoveries: number }>,
  sideByPlayer: Map<Guid, boolean> | null,
): DisplayPlayerStats {
  const gamesWon = countOutcome(row.games, ECompetitionOutcome.Win);
  const gamesLost = countOutcome(row.games, ECompetitionOutcome.Loss);
  const gamesTied = countOutcome(row.games, ECompetitionOutcome.Tie);
  const gamesIncomplete = countOutcome(row.games, ECompetitionOutcome.Incomplete);
  const gamesPlayed = row.games.total ?? 0;
  const decidedGames = gamesWon + gamesLost + gamesTied;

  const throwCounts = mergeThrowCounts(
    row.offenseThrowsIndividual,
    row.offenseThrowsGroup,
  );
  const deflectionThrown = mergeDeflectionCounts(
    row.offenseDeflectionsIndividual,
    row.offenseDeflectionsGroup,
  );
  const throws = totalOf(row.offenseThrowsIndividual, row.offenseThrowsGroup);
  const throwHits = throwCounts[ThrowResult.Hit] ?? 0;
  const targets = totalOf(row.defenseTargets, row.defenseDeflections);
  const targetHits =
    (row.defenseTargets.get(ThrowResult.Hit) ?? 0) +
    (row.defenseTargets.get(ThrowResult.BlockFailed) ?? 0) +
    (row.defenseDeflections.get(DeflectionResult.Hit) ?? 0) +
    (row.defenseDeflections.get(DeflectionResult.BlockFailed) ?? 0);
  const catchesThrown =
    (throwCounts[ThrowResult.Catch] ?? 0) +
    (deflectionThrown[DeflectionResult.Catch] ?? 0);
  const kills = totalOf(
    row.killsDirectIndividual,
    row.killsDirectGroup,
    row.killsDeflectionsIndividual,
    row.killsDeflectionsGroup,
  );
  const deaths = totalOf(row.deathsDirect, row.deathsDeflections, row.deathsErrors);
  const extra = extras.get(row.playerId) ?? { recoveries: 0 };
  const catches = row.catchesDirect + row.catchesDeflection;
  const killsCredit = totalOf(row.killsDirectCredit, row.killsDeflectionsCredit);

  return {
    playerId: row.playerId,
    teamId: row.team.Id,
    teamName: row.team.Name,
    playerName: row.player.Name,
    teamHome: sideByPlayer?.get(row.playerId) ?? null,
    gamesPlayed,
    gamesWon,
    gamesLost,
    gamesTied,
    gamesIncomplete,
    gameWinPct: decidedGames > 0 ? gamesWon / decidedGames : null,
    matchesPlayed: row.matches.total ?? 0,
    kills,
    killsCredit,
    killsSupportCredit: row.killsSupportCredit.total ?? 0,
    deaths,
    deathsCredit: row.deathsCredit,
    assists: row.teamThrowAssists,
    doubleKills: row.doubleKills,
    tripleKills: row.tripleKills,
    quadKills: row.quadKills,
    doubleCatches: row.doubleCatches,
    tripleCatches: row.tripleCatches,
    quadCatches: row.quadCatches,
    throws,
    throwHits,
    throwCounts,
    targets,
    targetHits,
    catches,
    catchesDeflection: row.catchesDeflection,
    catchesThrown,
    recoveries: extra.recoveries,
    wastedBalls: row.offenseErrors.get(EThrowError.WastedBall) ?? 0,
    lineOuts: row.deathsErrors.get(EDeathError.LineOut) ?? 0,
    illegalBlocks: row.deathsErrors.get(EDeathError.BlockIllegal) ?? 0,
    kd: rateOrInfinite(kills, deaths),
    kdCredit: rateOrInfinite(killsCredit, row.deathsCredit),
    hitRate: throws > 0 ? throwHits / throws : null,
    catchRate: targets > 0 ? catches / targets : null,
    caughtRate: throws > 0 ? catchesThrown / throws : null,
    elusivenessRate: targets > 0 ? (targets - targetHits) / targets : null,
    vor: null,
    war: null,
  };
}

function countOutcome(
  games: StatisticAggregates<ECompetitionOutcome, number>,
  outcome: ECompetitionOutcome,
): number {
  return games.get(outcome) ?? 0;
}

function totalOf(
  ...aggregates: StatisticAggregates<number, number>[]
): number {
  return aggregates.reduce((sum, agg) => sum + (agg.total ?? 0), 0);
}

function mergeThrowCounts(
  ...aggregates: StatisticAggregates<ThrowResult, number>[]
): Partial<Record<ThrowResult, number>> {
  const counts: Partial<Record<ThrowResult, number>> = {};
  for (const resultId of enumValues(ThrowResult) as ThrowResult[]) {
    let total = 0;
    for (const agg of aggregates) {
      total += agg.get(resultId) ?? 0;
    }
    if (total > 0) counts[resultId] = total;
  }
  return counts;
}

function mergeDeflectionCounts(
  ...aggregates: StatisticAggregates<DeflectionResult, number>[]
): Partial<Record<DeflectionResult, number>> {
  const counts: Partial<Record<DeflectionResult, number>> = {};
  for (const resultId of enumValues(DeflectionResult) as DeflectionResult[]) {
    let total = 0;
    for (const agg of aggregates) {
      total += agg.get(resultId) ?? 0;
    }
    if (total > 0) counts[resultId] = total;
  }
  return counts;
}

function rateOrInfinite(numerator: number, denominator: number): number | null {
  if (numerator === 0 && denominator === 0) return null;
  if (denominator === 0) return Number.POSITIVE_INFINITY;
  return numerator / denominator;
}

function compareMetric(
  a: DisplayPlayerStats,
  b: DisplayPlayerStats,
  metric: LeaderboardMetric,
  direction: 'asc' | 'desc',
  counting: StatsCountingMode,
): number {
  const av = metricValue(a, metric, counting);
  const bv = metricValue(b, metric, counting);
  if (av == null && bv == null) {
    return a.playerName.localeCompare(b.playerName);
  }
  if (av == null) return 1;
  if (bv == null) return -1;
  if (av === bv) return a.playerName.localeCompare(b.playerName);
  const cmp = av < bv ? -1 : 1;
  return direction === 'asc' ? cmp : -cmp;
}

function teamHomeByPlayer(data: DatabaseDto, matchId: Guid): Map<Guid, boolean> {
  const map = new Map<Guid, boolean>();
  for (const row of getMatchPlayers(data, matchId)) {
    map.set(row.PlayerId, row.TeamHome);
  }
  return map;
}

type RecoveryCounts = { recoveries: number };

function countCatchesAndRecoveries(
  data: DatabaseDto,
  matchIds: Guid[],
  gameIds?: Set<Guid>,
): Map<Guid, RecoveryCounts> {
  const counts = new Map<Guid, RecoveryCounts>();
  const bump = (playerId: Guid) => {
    const current = counts.get(playerId) ?? { recoveries: 0 };
    current.recoveries += 1;
    counts.set(playerId, current);
  };

  const playerIdByGamePlayer = playerIdByGamePlayerId(data);
  iterateScopedThrows(data, matchIds, gameIds, (detail) => {
    if (!detail.throwRow.RecoveredId) return;
    const recoveredId = playerIdByGamePlayer.get(detail.throwRow.RecoveredId);
    if (recoveredId) bump(recoveredId);
  });

  return counts;
}

export function playerIdByGamePlayerId(data: DatabaseDto): Map<Guid, Guid> {
  const matchPlayers = indexMatchPlayers(data);
  const map = new Map<Guid, Guid>();
  for (const gamePlayer of indexGamePlayers(data).values()) {
    const matchPlayer = matchPlayers.get(gamePlayer.MatchPlayerId);
    if (matchPlayer) map.set(gamePlayer.Id, matchPlayer.PlayerId);
  }
  return map;
}

export function iterateScopedThrows(
  data: DatabaseDto,
  matchIds: Guid[],
  gameIds: Set<Guid> | undefined,
  visit: (detail: ThrowDetail) => void,
): void {
  const matchEventsByMatch = buildMatchEventsByMatch(data);
  const matchEventGames = indexMatchEventGames(data);
  const gameEventsByGame = buildGameEventsByGame(data);
  const throwsDetail = buildThrowsDetail(data);
  const gameEventThrows = indexGameEventThrows(data);

  for (const matchId of matchIds) {
    for (const matchEvent of matchEventsByMatch.get(matchId) ?? []) {
      const link = matchEventGames.get(matchEvent.Id);
      if (!link) continue;
      if (gameIds && !gameIds.has(link.GameId)) continue;
      for (const gameEvent of gameEventsByGame.get(link.GameId) ?? []) {
        if (!gameEventThrows.has(gameEvent.Id)) continue;
        for (const detail of throwsDetail.get(gameEvent.Id) ?? []) {
          visit(detail);
        }
      }
    }
  }
}
