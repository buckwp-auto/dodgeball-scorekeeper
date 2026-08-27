import { newIdTimestamp } from './id';
import { resolvePlayersPerSide } from './leagueSettings';
import { linkPlayer } from './playerMatch';
import type { DatabaseDto, Guid, MatchPlayerRow, MatchRow, PlayerRow } from './types';
import { addPlayer, getPlayer, getPlayersForTeam } from './database';

function table<T>(data: DatabaseDto, name: string): T[] {
  return data.Tables[name] as T[];
}

function pushRow<T>(data: DatabaseDto, tableName: string, row: T): T {
  const rows = table<T>(data, tableName);
  rows.push(row);
  return row;
}

export function getMatchById(data: DatabaseDto, matchId: Guid): MatchRow | undefined {
  return table<MatchRow>(data, 'Match').find((match) => match.Id === matchId);
}

export function getMatchIdForGame(data: DatabaseDto, gameId: Guid): Guid | undefined {
  const link = table<{ MatchEventId: Guid; GameId: Guid }>(data, 'MatchEventGame').find(
    (row) => row.GameId === gameId,
  );
  if (!link) return undefined;
  return table<{ Id: Guid; MatchId: Guid }>(data, 'MatchEvent').find(
    (row) => row.Id === link.MatchEventId,
  )?.MatchId;
}

export function getMatchPlayers(data: DatabaseDto, matchId: Guid): MatchPlayerRow[] {
  return table<MatchPlayerRow>(data, 'MatchPlayer').filter(
    (row) => row.MatchId === matchId,
  );
}

export function isPlayerInMatch(
  data: DatabaseDto,
  matchId: Guid,
  playerId: Guid,
): boolean {
  return getMatchPlayers(data, matchId).some((row) => row.PlayerId === playerId);
}

export function canNavigateToMatchPage(data: DatabaseDto, matchId: Guid): boolean {
  const rows = getMatchPlayers(data, matchId);
  return (
    rows.some((row) => row.TeamHome) && rows.some((row) => !row.TeamHome)
  );
}

export function toggleMatchPlayer(
  data: DatabaseDto,
  matchId: Guid,
  playerId: Guid,
  teamHome: boolean,
  options?: { isSubstitute?: boolean },
): void {
  const rows = table<MatchPlayerRow>(data, 'MatchPlayer');
  const index = rows.findIndex(
    (row) => row.MatchId === matchId && row.PlayerId === playerId,
  );
  if (index >= 0) {
    const matchPlayerId = rows[index].Id;
    const usedInGame = table<{ MatchPlayerId: Guid }>(data, 'GamePlayer').some(
      (row) => row.MatchPlayerId === matchPlayerId,
    );
    if (usedInGame) return;
    rows.splice(index, 1);
    return;
  }
  pushRow(data, 'MatchPlayer', {
    Id: newIdTimestamp(),
    MatchId: matchId,
    PlayerId: playerId,
    TeamHome: teamHome,
    ...(options?.isSubstitute ? { IsSubstitute: true } : {}),
  });
}

export function setMatchPlayerSubstitute(
  data: DatabaseDto,
  matchId: Guid,
  playerId: Guid,
  isSubstitute: boolean,
): void {
  const row = getMatchPlayerRow(data, matchId, playerId);
  if (!row) return;
  if (isSubstitute) row.IsSubstitute = true;
  else delete row.IsSubstitute;
}

export function isMatchPlayerSubstitute(row: MatchPlayerRow): boolean {
  return Boolean(row.IsSubstitute);
}

/** Add a new team player and include them on this match roster. */
export function addPlayerToMatchSide(
  data: DatabaseDto,
  matchId: Guid,
  teamHome: boolean,
  name: string,
  isSubstitute = false,
  linkedPlayerId?: Guid,
): PlayerRow {
  const match = getMatchById(data, matchId);
  if (!match) throw new Error('Match not found');
  const teamId = teamHome ? match.TeamIdHome : match.TeamIdAway;
  const displayName = linkedPlayerId
    ? (getPlayer(data, linkedPlayerId)?.Name ?? name)
    : name;
  const player = addPlayer(data, teamId, displayName);
  player.AddedFromMatch = true;
  if (linkedPlayerId) linkPlayer(data, player.Id, linkedPlayerId);
  toggleMatchPlayer(data, matchId, player.Id, teamHome, { isSubstitute });
  return player;
}

