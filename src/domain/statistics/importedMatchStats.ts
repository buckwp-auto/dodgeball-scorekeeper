import { addMatch, getPlayersForTeam, getTeam } from '../database';
import { matchHasGameEvents } from '../importedMatch';
import { newIdTimestamp } from '../id';
import {
  addPlayerToMatchSide,
  getMatchById,
  isPlayerInMatch,
  toggleMatchPlayer,
} from '../matchGame';
import type { DatabaseDto, Guid, ImportedPlayerStatsRow, PlayerRow } from '../types';
import { CountsBuilder } from './statisticAggregates';
import type { StatisticAggregates } from './statisticAggregates';
import type { PlayerStatistics } from './statisticsService';
import { buildPlayerOverviews } from './databaseViews';
import { parseLegacyStatisticsCsv, type ParsedLegacyCsv } from './legacyCsvImport';

export type AggregateMap = Record<string, number>;

export type ImportedAggregatesPayload = {
  matches: AggregateMap;
  games: AggregateMap;
  offenseThrowsIndividual: AggregateMap;
  offenseThrowsGroup: AggregateMap;
  offenseDeflectionsIndividual: AggregateMap;
  offenseDeflectionsGroup: AggregateMap;
  offenseErrors: AggregateMap;
  defenseTargets: AggregateMap;
  defenseDeflections: AggregateMap;
  killsDirectIndividual: AggregateMap;
  killsDirectGroup: AggregateMap;
  killsDirectCredit: AggregateMap;
  killsDeflectionsIndividual: AggregateMap;
  killsDeflectionsGroup: AggregateMap;
  killsDeflectionsCredit: AggregateMap;
  killsSupportCredit: AggregateMap;
  deathsDirect: AggregateMap;
  deathsDeflections: AggregateMap;
  deathsErrors: AggregateMap;
  deathsCredit: number;
  deathsCatchThrownCredit: number;
  teamThrowAssists: number;
  doubleKills: number;
  tripleKills: number;
  quadKills: number;
  doubleCatches: number;
  tripleCatches: number;
  quadCatches: number;
  catchesDirect: number;
  catchesDeflection: number;
};

export type ImportMatchSeriesInput = {
  homeGameWins: number;
  awayGameWins: number;
  tiedGames?: number;
  matchFinished?: boolean;
};

export type ImportMatchStatisticsResult = {
  playersImported: number;
  playersCreated: number;
};

function table<T>(data: DatabaseDto, name: string): T[] {
  return data.Tables[name] as T[];
}

function pushRow<T>(data: DatabaseDto, tableName: string, row: T): T {
  table<T>(data, tableName).push(row);
  return row;
}

export function validateImportMatchSeriesInput(series: ImportMatchSeriesInput): void {
  const tied = series.tiedGames ?? 0;
  if (
    !Number.isInteger(series.homeGameWins) ||
    !Number.isInteger(series.awayGameWins) ||
    !Number.isInteger(tied) ||
    series.homeGameWins < 0 ||
    series.awayGameWins < 0 ||
    tied < 0
  ) {
    throw new Error('Game score must be non-negative whole numbers');
  }
  if (series.homeGameWins + series.awayGameWins + tied < 1) {
    throw new Error('Enter at least one game played (home wins, away wins, or ties)');
  }
}

function aggregatesFromMap(map: AggregateMap): StatisticAggregates<number, number> {
  const builder = new CountsBuilder<number>();
  for (const [key, value] of Object.entries(map)) {
    builder.set(Number(key), value);
  }
  return builder.build();
}

