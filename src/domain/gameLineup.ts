import { GameEventPlayerDepartureKind } from './statistics/constants';
import type { DatabaseDto, Guid } from './types';

function table<T>(data: DatabaseDto, name: string): T[] {
  return (data.Tables[name] ?? []) as T[];
}

export type GameEventPlayerDepartureRow = {
  GameEventId: Guid;
  PlayerGamePlayerId: Guid;
  Kind: GameEventPlayerDepartureKind;
};

export const playerDepartureKindLabels: Record<GameEventPlayerDepartureKind, string> = {
  [GameEventPlayerDepartureKind.Yellow]: 'Yellow card',
  [GameEventPlayerDepartureKind.Blue]: 'Blue card',
  [GameEventPlayerDepartureKind.SecondYellow]: 'Second yellow',
  [GameEventPlayerDepartureKind.Red]: 'Red card',
  [GameEventPlayerDepartureKind.Injury]: 'Injury',
};

/**
 * Soft-exit: frees an on-court slot, not throw/error selectable, not catch-recoverable.
 * Yellow / second yellow / red / injury — not blue (blue is a normal out).
 * Coerce with Number() so cloud/JSON string kinds still match numeric enums.
 */
export function playerDepartureKindSoftExits(
  kind: GameEventPlayerDepartureKind | number | string,
): boolean {
  const value = Number(kind);
  return (
    value === GameEventPlayerDepartureKind.Yellow ||
    value === GameEventPlayerDepartureKind.SecondYellow ||
    value === GameEventPlayerDepartureKind.Red ||
    value === GameEventPlayerDepartureKind.Injury
  );
}

/** @deprecated Use {@link playerDepartureKindSoftExits}. */
export const playerDepartureKindExits = playerDepartureKindSoftExits;

/** Ban from every later game in this match. */
export function playerDepartureKindBansRestOfMatch(
  kind: GameEventPlayerDepartureKind | number | string,
): boolean {
  const value = Number(kind);
  return (
    value === GameEventPlayerDepartureKind.SecondYellow ||
    value === GameEventPlayerDepartureKind.Red ||
    value === GameEventPlayerDepartureKind.Injury
  );
}

/** Ban from the immediately following game only. */
export function playerDepartureKindBansNextGame(
  kind: GameEventPlayerDepartureKind | number | string,
): boolean {
  return Number(kind) === GameEventPlayerDepartureKind.Yellow;
}

/** Immediate out that can still return on a catch (like a line-out). */
export function playerDepartureKindEliminatesRecoverable(
  kind: GameEventPlayerDepartureKind | number | string,
): boolean {
  return Number(kind) === GameEventPlayerDepartureKind.Blue;
}

/** Soft-exit that should prompt scorers to add a replacement. */
export function playerDepartureKindNeedsReplacementHint(
  kind: GameEventPlayerDepartureKind,
): boolean {
  return playerDepartureKindSoftExits(kind);
}

export function indexGameEventPlayerDepartures(
  data: DatabaseDto,
): Map<Guid, GameEventPlayerDepartureRow> {
  const map = new Map<Guid, GameEventPlayerDepartureRow>();
  for (const row of table<GameEventPlayerDepartureRow>(data, 'GameEventPlayerDeparture')) {
    map.set(row.GameEventId, row);
  }
  return map;
}

function gameEventIdsForGame(data: DatabaseDto, gameId: Guid): Set<Guid> {
  return new Set(
    table<{ Id: Guid; GameId: Guid }>(data, 'GameEvent')
      .filter((row) => row.GameId === gameId)
      .map((row) => row.Id),
  );
}

/** Soft-exited game players for this game. */
export function getDepartedGamePlayerIds(
  data: DatabaseDto,
  gameId: Guid,
): Set<Guid> {
  const eventIds = gameEventIdsForGame(data, gameId);
  const departed = new Set<Guid>();
  for (const row of table<GameEventPlayerDepartureRow>(data, 'GameEventPlayerDeparture')) {
    if (!eventIds.has(row.GameEventId)) continue;
    if (!playerDepartureKindSoftExits(row.Kind)) continue;
    departed.add(row.PlayerGamePlayerId);
  }
  return departed;
}

