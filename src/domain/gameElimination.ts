import type { DatabaseDto, Guid } from './types';
import {
  DeflectionResult,
  GameEventErrorOffense,
  GameEventFinishResult,
  ThrowResult,
} from './statistics/constants';
import {
  isDeprecatedFailedDeflectionResult,
  isDeprecatedFailedThrowResult,
  isDisarmDeflectionResult,
  isDisarmThrowResult,
} from './throwResults';
import {
  buildThrowsDetail,
  indexGameEventErrors,
} from './statistics/databaseViews';
import {
  getGamePlayerInfos,
  getGameEvents,
  type GamePlayerInfo,
  type ThrowDraft,
} from './gameEvents';
import { AUTO_SELECT_PLAYER_LIMIT } from './rosterAutoSelect';

export { AUTO_SELECT_PLAYER_LIMIT };

export type GameLiveState = {
  eliminatedGamePlayerIds: ReadonlySet<Guid>;
  /** Video offset of the event that put each out player out; null when untimed. */
  eliminatedAtSeconds: ReadonlyMap<Guid, number | null>;
  /**
   * 1-based return-queue rank among currently out players on the same team
   * (1st = next back in on a catch by default).
   */
  eliminationOrder: ReadonlyMap<Guid, number>;
  activeHomeCount: number;
  activeAwayCount: number;
  isGameOver: boolean;
  /** When all players on one side are out, the other side wins the live game. */
  winningTeamHome: boolean | null;
  hasFinishEvent: boolean;
};

/** Finish result implied by a live team-wipe winner. */
export function finishResultForLiveWinner(
  winningTeamHome: boolean | null,
): GameEventFinishResult | null {
  if (winningTeamHome === true) return GameEventFinishResult.WinHome;
  if (winningTeamHome === false) return GameEventFinishResult.WinAway;
  return null;
}

function throwIsCatch(
  resultId: number,
  deflections: { ResultId: number }[],
): boolean {
  if (resultId === ThrowResult.Catch) return true;
  return deflections.some((row) => row.ResultId === DeflectionResult.Catch);
}

function throwTargetEliminated(resultId: number): boolean {
  return (
    resultId === ThrowResult.Hit ||
    resultId === ThrowResult.Disarm ||
    isDeprecatedFailedThrowResult(resultId)
  );
}

function deflectionEliminatesReceiver(resultId: number): boolean {
  return (
    resultId === DeflectionResult.Hit ||
    resultId === DeflectionResult.Disarm ||
    isDeprecatedFailedDeflectionResult(resultId)
  );
}

function markOut(eliminated: Set<Guid>, outSequence: Guid[], gamePlayerId: Guid): void {
  if (eliminated.has(gamePlayerId)) return;
  eliminated.add(gamePlayerId);
  outSequence.push(gamePlayerId);
}

function markIn(eliminated: Set<Guid>, outSequence: Guid[], gamePlayerId: Guid): void {
  if (!eliminated.has(gamePlayerId)) return;
  eliminated.delete(gamePlayerId);
  const index = outSequence.indexOf(gamePlayerId);
  if (index >= 0) outSequence.splice(index, 1);
}

function applyGameEventEliminations(
  eliminated: Set<Guid>,
  outSequence: Guid[],
  eventId: Guid,
  throwsByEvent: ReturnType<typeof buildThrowsDetail>,
  errorsByEvent: ReturnType<typeof indexGameEventErrors>,
): void {
  for (const detail of throwsByEvent.get(eventId) ?? []) {
    applyThrowEliminations(eliminated, outSequence, detail.throwRow, detail.deflections);
  }
  const error = errorsByEvent.get(eventId);
  if (
    error &&
    (error.OffenseId === GameEventErrorOffense.LineOut ||
      error.OffenseId === GameEventErrorOffense.BlockIllegal)
  ) {
    markOut(eliminated, outSequence, error.OffenderId);
  }
}

