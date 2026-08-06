import type { DatabaseDto, Guid } from '../types';

export type TeamRow = { Id: Guid; Name: string };
export type PlayerRow = { Id: Guid; Name: string };
export type TeamPlayerRow = { TeamId: Guid; PlayerId: Guid };
export type MatchRow = { Id: Guid; TeamIdHome: Guid; TeamIdAway: Guid };
export type MatchPlayerRow = {
  Id: Guid;
  MatchId: Guid;
  PlayerId: Guid;
  TeamHome: boolean;
};
export type GameRow = {
  Id: Guid;
  /** Optional seconds into the match VOD where this game begins. */
  VideoStartSeconds?: number | null;
};
export type GamePlayerRow = { Id: Guid; GameId: Guid; MatchPlayerId: Guid };
export type MatchEventRow = { Id: Guid; MatchId: Guid; Ordinal: number };
export type MatchEventGameRow = { MatchEventId: Guid; GameId: Guid };
export type GameEventRow = {
  Id: Guid;
  GameId: Guid;
  Ordinal: number;
  /** Seconds into the YouTube video when this event was recorded. */
  VideoOffsetSeconds?: number | null;
};
export type GameEventThrowRow = { GameEventId: Guid };
export type GameEventErrorRow = {
  GameEventId: Guid;
  OffenderId: Guid;
  OffenseId: number;
};
export type GameEventFinishRow = { GameEventId: Guid; ResultId: number };
export type ThrowRow = {
  Id: Guid;
  GameEventThrowId: Guid;
  Ordinal: number;
  ThrowerId: Guid;
  TargetId: Guid;
  RecoveredId?: Guid | null;
  ResultId: number;
};
export type DeflectionRow = {
  Id: Guid;
  ThrowId: Guid;
  Ordinal: number;
  ReceiverId: Guid;
  ResultId: number;
};

function table<T>(data: DatabaseDto, name: string): T[] {
  return (data.Tables[name] ?? []) as T[];
}

export type PlayerOverview = { player: PlayerRow; team: TeamRow };
export type MatchOverview = {
  match: MatchRow;
  teamHome: TeamRow;
  teamAway: TeamRow;
  matchPlayers: MatchPlayerRow[];
};
export type GameOverview = {
  match: MatchRow;
  matchEvent: MatchEventRow;
  game: GameRow;
  gamePlayers: GamePlayerRow[];
};

export type ThrowDetail = {
  throwRow: ThrowRow;
  deflections: DeflectionRow[];
};

export function buildPlayerOverviews(data: DatabaseDto): Map<Guid, PlayerOverview> {
  const teams = new Map(table<TeamRow>(data, 'Team').map((team) => [team.Id, team]));
  const teamByPlayer = new Map<Guid, Guid>();
  for (const row of table<TeamPlayerRow>(data, 'TeamPlayer')) {
    teamByPlayer.set(row.PlayerId, row.TeamId);
  }
  const overviews = new Map<Guid, PlayerOverview>();
  for (const player of table<PlayerRow>(data, 'Player')) {
    const teamId = teamByPlayer.get(player.Id);
    const team = teamId ? teams.get(teamId) : undefined;
    if (team) overviews.set(player.Id, { player, team });
  }
  return overviews;
}

export function buildMatchOverviews(data: DatabaseDto): Map<Guid, MatchOverview> {
  const teams = new Map(table<TeamRow>(data, 'Team').map((team) => [team.Id, team]));
  const matchPlayersByMatch = new Map<Guid, MatchPlayerRow[]>();
  for (const row of table<MatchPlayerRow>(data, 'MatchPlayer')) {
    const list = matchPlayersByMatch.get(row.MatchId) ?? [];
    list.push(row);
    matchPlayersByMatch.set(row.MatchId, list);
  }
  const overviews = new Map<Guid, MatchOverview>();
  for (const match of table<MatchRow>(data, 'Match')) {
    const teamHome = teams.get(match.TeamIdHome);
    const teamAway = teams.get(match.TeamIdAway);
    if (!teamHome || !teamAway) continue;
    overviews.set(match.Id, {
      match,
      teamHome,
      teamAway,
      matchPlayers: matchPlayersByMatch.get(match.Id) ?? [],
    });
  }
  return overviews;
}

