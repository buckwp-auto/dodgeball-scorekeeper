import { newIdTimestamp } from './id';
import type { DatabaseDto, Guid, MatchPlayerRow, MatchRow, PlayerRow } from './types';
import { getPlayersForTeam } from './database';

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
): void {
  const rows = table<MatchPlayerRow>(data, 'MatchPlayer');
  const index = rows.findIndex(
    (row) => row.MatchId === matchId && row.PlayerId === playerId,
  );
  if (index >= 0) {
    rows.splice(index, 1);
    return;
  }
  pushRow(data, 'MatchPlayer', {
    Id: newIdTimestamp(),
    MatchId: matchId,
    PlayerId: playerId,
    TeamHome: teamHome,
  });
}

export function getMatchSidePlayers(
  data: DatabaseDto,
  match: MatchRow,
  teamHome: boolean,
): PlayerRow[] {
  const teamId = teamHome ? match.TeamIdHome : match.TeamIdAway;
  return getPlayersForTeam(data, teamId);
}

export function getMatchGames(
  data: DatabaseDto,
  matchId: Guid,
): { gameId: Guid; label: string }[] {
  const matchEvents = table<{ Id: Guid; MatchId: Guid; Ordinal: number }>(
    data,
    'MatchEvent',
  )
    .filter((row) => row.MatchId === matchId)
    .sort((a, b) => a.Ordinal - b.Ordinal);

  return matchEvents.map((matchEvent, index) => {
    const link = table<{ MatchEventId: Guid; GameId: Guid }>(
      data,
      'MatchEventGame',
    ).find((row) => row.MatchEventId === matchEvent.Id);
    return {
      gameId: link?.GameId ?? '',
      label: `Game ${index + 1}`,
    };
  }).filter((row) => row.gameId);
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
  if (!getMatchById(data, matchId)) throw new Error('Match not found');
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

export function toggleGamePlayer(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  playerId: Guid,
): void {
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
    return;
  }
  pushRow(data, 'GamePlayer', {
    Id: newIdTimestamp(),
    GameId: gameId,
    MatchPlayerId: matchPlayer.Id,
  });
}

export type MatchSidePlayer = {
  player: PlayerRow;
  selected: boolean;
};

export function getMatchSidePlayersWithSelection(
  data: DatabaseDto,
  match: MatchRow,
  teamHome: boolean,
): MatchSidePlayer[] {
  return getMatchSidePlayers(data, match, teamHome).map((player) => ({
    player,
    selected: isPlayerInMatch(data, match.Id, player.Id),
  }));
}

export function getGameSidePlayersWithSelection(
  data: DatabaseDto,
  match: MatchRow,
  gameId: Guid,
  teamHome: boolean,
): MatchSidePlayer[] {
  return getMatchSidePlayersWithSelection(data, match, teamHome)
    .filter(({ selected }) => selected)
    .map(({ player }) => ({
      player,
      selected: isPlayerInGame(data, gameId, player.Id, match.Id),
    }));
}
