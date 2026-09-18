import {
  getGameEvents,
  getGameEventType,
  getGamePlayerInfos,
  type GamePlayerInfo,
} from './gameEvents';
import { GameEventPlayerDepartureKind } from './statistics/constants';
import type { DatabaseDto, Guid } from './types';
import { getMatchGames } from './matchGame';

export type GameEventPlayerDepartureRow = {
  GameEventId: Guid;
  GamePlayerId: Guid;
  Kind: GameEventPlayerDepartureKind;
};

export const departureKindLabels: Record<GameEventPlayerDepartureKind, string> = {
  [GameEventPlayerDepartureKind.Yellow]: 'Yellow card',
  [GameEventPlayerDepartureKind.SecondYellow]: 'Second yellow',
  [GameEventPlayerDepartureKind.Red]: 'Red card',
  [GameEventPlayerDepartureKind.Injury]: 'Injury',
};

/** Kinds that soft-exit the player from this game and block later games in the match. */
export function departureKindSoftExits(kind: GameEventPlayerDepartureKind): boolean {
  return (
    kind === GameEventPlayerDepartureKind.SecondYellow ||
    kind === GameEventPlayerDepartureKind.Red ||
    kind === GameEventPlayerDepartureKind.Injury
  );
}

function table<T>(data: DatabaseDto, name: string): T[] {
  return data.Tables[name] as T[];
}

export function indexDeparturesByEvent(
  data: DatabaseDto,
): Map<Guid, GameEventPlayerDepartureRow> {
  const map = new Map<Guid, GameEventPlayerDepartureRow>();
  for (const row of table<GameEventPlayerDepartureRow>(data, 'GameEventPlayerDeparture')) {
    map.set(row.GameEventId, row);
  }
  return map;
}

/** Departure rows for a game in event order (includes yellow-only cards). */
export function getGameDepartures(
  data: DatabaseDto,
  gameId: Guid,
): Array<GameEventPlayerDepartureRow & { ordinal: number }> {
  const byEvent = indexDeparturesByEvent(data);
  const rows: Array<GameEventPlayerDepartureRow & { ordinal: number }> = [];
  for (const event of getGameEvents(data, gameId)) {
    if (getGameEventType(data, event.Id) !== 'playerDeparture') continue;
    const row = byEvent.get(event.Id);
    if (row) rows.push({ ...row, ordinal: event.Ordinal });
  }
  return rows;
}

/** Latest soft-exit departure for a game player in this game, if any. */
export function softExitDepartureForGamePlayer(
  data: DatabaseDto,
  gameId: Guid,
  gamePlayerId: Guid,
): GameEventPlayerDepartureRow | null {
  let latest: (GameEventPlayerDepartureRow & { ordinal: number }) | null = null;
  for (const row of getGameDepartures(data, gameId)) {
    if (row.GamePlayerId !== gamePlayerId) continue;
    if (!departureKindSoftExits(row.Kind)) continue;
    if (!latest || row.ordinal >= latest.ordinal) latest = row;
  }
  return latest;
}

export function isSoftExitedInGame(
  data: DatabaseDto,
  gameId: Guid,
  gamePlayerId: Guid,
): boolean {
  return softExitDepartureForGamePlayer(data, gameId, gamePlayerId) !== null;
}

/** Soft-exited game player ids in a game (Second yellow, red, injury). */
export function softExitedGamePlayerIds(
  data: DatabaseDto,
  gameId: Guid,
): Set<Guid> {
  const ids = new Set<Guid>();
  for (const row of getGameDepartures(data, gameId)) {
    if (departureKindSoftExits(row.Kind)) ids.add(row.GamePlayerId);
  }
  return ids;
}

/**
 * Player ids ineligible for a given game because they soft-exited in an earlier
 * game in the same match.
 */
/** Player ids who soft-exited in any game of this match (for match roster display). */
export function matchDepartedPlayerIds(
  data: DatabaseDto,
  matchId: Guid,
): Map<Guid, GameEventPlayerDepartureKind> {
  const departed = new Map<Guid, GameEventPlayerDepartureKind>();
  for (const { gameId } of getMatchGames(data, matchId)) {
    for (const info of getGamePlayerInfos(data, matchId, gameId)) {
      const row = softExitDepartureForGamePlayer(data, gameId, info.gamePlayerId);
      if (row) departed.set(info.playerId, row.Kind);
    }
  }
  return departed;
}