/** Add a team+match player and try to put them on this game (no-op if the side is full). */
export function addPlayerToGameSide(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  teamHome: boolean,
  name: string,
  isSubstitute = false,
  linkedPlayerId?: Guid,
): PlayerRow {
  const player = addPlayerToMatchSide(
    data,
    matchId,
    teamHome,
    name,
    isSubstitute,
    linkedPlayerId,
  );
  toggleGamePlayer(data, matchId, gameId, player.Id);
  return player;
}

export function getMatchSidePlayers(
  data: DatabaseDto,
  match: MatchRow,
  teamHome: boolean,
): PlayerRow[] {
  const teamId = teamHome ? match.TeamIdHome : match.TeamIdAway;
  return getPlayersForTeam(data, teamId);
}

export type MatchGameListItem = {
  gameId: Guid;
  label: string;
  scoringComplete: boolean;
};

export function getMatchGames(
  data: DatabaseDto,
  matchId: Guid,
): MatchGameListItem[] {
  const matchEvents = table<{ Id: Guid; MatchId: Guid; Ordinal: number }>(
    data,
    'MatchEvent',
  )
    .filter((row) => row.MatchId === matchId)
    .sort((a, b) => a.Ordinal - b.Ordinal);

  const finishEventIds = new Set(
    table<{ GameEventId: Guid }>(data, 'GameEventFinish').map(
      (row) => row.GameEventId,
    ),
  );
  const eventsByGameId = new Map<Guid, Guid[]>();
  for (const event of table<{ Id: Guid; GameId: Guid }>(data, 'GameEvent')) {
    const list = eventsByGameId.get(event.GameId);
    if (list) list.push(event.Id);
    else eventsByGameId.set(event.GameId, [event.Id]);
  }

  return matchEvents
    .map((matchEvent, index) => {
      const link = table<{ MatchEventId: Guid; GameId: Guid }>(
        data,
        'MatchEventGame',
      ).find((row) => row.MatchEventId === matchEvent.Id);
      const gameId = link?.GameId ?? '';
      if (!gameId) return null;
      const eventIds = eventsByGameId.get(gameId) ?? [];
      const scoringComplete = eventIds.some((id) => finishEventIds.has(id));
      return {
        gameId,
        label: `Game ${index + 1}`,
        scoringComplete,
      };
    })
    .filter((row): row is MatchGameListItem => row !== null);
}

/** Adjacent game in match order, or null if none. */
export function getAdjacentGameId(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  direction: -1 | 1,
): Guid | null {
  const games = getMatchGames(data, matchId);
  const index = games.findIndex((row) => row.gameId === gameId);
  if (index < 0) return null;
  return games[index + direction]?.gameId ?? null;
}

export function getGameIdForMatchOrdinal(
  data: DatabaseDto,
  matchId: Guid,
  gameIndex: number,
): Guid | undefined {
  const matchEvents = table<{ Id: Guid; MatchId: Guid; Ordinal: number }>(
    data,
    'MatchEvent',
  )
    .filter((row) => row.MatchId === matchId)
    .sort((a, b) => a.Ordinal - b.Ordinal);
  const matchEvent = matchEvents[gameIndex];
  if (!matchEvent) return undefined;
  const link = table<{ MatchEventId: Guid; GameId: Guid }>(
    data,
    'MatchEventGame',
  ).find((row) => row.MatchEventId === matchEvent.Id);
  return link?.GameId;
}

export function getGameName(data: DatabaseDto, matchId: Guid, gameId: Guid): string {
  const matchEvents = table<{ Id: Guid; MatchId: Guid; Ordinal: number }>(
    data,
    'MatchEvent',
  )
    .filter((row) => row.MatchId === matchId)
    .sort((a, b) => a.Ordinal - b.Ordinal);
  for (let index = 0; index < matchEvents.length; index++) {
    const link = table<{ MatchEventId: Guid; GameId: Guid }>(
      data,
      'MatchEventGame',
    ).find((row) => row.MatchEventId === matchEvents[index].Id);
    if (link?.GameId === gameId) return `Game ${index + 1}`;
  }
  return 'Game';
}

export function addGame(data: DatabaseDto, matchId: Guid): Guid {
  const match = getMatchById(data, matchId);
  if (!match) throw new Error('Match not found');
  if (match.Ended) throw new Error('Match has ended');
  const existing = table<{ MatchId: Guid; Ordinal: number }>(data, 'MatchEvent').filter(
    (row) => row.MatchId === matchId,
  );
  const ordinal =
    existing.length === 0
      ? 1
      : Math.max(...existing.map((row) => row.Ordinal + 1));

  const gameId = newIdTimestamp();
  const matchEventId = newIdTimestamp();

  pushRow(data, 'Game', { Id: gameId });
  pushRow(data, 'MatchEvent', {
    Id: matchEventId,
    MatchId: matchId,
    Ordinal: ordinal,
    Notes: null,
  });
  pushRow(data, 'MatchEventGame', {
    MatchEventId: matchEventId,
    GameId: gameId,
  });

  // Seed immutable game-start event (ordinal 1) for video timestamping
  const startEventId = newIdTimestamp();
  pushRow(data, 'GameEvent', {
    Id: startEventId,
    GameId: gameId,
    Ordinal: 1,
    VideoOffsetSeconds: null,
  });
  pushRow(data, 'GameEventStart', { GameEventId: startEventId });

  return gameId;
}