export function playerStatisticsFromImportedPayload(
  data: DatabaseDto,
  playerId: Guid,
  payload: ImportedAggregatesPayload,
): PlayerStatistics | null {
  const overview = buildPlayerOverviews(data).get(playerId);
  if (!overview) return null;
  return {
    playerId,
    team: overview.team,
    player: overview.player,
    matches: aggregatesFromMap(payload.matches),
    games: aggregatesFromMap(payload.games),
    offenseThrowsIndividual: aggregatesFromMap(payload.offenseThrowsIndividual),
    offenseThrowsGroup: aggregatesFromMap(payload.offenseThrowsGroup),
    offenseDeflectionsIndividual: aggregatesFromMap(payload.offenseDeflectionsIndividual),
    offenseDeflectionsGroup: aggregatesFromMap(payload.offenseDeflectionsGroup),
    offenseErrors: aggregatesFromMap(payload.offenseErrors),
    defenseTargets: aggregatesFromMap(payload.defenseTargets),
    defenseDeflections: aggregatesFromMap(payload.defenseDeflections),
    killsDirectIndividual: aggregatesFromMap(payload.killsDirectIndividual),
    killsDirectGroup: aggregatesFromMap(payload.killsDirectGroup),
    killsDirectCredit: aggregatesFromMap(payload.killsDirectCredit),
    killsDeflectionsIndividual: aggregatesFromMap(payload.killsDeflectionsIndividual),
    killsDeflectionsGroup: aggregatesFromMap(payload.killsDeflectionsGroup),
    killsDeflectionsCredit: aggregatesFromMap(payload.killsDeflectionsCredit),
    killsSupportCredit: aggregatesFromMap(payload.killsSupportCredit),
    deathsDirect: aggregatesFromMap(payload.deathsDirect),
    deathsDeflections: aggregatesFromMap(payload.deathsDeflections),
    deathsErrors: aggregatesFromMap(payload.deathsErrors),
    deathsCredit: payload.deathsCredit,
    deathsCatchThrownCredit: payload.deathsCatchThrownCredit,
    teamThrowAssists: payload.teamThrowAssists,
    doubleKills: payload.doubleKills,
    tripleKills: payload.tripleKills,
    quadKills: payload.quadKills,
    doubleCatches: payload.doubleCatches,
    tripleCatches: payload.tripleCatches,
    quadCatches: payload.quadCatches,
    catchesDirect: payload.catchesDirect,
    catchesDeflection: payload.catchesDeflection,
  };
}

export function getImportedPlayerStatsForMatch(
  data: DatabaseDto,
  matchId: Guid,
): ImportedPlayerStatsRow[] {
  return table<ImportedPlayerStatsRow>(data, 'ImportedPlayerStats').filter(
    (row) => row.MatchId === matchId,
  );
}

function clearImportedStatsForMatch(data: DatabaseDto, matchId: Guid): void {
  data.Tables.ImportedPlayerStats = table<ImportedPlayerStatsRow>(
    data,
    'ImportedPlayerStats',
  ).filter((row) => row.MatchId !== matchId);
}

function findPlayerByNameOnTeam(
  data: DatabaseDto,
  teamId: Guid,
  name: string,
): PlayerRow | undefined {
  const norm = name.trim().toLowerCase();
  return getPlayersForTeam(data, teamId).find(
    (player) => player.Name.trim().toLowerCase() === norm,
  );
}

function resolveTeamSide(
  teamName: string,
  homeTeamName: string,
  awayTeamName: string,
): boolean | null {
  const norm = teamName.trim().toLowerCase();
  const homeNorm = homeTeamName.trim().toLowerCase();
  const awayNorm = awayTeamName.trim().toLowerCase();
  if (norm === homeNorm) return true;
  if (norm === awayNorm) return false;
  return null;
}

function ensurePlayerOnMatch(
  data: DatabaseDto,
  matchId: Guid,
  teamHome: boolean,
  playerName: string,
): { player: PlayerRow; created: boolean } {
  const match = getMatchById(data, matchId);
  if (!match) throw new Error('Match not found');
  const teamId = teamHome ? match.TeamIdHome : match.TeamIdAway;
  const existing = findPlayerByNameOnTeam(data, teamId, playerName);
  if (existing) {
    if (!isPlayerInMatch(data, matchId, existing.Id)) {
      toggleMatchPlayer(data, matchId, existing.Id, teamHome);
    }
    return { player: existing, created: false };
  }
  const player = addPlayerToMatchSide(data, matchId, teamHome, playerName);
  return { player, created: true };
}

function applyImportedRows(
  data: DatabaseDto,
  matchId: Guid,
  parsed: ParsedLegacyCsv,
  homeTeamName: string,
  awayTeamName: string,
): { playersImported: number; playersCreated: number } {
  let playersCreated = 0;
  for (const row of parsed.rows) {
    const teamHome = resolveTeamSide(row.teamName, homeTeamName, awayTeamName);
    if (teamHome == null) {
      throw new Error(
        `Team "${row.teamName}" in CSV does not match home (${homeTeamName}) or away (${awayTeamName})`,
      );
    }
    const { player, created } = ensurePlayerOnMatch(
      data,
      matchId,
      teamHome,
      row.playerName,
    );
    if (created) playersCreated += 1;
    pushRow(data, 'ImportedPlayerStats', {
      Id: newIdTimestamp(),
      MatchId: matchId,
      PlayerId: player.Id,
      AggregatesJson: JSON.stringify(row.aggregates),
    });
  }
  return { playersImported: parsed.rows.length, playersCreated };
}