export function buildGameOverviews(data: DatabaseDto): Map<Guid, GameOverview> {
  const matches = new Map(table<MatchRow>(data, 'Match').map((match) => [match.Id, match]));
  const matchEvents = new Map(
    table<MatchEventRow>(data, 'MatchEvent').map((row) => [row.Id, row]),
  );
  const games = new Map(table<GameRow>(data, 'Game').map((game) => [game.Id, game]));
  const gamePlayersByGame = new Map<Guid, GamePlayerRow[]>();
  for (const row of table<GamePlayerRow>(data, 'GamePlayer')) {
    const list = gamePlayersByGame.get(row.GameId) ?? [];
    list.push(row);
    gamePlayersByGame.set(row.GameId, list);
  }
  const overviews = new Map<Guid, GameOverview>();
  for (const link of table<MatchEventGameRow>(data, 'MatchEventGame')) {
    const matchEvent = matchEvents.get(link.MatchEventId);
    const game = games.get(link.GameId);
    if (!matchEvent || !game) continue;
    const match = matches.get(matchEvent.MatchId);
    if (!match) continue;
    overviews.set(game.Id, {
      match,
      matchEvent,
      game,
      gamePlayers: gamePlayersByGame.get(game.Id) ?? [],
    });
  }
  return overviews;
}

export function buildMatchEventsByMatch(data: DatabaseDto): Map<Guid, MatchEventRow[]> {
  const byMatch = new Map<Guid, MatchEventRow[]>();
  for (const row of table<MatchEventRow>(data, 'MatchEvent')) {
    const list = byMatch.get(row.MatchId) ?? [];
    list.push(row);
    byMatch.set(row.MatchId, list);
  }
  for (const list of byMatch.values()) {
    list.sort((a, b) => a.Ordinal - b.Ordinal);
  }
  return byMatch;
}

export function buildGameEventsByGame(data: DatabaseDto): Map<Guid, GameEventRow[]> {
  const byGame = new Map<Guid, GameEventRow[]>();
  for (const row of table<GameEventRow>(data, 'GameEvent')) {
    const list = byGame.get(row.GameId) ?? [];
    list.push(row);
    byGame.set(row.GameId, list);
  }
  for (const list of byGame.values()) {
    list.sort((a, b) => a.Ordinal - b.Ordinal);
  }
  return byGame;
}

export function buildThrowsDetail(data: DatabaseDto): Map<Guid, ThrowDetail[]> {
  const throws = table<ThrowRow>(data, 'Throw');
  const deflectionsByThrow = new Map<Guid, DeflectionRow[]>();
  for (const deflection of table<DeflectionRow>(data, 'Deflection')) {
    const list = deflectionsByThrow.get(deflection.ThrowId) ?? [];
    list.push(deflection);
    deflectionsByThrow.set(deflection.ThrowId, list);
  }
  for (const list of deflectionsByThrow.values()) {
    list.sort((a, b) => a.Ordinal - b.Ordinal);
  }
  const byGameEventThrow = new Map<Guid, ThrowDetail[]>();
  for (const throwRow of throws) {
    const detail: ThrowDetail = {
      throwRow,
      deflections: deflectionsByThrow.get(throwRow.Id) ?? [],
    };
    const list = byGameEventThrow.get(throwRow.GameEventThrowId) ?? [];
    list.push(detail);
    byGameEventThrow.set(throwRow.GameEventThrowId, list);
  }
  for (const list of byGameEventThrow.values()) {
    list.sort((a, b) => a.throwRow.Ordinal - b.throwRow.Ordinal);
  }
  return byGameEventThrow;
}

export function indexByGameEventId<T extends { GameEventId: Guid }>(
  rows: T[],
): Map<Guid, T> {
  return new Map(rows.map((row) => [row.GameEventId, row]));
}

export function indexMatchEventGames(data: DatabaseDto): Map<Guid, MatchEventGameRow> {
  const map = new Map<Guid, MatchEventGameRow>();
  for (const row of table<MatchEventGameRow>(data, 'MatchEventGame')) {
    map.set(row.MatchEventId, row);
  }
  return map;
}

export function indexMatchPlayers(data: DatabaseDto): Map<Guid, MatchPlayerRow> {
  return new Map(
    table<MatchPlayerRow>(data, 'MatchPlayer').map((row) => [row.Id, row]),
  );
}

export function indexGamePlayers(data: DatabaseDto): Map<Guid, GamePlayerRow> {
  return new Map(
    table<GamePlayerRow>(data, 'GamePlayer').map((row) => [row.Id, row]),
  );
}

export function indexGameEventThrows(data: DatabaseDto): Map<Guid, GameEventThrowRow> {
  return indexByGameEventId(table<GameEventThrowRow>(data, 'GameEventThrow'));
}

export function indexGameEventErrors(data: DatabaseDto): Map<Guid, GameEventErrorRow> {
  return indexByGameEventId(table<GameEventErrorRow>(data, 'GameEventError'));
}

export function indexGameEventFinishes(data: DatabaseDto): Map<Guid, GameEventFinishRow> {
  return indexByGameEventId(table<GameEventFinishRow>(data, 'GameEventFinish'));
}

export function getMatchEventGameByGameId(
  data: DatabaseDto,
  gameId: Guid,
): MatchEventGameRow | undefined {
  return table<MatchEventGameRow>(data, 'MatchEventGame').find(
    (row) => row.GameId === gameId,
  );
}