function removeGameScopedRows(data: DatabaseDto, gameId: Guid): void {
  const gameEventIds = new Set(
    table<{ Id: Guid; GameId: Guid }>(data, 'GameEvent')
      .filter((row) => row.GameId === gameId)
      .map((row) => row.Id),
  );
  const throwIds = new Set(
    table<{ Id: Guid; GameEventThrowId: Guid }>(data, 'Throw')
      .filter((row) => gameEventIds.has(row.GameEventThrowId))
      .map((row) => row.Id),
  );

  data.Tables.Deflection = table(data, 'Deflection').filter(
    (row) => !throwIds.has((row as { ThrowId: Guid }).ThrowId),
  );
  data.Tables.Throw = table(data, 'Throw').filter(
    (row) => !throwIds.has((row as { Id: Guid }).Id),
  );
  data.Tables.GameEventThrow = table(data, 'GameEventThrow').filter(
    (row) => !gameEventIds.has((row as { GameEventId: Guid }).GameEventId),
  );
  data.Tables.GameEventError = table(data, 'GameEventError').filter(
    (row) => !gameEventIds.has((row as { GameEventId: Guid }).GameEventId),
  );
  data.Tables.GameEventFinish = table(data, 'GameEventFinish').filter(
    (row) => !gameEventIds.has((row as { GameEventId: Guid }).GameEventId),
  );
  data.Tables.GameEventStart = table(data, 'GameEventStart').filter(
    (row) => !gameEventIds.has((row as { GameEventId: Guid }).GameEventId),
  );
  data.Tables.GameEvent = table(data, 'GameEvent').filter(
    (row) => (row as { GameId: Guid }).GameId !== gameId,
  );
  data.Tables.GamePlayer = table(data, 'GamePlayer').filter(
    (row) => (row as { GameId: Guid }).GameId !== gameId,
  );
  data.Tables.Game = table(data, 'Game').filter(
    (row) => (row as { Id: Guid }).Id !== gameId,
  );
}

/** Removes a game and all of its events/players from a match. */
export function deleteGame(data: DatabaseDto, matchId: Guid, gameId: Guid): void {
  const link = table<{ MatchEventId: Guid; GameId: Guid }>(
    data,
    'MatchEventGame',
  ).find((row) => row.GameId === gameId);
  if (!link) throw new Error('Game not found');
  const matchEvent = table<{ Id: Guid; MatchId: Guid }>(data, 'MatchEvent').find(
    (row) => row.Id === link.MatchEventId,
  );
  if (!matchEvent || matchEvent.MatchId !== matchId) {
    throw new Error('Game not in match');
  }

  removeGameScopedRows(data, gameId);
  data.Tables.MatchEventGame = table(data, 'MatchEventGame').filter(
    (row) => (row as { GameId: Guid }).GameId !== gameId,
  );
  data.Tables.MatchEvent = table(data, 'MatchEvent').filter(
    (row) => (row as { Id: Guid }).Id !== link.MatchEventId,
  );
}

/** Removes a match, its roster, and every game/event under it. */
export function deleteMatch(data: DatabaseDto, matchId: Guid): void {
  if (!getMatchById(data, matchId)) throw new Error('Match not found');
  for (const { gameId } of getMatchGames(data, matchId)) {
    deleteGame(data, matchId, gameId);
  }
  data.Tables.MatchEvent = table<{ MatchId: Guid }>(data, 'MatchEvent').filter(
    (row) => row.MatchId !== matchId,
  );
  data.Tables.MatchPlayer = table<{ MatchId: Guid }>(data, 'MatchPlayer').filter(
    (row) => row.MatchId !== matchId,
  );
  data.Tables.Match = table<{ Id: Guid }>(data, 'Match').filter(
    (row) => row.Id !== matchId,
  );
}

export function getGamePlayers(data: DatabaseDto, gameId: Guid) {
  return table<{ Id: Guid; GameId: Guid; MatchPlayerId: Guid }>(
    data,
    'GamePlayer',
  ).filter((row) => row.GameId === gameId);
}