function applySeriesToMatch(
  data: DatabaseDto,
  matchId: Guid,
  series: ImportMatchSeriesInput,
): void {
  const match = getMatchById(data, matchId);
  if (!match) throw new Error('Match not found');
  match.StatsImported = true;
  match.ImportedHomeGameWins = series.homeGameWins;
  match.ImportedAwayGameWins = series.awayGameWins;
  match.ImportedGameTies = series.tiedGames ?? 0;
  if (series.matchFinished) {
    match.Ended = true;
    delete match.EndedVideoOffsetSeconds;
  } else {
    delete match.Ended;
    delete match.EndedVideoOffsetSeconds;
  }
}

export function importMatchStatistics(
  data: DatabaseDto,
  matchId: Guid,
  csvText: string,
  series: ImportMatchSeriesInput,
): ImportMatchStatisticsResult {
  validateImportMatchSeriesInput(series);
  const match = getMatchById(data, matchId);
  if (!match) throw new Error('Match not found');
  if (matchHasGameEvents(data, matchId)) {
    throw new Error('Cannot import statistics into a match that already has tracked events');
  }
  const homeTeam = getTeam(data, match.TeamIdHome);
  const awayTeam = getTeam(data, match.TeamIdAway);
  if (!homeTeam || !awayTeam) throw new Error('Match teams not found');

  const parsed = parseLegacyStatisticsCsv(csvText);
  clearImportedStatsForMatch(data, matchId);
  const counts = applyImportedRows(
    data,
    matchId,
    parsed,
    homeTeam.Name,
    awayTeam.Name,
  );
  applySeriesToMatch(data, matchId, series);
  return counts;
}

export function createMatchFromStatisticsCsv(
  data: DatabaseDto,
  teamIdHome: Guid,
  teamIdAway: Guid,
  csvText: string,
  series: ImportMatchSeriesInput,
  createdByUid?: string | null,
): Guid {
  const match = addMatch(data, teamIdHome, teamIdAway, createdByUid);
  importMatchStatistics(data, match.Id, csvText, series);
  return match.Id;
}

export function loadImportedPayload(row: ImportedPlayerStatsRow): ImportedAggregatesPayload {
  const parsed: unknown = JSON.parse(row.AggregatesJson);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid imported statistics payload');
  }
  return parsed as ImportedAggregatesPayload;
}

function mergeAggregateMaps(left: AggregateMap, right: AggregateMap): AggregateMap {
  const merged: AggregateMap = { ...left };
  for (const [key, value] of Object.entries(right)) {
    merged[key] = (merged[key] ?? 0) + value;
  }
  return merged;
}

export function mergeImportedPayloads(
  left: ImportedAggregatesPayload,
  right: ImportedAggregatesPayload,
): ImportedAggregatesPayload {
  const merged: ImportedAggregatesPayload = {
    matches: mergeAggregateMaps(left.matches, right.matches),
    games: mergeAggregateMaps(left.games, right.games),
    offenseThrowsIndividual: mergeAggregateMaps(
      left.offenseThrowsIndividual,
      right.offenseThrowsIndividual,
    ),
    offenseThrowsGroup: mergeAggregateMaps(left.offenseThrowsGroup, right.offenseThrowsGroup),
    offenseDeflectionsIndividual: mergeAggregateMaps(
      left.offenseDeflectionsIndividual,
      right.offenseDeflectionsIndividual,
    ),
    offenseDeflectionsGroup: mergeAggregateMaps(
      left.offenseDeflectionsGroup,
      right.offenseDeflectionsGroup,
    ),
    offenseErrors: mergeAggregateMaps(left.offenseErrors, right.offenseErrors),
    defenseTargets: mergeAggregateMaps(left.defenseTargets, right.defenseTargets),
    defenseDeflections: mergeAggregateMaps(left.defenseDeflections, right.defenseDeflections),
    killsDirectIndividual: mergeAggregateMaps(
      left.killsDirectIndividual,
      right.killsDirectIndividual,
    ),
    killsDirectGroup: mergeAggregateMaps(left.killsDirectGroup, right.killsDirectGroup),
    killsDirectCredit: mergeAggregateMaps(left.killsDirectCredit, right.killsDirectCredit),
    killsDeflectionsIndividual: mergeAggregateMaps(
      left.killsDeflectionsIndividual,
      right.killsDeflectionsIndividual,
    ),
    killsDeflectionsGroup: mergeAggregateMaps(
      left.killsDeflectionsGroup,
      right.killsDeflectionsGroup,
    ),
    killsDeflectionsCredit: mergeAggregateMaps(
      left.killsDeflectionsCredit,
      right.killsDeflectionsCredit,
    ),
    killsSupportCredit: mergeAggregateMaps(left.killsSupportCredit, right.killsSupportCredit),
    deathsDirect: mergeAggregateMaps(left.deathsDirect, right.deathsDirect),
    deathsDeflections: mergeAggregateMaps(left.deathsDeflections, right.deathsDeflections),
    deathsErrors: mergeAggregateMaps(left.deathsErrors, right.deathsErrors),
    deathsCredit: left.deathsCredit + right.deathsCredit,
    deathsCatchThrownCredit: left.deathsCatchThrownCredit + right.deathsCatchThrownCredit,
    teamThrowAssists: left.teamThrowAssists + right.teamThrowAssists,
    doubleKills: left.doubleKills + right.doubleKills,
    tripleKills: left.tripleKills + right.tripleKills,
    quadKills: left.quadKills + right.quadKills,
    doubleCatches: left.doubleCatches + right.doubleCatches,
    tripleCatches: left.tripleCatches + right.tripleCatches,
    quadCatches: left.quadCatches + right.quadCatches,
    catchesDirect: left.catchesDirect + right.catchesDirect,
    catchesDeflection: left.catchesDeflection + right.catchesDeflection,
  };
  return merged;
}