/** Latest soft-exit departure kind per game player in this game. */
export function getDepartureKindByGamePlayerId(
  data: DatabaseDto,
  gameId: Guid,
): Map<Guid, GameEventPlayerDepartureKind> {
  const events = table<{ Id: Guid; GameId: Guid; Ordinal: number }>(data, 'GameEvent')
    .filter((row) => row.GameId === gameId)
    .sort((a, b) => a.Ordinal - b.Ordinal);
  const byId = indexGameEventPlayerDepartures(data);
  const kinds = new Map<Guid, GameEventPlayerDepartureKind>();
  for (const event of events) {
    const row = byId.get(event.Id);
    if (!row || !playerDepartureKindSoftExits(row.Kind)) continue;
    kinds.set(row.PlayerGamePlayerId, row.Kind);
  }
  return kinds;
}

/** Player button / roster label after a soft exit, e.g. `Alex (left — injury)`. */
export function formatDepartedPlayerLabel(
  playerName: string,
  kind: GameEventPlayerDepartureKind | number | string | undefined,
): string {
  if (kind === undefined || kind === null || Number.isNaN(Number(kind))) {
    return `${playerName} (left)`;
  }
  const value = Number(kind);
  const short =
    value === GameEventPlayerDepartureKind.Injury
      ? 'injury'
      : value === GameEventPlayerDepartureKind.Red
        ? 'red'
        : value === GameEventPlayerDepartureKind.SecondYellow
          ? '2nd yellow'
          : value === GameEventPlayerDepartureKind.Yellow
            ? 'yellow'
            : 'left';
  return `${playerName} (left — ${short})`;
}

function orderedMatchGameIds(data: DatabaseDto, matchId: Guid): Guid[] {
  const matchEvents = table<{ Id: Guid; MatchId: Guid; Ordinal: number }>(
    data,
    'MatchEvent',
  )
    .filter((row) => row.MatchId === matchId)
    .sort((a, b) => a.Ordinal - b.Ordinal);
  const links = table<{ MatchEventId: Guid; GameId: Guid }>(data, 'MatchEventGame');
  const gameIds: Guid[] = [];
  for (const event of matchEvents) {
    const link = links.find((row) => row.MatchEventId === event.Id);
    if (link) gameIds.push(link.GameId);
  }
  return gameIds;
}

function playerIdsFromSoftExitsInGame(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  kindFilter: (kind: GameEventPlayerDepartureKind) => boolean,
): Set<Guid> {
  const gamePlayers = new Map(
    table<{ Id: Guid; MatchPlayerId: Guid; GameId: Guid }>(data, 'GamePlayer')
      .filter((row) => row.GameId === gameId)
      .map((row) => [row.Id, row.MatchPlayerId]),
  );
  const matchPlayers = new Map(
    table<{ Id: Guid; MatchId: Guid; PlayerId: Guid }>(data, 'MatchPlayer')
      .filter((row) => row.MatchId === matchId)
      .map((row) => [row.Id, row.PlayerId]),
  );
  const eventIds = gameEventIdsForGame(data, gameId);
  const playerIds = new Set<Guid>();
  for (const row of table<GameEventPlayerDepartureRow>(data, 'GameEventPlayerDeparture')) {
    if (!eventIds.has(row.GameEventId)) continue;
    if (!kindFilter(row.Kind)) continue;
    const matchPlayerId = gamePlayers.get(row.PlayerGamePlayerId);
    if (!matchPlayerId) continue;
    const playerId = matchPlayers.get(matchPlayerId);
    if (playerId) playerIds.add(playerId);
  }
  return playerIds;
}

/**
 * Players ineligible to join `forGameId` (or any later game when omitted).
 * Rest-of-match bans apply after second yellow / red / injury; yellow bans only
 * the immediately following game.
 */