function getMatchPlayerRow(
  data: DatabaseDto,
  matchId: Guid,
  playerId: Guid,
): MatchPlayerRow | undefined {
  return getMatchPlayers(data, matchId).find((row) => row.PlayerId === playerId);
}

export function isPlayerInGame(
  data: DatabaseDto,
  gameId: Guid,
  playerId: Guid,
  matchId: Guid,
): boolean {
  const matchPlayer = getMatchPlayerRow(data, matchId, playerId);
  if (!matchPlayer) return false;
  return getGamePlayers(data, gameId).some(
    (row) => row.MatchPlayerId === matchPlayer.Id,
  );
}

export function getGamePlayerId(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  playerId: Guid,
): Guid | undefined {
  const matchPlayer = getMatchPlayerRow(data, matchId, playerId);
  if (!matchPlayer) return undefined;
  return getGamePlayers(data, gameId).find(
    (row) => row.MatchPlayerId === matchPlayer.Id,
  )?.Id;
}

export function countGameSidePlayers(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  teamHome: boolean,
): number {
  const matchPlayers = new Map(
    getMatchPlayers(data, matchId).map((row) => [row.Id, row]),
  );
  return getGamePlayers(data, gameId).filter(
    (row) => matchPlayers.get(row.MatchPlayerId)?.TeamHome === teamHome,
  ).length;
}

export function canNavigateToGameEvents(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
): boolean {
  const gamePlayers = getGamePlayers(data, gameId);
  const matchPlayers = getMatchPlayers(data, matchId);
  const byMatchPlayerId = new Map(matchPlayers.map((row) => [row.Id, row]));
  let home = false;
  let away = false;
  for (const gamePlayer of gamePlayers) {
    const matchPlayer = byMatchPlayerId.get(gamePlayer.MatchPlayerId);
    if (!matchPlayer) continue;
    if (matchPlayer.TeamHome) home = true;
    else away = true;
  }
  return home && away;
}

/** @returns true when the on-court roster changed */
export function toggleGamePlayer(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  playerId: Guid,
): boolean {
  const matchPlayer = getMatchPlayerRow(data, matchId, playerId);
  if (!matchPlayer) throw new Error('Player not in match');
  const rows = table<{ Id: Guid; GameId: Guid; MatchPlayerId: Guid }>(
    data,
    'GamePlayer',
  );
  const index = rows.findIndex(
    (row) => row.GameId === gameId && row.MatchPlayerId === matchPlayer.Id,
  );
  if (index >= 0) {
    rows.splice(index, 1);
    return true;
  }
  const limit = resolvePlayersPerSide(data);
  if (countGameSidePlayers(data, matchId, gameId, matchPlayer.TeamHome) >= limit) {
    return false;
  }
  pushRow(data, 'GamePlayer', {
    Id: newIdTimestamp(),
    GameId: gameId,
    MatchPlayerId: matchPlayer.Id,
  });
  return true;
}

export type MatchSidePlayer = {
  player: PlayerRow;
  selected: boolean;
  substitute: boolean;
};

export function getMatchSidePlayersWithSelection(
  data: DatabaseDto,
  match: MatchRow,
  teamHome: boolean,
): MatchSidePlayer[] {
  const rows = getMatchPlayers(data, match.Id);
  const byPlayerId = new Map(rows.map((row) => [row.PlayerId, row]));
  const mapped = getMatchSidePlayers(data, match, teamHome).map((player) => {
    const matchPlayer = byPlayerId.get(player.Id);
    return {
      player,
      selected: Boolean(matchPlayer),
      substitute: Boolean(matchPlayer?.IsSubstitute),
    };
  });
  return sortMatchSidePlayers(mapped);
}

export function getGameSidePlayersWithSelection(
  data: DatabaseDto,
  match: MatchRow,
  gameId: Guid,
  teamHome: boolean,
): MatchSidePlayer[] {
  return getMatchSidePlayersWithSelection(data, match, teamHome)
    .filter(({ selected }) => selected)
    .map(({ player, substitute }) => ({
      player,
      selected: isPlayerInGame(data, gameId, player.Id, match.Id),
      substitute,
    }));
}

export function sortMatchSidePlayers<
  T extends { selected: boolean; substitute: boolean; player: { Id: string; Name: string } },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const rank = (row: T) =>
      row.selected ? (row.substitute ? 1 : 0) : row.substitute ? 3 : 2;
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return (
      a.player.Name.localeCompare(b.player.Name) || a.player.Id.localeCompare(b.player.Id)
    );
  });
}
