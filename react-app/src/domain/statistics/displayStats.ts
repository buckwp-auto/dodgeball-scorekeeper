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
  throws: number;
  throwHits: number;
  throwCounts: Partial<Record<ThrowResult, number>>;
  targets: number;
  catches: number;
  recoveries: number;
  wastedBalls: number;
  lineOuts: number;
  illegalBlocks: number;
  kd: number | null;
  hitRate: number | null;
  catchRate: number | null;
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

export function filterAndSortDisplayStats(
  rows: DisplayPlayerStats[],
  options: {
    metric: LeaderboardMetric;
    minGames: number;
    direction?: 'asc' | 'desc';
  },
): DisplayPlayerStats[] {
  const direction = options.direction ?? 'desc';
  return rows
    .filter((row) => row.gamesPlayed >= options.minGames)
    .sort((a, b) => compareMetric(a, b, options.metric, direction));
}

export function metricValue(
  row: DisplayPlayerStats,
  metric: LeaderboardMetric,
): number | null {
  switch (metric) {
    case 'kills':
      return row.kills;
    case 'catches':
      return row.catches;
    case 'kd':
      return row.kd;
    case 'hitRate':
      return row.hitRate;
    case 'gamesWon':
      return row.gamesWon;
  }
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
): SideComparisonRow[] | null {
  if (rows.length === 0 || rows.some((row) => row.teamHome == null)) return null;
  const home = rows.filter((row) => row.teamHome);
  const away = rows.filter((row) => row.teamHome === false);
  const sum = (side: DisplayPlayerStats[], key: keyof DisplayPlayerStats) =>
    side.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  return [
    { metric: 'Kills', home: sum(home, 'kills'), away: sum(away, 'kills') },
    { metric: 'Catches', home: sum(home, 'catches'), away: sum(away, 'catches') },
    { metric: 'Deaths', home: sum(home, 'deaths'), away: sum(away, 'deaths') },
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
  extras: Map<Guid, { catches: number; recoveries: number }>,
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
  const throws = totalOf(row.offenseThrowsIndividual, row.offenseThrowsGroup);
  const throwHits = throwCounts[ThrowResult.Hit] ?? 0;
  const targets = totalOf(row.defenseTargets, row.defenseDeflections);
  const kills = totalOf(
    row.killsDirectIndividual,
    row.killsDirectGroup,
    row.killsDeflectionsIndividual,
    row.killsDeflectionsGroup,
  );
  const deaths = totalOf(row.deathsDirect, row.deathsDeflections, row.deathsErrors);
  const extra = extras.get(row.playerId) ?? { catches: 0, recoveries: 0 };

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
    killsCredit: totalOf(row.killsDirectCredit, row.killsDeflectionsCredit),
    killsSupportCredit: row.killsSupportCredit.total ?? 0,
    deaths,
    throws,
    throwHits,
    throwCounts,
    targets,
    catches: extra.catches,
    recoveries: extra.recoveries,
    wastedBalls: row.offenseErrors.get(EThrowError.WastedBall) ?? 0,
    lineOuts: row.deathsErrors.get(EDeathError.LineOut) ?? 0,
    illegalBlocks: row.deathsErrors.get(EDeathError.BlockIllegal) ?? 0,
    kd: rateOrInfinite(kills, deaths),
    hitRate: throws > 0 ? throwHits / throws : null,
    catchRate: targets > 0 ? extra.catches / targets : null,
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
): number {
  const av = metricValue(a, metric);
  const bv = metricValue(b, metric);
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

type CatchRecoveryCounts = { catches: number; recoveries: number };

function countCatchesAndRecoveries(
  data: DatabaseDto,
  matchIds: Guid[],
  gameIds?: Set<Guid>,
): Map<Guid, CatchRecoveryCounts> {
  const counts = new Map<Guid, CatchRecoveryCounts>();
  const bump = (playerId: Guid, field: keyof CatchRecoveryCounts) => {
    const current = counts.get(playerId) ?? { catches: 0, recoveries: 0 };
    current[field] += 1;
    counts.set(playerId, current);
  };

  const playerIdByGamePlayer = playerIdByGamePlayerId(data);
  iterateScopedThrows(data, matchIds, gameIds, (detail) => {
    if (detail.throwRow.ResultId === ThrowResult.Catch) {
      const catcherId = playerIdByGamePlayer.get(detail.throwRow.TargetId);
      if (catcherId) bump(catcherId, 'catches');
    }
    for (const deflection of detail.deflections) {
      if (deflection.ResultId !== DeflectionResult.Catch) continue;
      const catcherId = playerIdByGamePlayer.get(deflection.ReceiverId);
      if (catcherId) bump(catcherId, 'catches');
    }
    if (detail.throwRow.RecoveredId) {
      const recoveredId = playerIdByGamePlayer.get(detail.throwRow.RecoveredId);
      if (recoveredId) bump(recoveredId, 'recoveries');
    }
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