export function getMatchIneligiblePlayerIds(
  data: DatabaseDto,
  matchId: Guid,
  forGameId?: Guid,
): Set<Guid> {
  const gameIds = orderedMatchGameIds(data, matchId);
  const ineligible = new Set<Guid>();

  for (const gameId of gameIds) {
    if (forGameId && gameId === forGameId) continue;
    if (forGameId) {
      const forIndex = gameIds.indexOf(forGameId);
      const gameIndex = gameIds.indexOf(gameId);
      if (forIndex < 0 || gameIndex < 0 || gameIndex >= forIndex) continue;
    }
    for (const playerId of playerIdsFromSoftExitsInGame(
      data,
      matchId,
      gameId,
      playerDepartureKindBansRestOfMatch,
    )) {
      ineligible.add(playerId);
    }
  }

  if (forGameId) {
    const forIndex = gameIds.indexOf(forGameId);
    const previousGameId = forIndex > 0 ? gameIds[forIndex - 1] : undefined;
    if (previousGameId) {
      for (const playerId of playerIdsFromSoftExitsInGame(
        data,
        matchId,
        previousGameId,
        playerDepartureKindBansNextGame,
      )) {
        ineligible.add(playerId);
      }
    }
  } else {
    // Match roster: treat rest-of-match bans + yellows that still have a next game.
    for (let index = 0; index < gameIds.length; index++) {
      const gameId = gameIds[index]!;
      for (const playerId of playerIdsFromSoftExitsInGame(
        data,
        matchId,
        gameId,
        playerDepartureKindBansRestOfMatch,
      )) {
        ineligible.add(playerId);
      }
      if (index < gameIds.length - 1) {
        for (const playerId of playerIdsFromSoftExitsInGame(
          data,
          matchId,
          gameId,
          playerDepartureKindBansNextGame,
        )) {
          ineligible.add(playerId);
        }
      }
    }
  }

  return ineligible;
}

export function isPlayerMatchIneligible(
  data: DatabaseDto,
  matchId: Guid,
  playerId: Guid,
  forGameId?: Guid,
): boolean {
  return getMatchIneligiblePlayerIds(data, matchId, forGameId).has(playerId);
}

/**
 * On-court bodies that count toward the players-per-side cap (excludes soft-exits).
 */
export function countNonDepartedGameSidePlayers(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  teamHome: boolean,
): number {
  const departed = getDepartedGamePlayerIds(data, gameId);
  const matchPlayers = new Map(
    table<{ Id: Guid; MatchId: Guid; TeamHome: boolean }>(data, 'MatchPlayer')
      .filter((row) => row.MatchId === matchId)
      .map((row) => [row.Id, row]),
  );
  return table<{ Id: Guid; GameId: Guid; MatchPlayerId: Guid }>(data, 'GamePlayer').filter(
    (row) => {
      if (row.GameId !== gameId) return false;
      if (departed.has(row.Id)) return false;
      return (
        Boolean(matchPlayers.get(row.MatchPlayerId)?.TeamHome) === Boolean(teamHome)
      );
    },
  ).length;
}

/**
 * Whether deleting a soft-exit departure would put the side over the players-per-side
 * cap (replacement already filled the freed slot).
 */
export function canDeletePlayerDepartureEvent(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  gameEventId: Guid,
  playersPerSide: number,
): boolean {
  const row = table<GameEventPlayerDepartureRow>(data, 'GameEventPlayerDeparture').find(
    (entry) => entry.GameEventId === gameEventId,
  );
  if (!row || !playerDepartureKindSoftExits(row.Kind)) return true;

  const matchPlayers = new Map(
    table<{ Id: Guid; MatchId: Guid; TeamHome: boolean }>(data, 'MatchPlayer')
      .filter((entry) => entry.MatchId === matchId)
      .map((entry) => [entry.Id, entry]),
  );
  const gamePlayer = table<{ Id: Guid; GameId: Guid; MatchPlayerId: Guid }>(
    data,
    'GamePlayer',
  ).find((entry) => entry.Id === row.PlayerGamePlayerId && entry.GameId === gameId);
  if (!gamePlayer) return true;
  const teamHome = matchPlayers.get(gamePlayer.MatchPlayerId)?.TeamHome;
  if (teamHome === undefined) return true;

  const current = countNonDepartedGameSidePlayers(data, matchId, gameId, teamHome);
  return current + 1 <= playersPerSide;
}