function eliminationOrderFromSequence(
  outSequence: readonly Guid[],
  roster: GamePlayerInfo[],
): Map<Guid, number> {
  const teamHomeById = new Map(
    roster.map((row) => [row.gamePlayerId, row.teamHome] as const),
  );
  const ranks = new Map<Guid, number>();
  let homeRank = 0;
  let awayRank = 0;
  for (const gamePlayerId of outSequence) {
    const teamHome = teamHomeById.get(gamePlayerId);
    if (teamHome === undefined) continue;
    if (teamHome) {
      homeRank += 1;
      ranks.set(gamePlayerId, homeRank);
    } else {
      awayRank += 1;
      ranks.set(gamePlayerId, awayRank);
    }
  }
  return ranks;
}

/** English ordinal for return-queue display (`1` → `1st`). */
export function ordinalLabel(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Player button / roster label while out, e.g. `Alex (out 1st)`. */
export function formatEliminatedPlayerLabel(
  playerName: string,
  eliminationOrder: number | undefined,
): string {
  if (eliminationOrder === undefined) return `${playerName} (out)`;
  return `${playerName} (out ${ordinalLabel(eliminationOrder)})`;
}

/**
 * Default catch recovery: earliest out on the defending team (excluding the
 * target / deflection receivers). `null` means None when nobody qualifies.
 */
export function defaultCatchRecoveredId(
  defendingTeamHome: boolean,
  players: readonly GamePlayerInfo[],
  eliminatedGamePlayerIds: ReadonlySet<Guid>,
  eliminationOrder: ReadonlyMap<Guid, number>,
  excludedGamePlayerIds: ReadonlySet<Guid>,
): Guid | null {
  let bestId: Guid | null = null;
  let bestOrder = Number.POSITIVE_INFINITY;
  for (const player of players) {
    if (player.teamHome !== defendingTeamHome) continue;
    if (!eliminatedGamePlayerIds.has(player.gamePlayerId)) continue;
    if (excludedGamePlayerIds.has(player.gamePlayerId)) continue;
    const order = eliminationOrder.get(player.gamePlayerId);
    if (order === undefined || order >= bestOrder) continue;
    bestOrder = order;
    bestId = player.gamePlayerId;
  }
  return bestId;
}

function countActiveBySide(
  roster: GamePlayerInfo[],
  eliminated: ReadonlySet<Guid>,
): { activeHome: number; activeAway: number } {
  let activeHome = 0;
  let activeAway = 0;
  for (const player of roster) {
    if (eliminated.has(player.gamePlayerId)) continue;
    if (player.teamHome) activeHome += 1;
    else activeAway += 1;
  }
  return { activeHome, activeAway };
}

export type EliminationTimelinePoint = {
  ordinal: number;
  eventId: Guid | null;
  activeHome: number;
  activeAway: number;
  videoOffsetSeconds: number | null;
};

/** Remaining home/away players after each event, starting with the opening roster. */
export function buildEliminationTimeline(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
): EliminationTimelinePoint[] {
  const roster = getGamePlayerInfos(data, matchId, gameId);
  const eliminated = new Set<Guid>();
  const throwsByEvent = buildThrowsDetail(data);
  const errorsByEvent = indexGameEventErrors(data);
  const gameEvents = getGameEvents(data, gameId);
  const opening = countActiveBySide(roster, eliminated);
  const points: EliminationTimelinePoint[] = [
    {
      ordinal: 0,
      eventId: null,
      activeHome: opening.activeHome,
      activeAway: opening.activeAway,
      videoOffsetSeconds: null,
    },
  ];
  const outSequence: Guid[] = [];
  for (const event of gameEvents) {
    applyGameEventEliminations(
      eliminated,
      outSequence,
      event.Id,
      throwsByEvent,
      errorsByEvent,
    );
    const counts = countActiveBySide(roster, eliminated);
    points.push({
      ordinal: event.Ordinal,
      eventId: event.Id,
      activeHome: counts.activeHome,
      activeAway: counts.activeAway,
      videoOffsetSeconds: event.VideoOffsetSeconds ?? null,
    });
  }
  return points;
}

function applyThrowEliminations(
  eliminated: Set<Guid>,
  outSequence: Guid[],
  throwRow: {
    ThrowerId: Guid;
    TargetId: Guid;
    ResultId: number;
    RecoveredId?: Guid | null;
  },
  deflections: { ReceiverId: Guid; ResultId: number }[],
): void {
  const disarmed = new Set<Guid>();

  if (isDisarmThrowResult(throwRow.ResultId)) {
    disarmed.add(throwRow.TargetId);
    markOut(eliminated, outSequence, throwRow.TargetId);
  }
  for (const deflection of deflections) {
    if (isDisarmDeflectionResult(deflection.ResultId)) {
      disarmed.add(deflection.ReceiverId);
      markOut(eliminated, outSequence, deflection.ReceiverId);
    }
  }

  if (throwIsCatch(throwRow.ResultId, deflections)) {
    markOut(eliminated, outSequence, throwRow.ThrowerId);
    if (throwRow.RecoveredId) {
      markIn(eliminated, outSequence, throwRow.RecoveredId);
    }
    for (const gamePlayerId of disarmed) {
      markOut(eliminated, outSequence, gamePlayerId);
    }
    return;
  }

  if (throwTargetEliminated(throwRow.ResultId)) {
    markOut(eliminated, outSequence, throwRow.TargetId);
  }
  for (const deflection of deflections) {
    if (deflection.ResultId === DeflectionResult.Catch) {
      markOut(eliminated, outSequence, throwRow.ThrowerId);
    } else if (deflectionEliminatesReceiver(deflection.ResultId)) {
      markOut(eliminated, outSequence, deflection.ReceiverId);
    }
  }
}

export function computeGameLiveState(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
): GameLiveState {
  const roster = getGamePlayerInfos(data, matchId, gameId);
  const eliminated = new Set<Guid>();
  const outSequence: Guid[] = [];
  const eliminatedAt = new Map<Guid, number | null>();
  const throwsByEvent = buildThrowsDetail(data);
  const errorsByEvent = indexGameEventErrors(data);
  const gameEvents = getGameEvents(data, gameId);

  for (const event of gameEvents) {
    const before = new Set(eliminated);
    applyGameEventEliminations(
      eliminated,
      outSequence,
      event.Id,
      throwsByEvent,
      errorsByEvent,
    );
    for (const gamePlayerId of eliminated) {
      if (!before.has(gamePlayerId)) {
        eliminatedAt.set(gamePlayerId, event.VideoOffsetSeconds ?? null);
      }
    }
    for (const gamePlayerId of before) {
      if (!eliminated.has(gamePlayerId)) eliminatedAt.delete(gamePlayerId);
    }
  }

  const finishExists = (data.Tables.GameEventFinish as { GameEventId: Guid }[]).some(
    (row) => gameEvents.some((event) => event.Id === row.GameEventId),
  );

  let activeHome = 0;
  let activeAway = 0;
  for (const player of roster) {
    if (eliminated.has(player.gamePlayerId)) continue;
    if (player.teamHome) activeHome++;
    else activeAway++;
  }

  const homeRosterSize = roster.filter((row) => row.teamHome).length;
  const awayRosterSize = roster.filter((row) => !row.teamHome).length;

  let isGameOver = false;
  let winningTeamHome: boolean | null = null;
  if (homeRosterSize > 0 && activeHome === 0) {
    isGameOver = true;
    winningTeamHome = false;
  } else if (awayRosterSize > 0 && activeAway === 0) {
    isGameOver = true;
    winningTeamHome = true;
  }

  return {
    eliminatedGamePlayerIds: eliminated,
    eliminatedAtSeconds: eliminatedAt,
    eliminationOrder: eliminationOrderFromSequence(outSequence, roster),
    activeHomeCount: activeHome,
    activeAwayCount: activeAway,
    isGameOver,
    winningTeamHome,
    hasFinishEvent: finishExists,
  };
}

export function isPlayerEliminatedInGame(live: GameLiveState, gamePlayerId: Guid): boolean {
  return live.eliminatedGamePlayerIds.has(gamePlayerId);
}

/** An out player can still throw the ball they released as they were hit. */
export const ELIMINATED_SELECTION_GRACE_SECONDS = 5;

export type StaleEliminatedSelection = {
  gamePlayerId: Guid;
  playerName: string;
  secondsSinceOut: number;
};

/**
 * Out players picked far enough past their elimination that the tracker has
 * probably mis-identified them. Returns nothing when either time is unknown.
 */
export function findStaleEliminatedSelections(
  drafts: ThrowDraft[],
  players: GamePlayerInfo[],
  eliminatedAtSeconds: ReadonlyMap<Guid, number | null>,
  videoOffsetSeconds: number | null,
): StaleEliminatedSelection[] {
  if (videoOffsetSeconds === null) return [];
  const stale = new Map<Guid, StaleEliminatedSelection>();
  const selected = drafts.flatMap((draft) => [
    draft.throwerGamePlayerId,
    draft.targetGamePlayerId,
  ]);
  for (const gamePlayerId of selected) {
    if (!gamePlayerId || stale.has(gamePlayerId)) continue;
    const outAt = eliminatedAtSeconds.get(gamePlayerId);
    if (outAt === undefined || outAt === null) continue;
    const secondsSinceOut = videoOffsetSeconds - outAt;
    if (secondsSinceOut < ELIMINATED_SELECTION_GRACE_SECONDS) continue;
    const player = players.find((row) => row.gamePlayerId === gamePlayerId);
    if (!player) continue;
    stale.set(gamePlayerId, {
      gamePlayerId,
      playerName: player.playerName,
      secondsSinceOut,
    });
  }
  return [...stale.values()];
}

export function gamePlayerIdForPlayerId(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  playerId: Guid,
): Guid | null {
  const info = getGamePlayerInfos(data, matchId, gameId).find(
    (row) => row.playerId === playerId,
  );
  return info?.gamePlayerId ?? null;
}

export type RosterRow = {
  player: { Id: string; Name: string };
  selected: boolean;
  substitute?: boolean;
};

export function sortRosterWithEliminations<T extends RosterRow>(
  rows: T[],
  eliminatedPlayerIds: ReadonlySet<string>,
  eliminationOrder?: ReadonlyMap<string, number>,
): T[] {
  return [...rows].sort((a, b) => {
    const aOut = eliminatedPlayerIds.has(a.player.Id);
    const bOut = eliminatedPlayerIds.has(b.player.Id);
    if (aOut !== bOut) return aOut ? 1 : -1;
    if (aOut && bOut && eliminationOrder) {
      const aOrder = eliminationOrder.get(a.player.Id) ?? Number.POSITIVE_INFINITY;
      const bOrder = eliminationOrder.get(b.player.Id) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }
    const aSub = Boolean(a.substitute);
    const bSub = Boolean(b.substitute);
    if (aSub !== bSub) return aSub ? 1 : -1;
    return a.player.Name.localeCompare(b.player.Name);
  });
}

export function eliminatedPlayerIdsFromLive(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  live: GameLiveState,
): Set<string> {
  const ids = new Set<string>();
  for (const gamePlayerId of live.eliminatedGamePlayerIds) {
    const info = getGamePlayerInfos(data, matchId, gameId).find(
      (row) => row.gamePlayerId === gamePlayerId,
    );
    if (info) ids.add(info.playerId);
  }
  return ids;
}

/** Player-id → return-queue rank for roster screens that key by `Player.Id`. */
export function eliminationOrderByPlayerId(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  live: GameLiveState,
): Map<string, number> {
  const byPlayerId = new Map<string, number>();
  for (const [gamePlayerId, order] of live.eliminationOrder) {
    const info = getGamePlayerInfos(data, matchId, gameId).find(
      (row) => row.gamePlayerId === gamePlayerId,
    );
    if (info) byPlayerId.set(info.playerId, order);
  }
  return byPlayerId;
}

export function sortGamePlayerInfos(
  players: GamePlayerInfo[],
  eliminatedGamePlayerIds: ReadonlySet<Guid>,
  eliminationOrder?: ReadonlyMap<Guid, number>,
): GamePlayerInfo[] {
  return [...players].sort((a, b) => {
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