export function mergePlayerStatistics(
  left: PlayerStatistics,
  right: PlayerStatistics,
): PlayerStatistics {
  const mergeAgg = (
    a: StatisticAggregates<number, number>,
    b: StatisticAggregates<number, number>,
  ): StatisticAggregates<number, number> => {
    const builder = new CountsBuilder<number>();
    const keys = new Set<number>();
    for (let k = 1; k <= 20; k += 1) {
      if ((a.get(k) ?? 0) !== 0 || (b.get(k) ?? 0) !== 0) keys.add(k);
    }
    for (const key of keys) {
      builder.set(key, (a.get(key) ?? 0) + (b.get(key) ?? 0));
    }
    return builder.build();
  };

  return {
    playerId: left.playerId,
    team: left.team,
    player: left.player,
    matches: mergeAgg(left.matches, right.matches),
    games: mergeAgg(left.games, right.games),
    offenseThrowsIndividual: mergeAgg(left.offenseThrowsIndividual, right.offenseThrowsIndividual),
    offenseThrowsGroup: mergeAgg(left.offenseThrowsGroup, right.offenseThrowsGroup),
    offenseDeflectionsIndividual: mergeAgg(
      left.offenseDeflectionsIndividual,
      right.offenseDeflectionsIndividual,
    ),
    offenseDeflectionsGroup: mergeAgg(left.offenseDeflectionsGroup, right.offenseDeflectionsGroup),
    offenseErrors: mergeAgg(left.offenseErrors, right.offenseErrors),
    defenseTargets: mergeAgg(left.defenseTargets, right.defenseTargets),
    defenseDeflections: mergeAgg(left.defenseDeflections, right.defenseDeflections),
    killsDirectIndividual: mergeAgg(left.killsDirectIndividual, right.killsDirectIndividual),
    killsDirectGroup: mergeAgg(left.killsDirectGroup, right.killsDirectGroup),
    killsDirectCredit: mergeAgg(left.killsDirectCredit, right.killsDirectCredit),
    killsDeflectionsIndividual: mergeAgg(
      left.killsDeflectionsIndividual,
      right.killsDeflectionsIndividual,
    ),
    killsDeflectionsGroup: mergeAgg(left.killsDeflectionsGroup, right.killsDeflectionsGroup),
    killsDeflectionsCredit: mergeAgg(left.killsDeflectionsCredit, right.killsDeflectionsCredit),
    killsSupportCredit: mergeAgg(left.killsSupportCredit, right.killsSupportCredit),
    deathsDirect: mergeAgg(left.deathsDirect, right.deathsDirect),
    deathsDeflections: mergeAgg(left.deathsDeflections, right.deathsDeflections),
    deathsErrors: mergeAgg(left.deathsErrors, right.deathsErrors),
    deathsCredit: left.deathsCredit + right.deathsCredit,
    deathsCatchThrownCredit: left.deathsCatchThrownCredit + right.deathsCatchThrownCredit,
    teamThrowAssists: left.teamThrowAssists + right.teamThrowAssists,
    doubleKills: left.doubleKills + right.doubleKills,
    tripleKills: left.tripleKills + right.tripleKills,
    quadKills: left.quadKills + right.quadKills,
    doubleCatches: left.doubleCatches + right.doubleCatches,
    tripleCatches: left.tripleCatches + right.tripleCatches,
    quadCatches: left.quadCatches + right.quadCatches,
    catchesDirect: left.catchesDirect + right.catchesDirect,
    catchesDeflection: left.catchesDeflection + right.catchesDeflection,
  };
}