export function matchIneligiblePlayerIds(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
): Set<Guid> {
  const ineligible = new Set<Guid>();
  const targetOrdinal =
    getMatchGames(data, matchId).find((row) => row.gameId === gameId) !== undefined
      ? getMatchGames(data, matchId).findIndex((row) => row.gameId === gameId)
      : -1;
  if (targetOrdinal < 0) return ineligible;

  const games = getMatchGames(data, matchId);
  const playerIdByGamePlayerId = new Map<Guid, Guid>();
  for (const { gameId: priorGameId } of games.slice(0, targetOrdinal)) {
    for (const info of getGamePlayerInfos(data, matchId, priorGameId)) {
      playerIdByGamePlayerId.set(info.gamePlayerId, info.playerId);
    }
    for (const row of getGameDepartures(data, priorGameId)) {
      if (!departureKindSoftExits(row.Kind)) continue;
      const playerId = playerIdByGamePlayerId.get(row.GamePlayerId);
      if (playerId) ineligible.add(playerId);
    }
  }
  return ineligible;
}

export function isPlayerIneligibleForGame(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  playerId: Guid,
): boolean {
  return matchIneligiblePlayerIds(data, matchId, gameId).has(playerId);
}

/** Roster label for a soft-exited player (distinct from elimination out-queue). */
export function formatDepartedPlayerLabel(
  playerName: string,
  kind: GameEventPlayerDepartureKind | undefined,
): string {
  if (kind === undefined) return `${playerName} (left)`;
  switch (kind) {
    case GameEventPlayerDepartureKind.Injury:
      return `${playerName} (injury)`;
    case GameEventPlayerDepartureKind.Red:
      return `${playerName} (red card)`;
    case GameEventPlayerDepartureKind.SecondYellow:
      return `${playerName} (2nd yellow)`;
    default:
      return `${playerName} (left)`;
  }
}

export function departedPlayerIdsFromSoftExit(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  softExitedGamePlayerIds: ReadonlySet<Guid>,
): { departedIds: Set<string>; departureKindByPlayerId: Map<string, GameEventPlayerDepartureKind> } {
  const departedIds = new Set<string>();
  const departureKindByPlayerId = new Map<string, GameEventPlayerDepartureKind>();
  for (const gamePlayerId of softExitedGamePlayerIds) {
    const info = getGamePlayerInfos(data, matchId, gameId).find(
      (row) => row.gamePlayerId === gamePlayerId,
    );
    if (!info) continue;
    departedIds.add(info.playerId);
    const departure = softExitDepartureForGamePlayer(data, gameId, gamePlayerId);
    if (departure) departureKindByPlayerId.set(info.playerId, departure.Kind);
  }
  return { departedIds, departureKindByPlayerId };
}

export function sortRosterWithDepartures<T extends { player: { Id: string; Name: string } }>(
  rows: T[],
  departedPlayerIds: ReadonlySet<string>,
  eliminatedPlayerIds: ReadonlySet<string>,
  eliminationOrder?: ReadonlyMap<string, number>,
): T[] {
  return [...rows].sort((a, b) => {
    const aDeparted = departedPlayerIds.has(a.player.Id);
    const bDeparted = departedPlayerIds.has(b.player.Id);
    if (aDeparted !== bDeparted) return aDeparted ? 1 : -1;
    const aOut = eliminatedPlayerIds.has(a.player.Id);
    const bOut = eliminatedPlayerIds.has(b.player.Id);
    if (aOut !== bOut) return aOut ? 1 : -1;
    if (aOut && bOut && eliminationOrder) {
      const aOrder = eliminationOrder.get(a.player.Id) ?? Number.POSITIVE_INFINITY;
      const bOrder = eliminationOrder.get(b.player.Id) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }
    return a.player.Name.localeCompare(b.player.Name);
  });
}

export function sortGamePlayerInfosWithDepartures(
  players: GamePlayerInfo[],
  softExitedGamePlayerIds: ReadonlySet<Guid>,
  eliminatedGamePlayerIds: ReadonlySet<Guid>,
  eliminationOrder?: ReadonlyMap<Guid, number>,
): GamePlayerInfo[] {
  return [...players].sort((a, b) => {
    const aDeparted = softExitedGamePlayerIds.has(a.gamePlayerId);
    const bDeparted = softExitedGamePlayerIds.has(b.gamePlayerId);
    if (aDeparted !== bDeparted) return aDeparted ? 1 : -1;
    const aOut = eliminatedGamePlayerIds.has(a.gamePlayerId);
    const bOut = eliminatedGamePlayerIds.has(b.gamePlayerId);
    if (aOut !== bOut) return aOut ? 1 : -1;
    if (aOut && bOut && eliminationOrder) {
      const aOrder = eliminationOrder.get(a.gamePlayerId) ?? Number.POSITIVE_INFINITY;
      const bOrder = eliminationOrder.get(b.gamePlayerId) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }
    return a.playerName.localeCompare(b.playerName);
  });
}
