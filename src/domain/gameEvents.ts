import { newIdTimestamp } from './id';
import {
  DeflectionResult,
  GameEventErrorOffense,
  GameEventFinishResult,
  ThrowResult,
} from './statistics/constants';
import { deletePlayer, getPlayer, playerIsUsedInMatches } from './database';
import type { DatabaseDto, Guid } from './types';
import {
  getAdjacentGameId,
  getGamePlayers,
  getMatchGames,
  getMatchIdForGame,
  getMatchPlayers,
  isPlayerInGame,
  isPlayerInMatch,
  toggleGamePlayer,
  toggleMatchPlayer,
} from './matchGame';

function table<T>(data: DatabaseDto, name: string): T[] {
  return data.Tables[name] as T[];
}

function pushRow<T>(data: DatabaseDto, tableName: string, row: T): T {
  table<T>(data, tableName).push(row);
  return row;
}

export type GameEventRow = {
  Id: Guid;
  GameId: Guid;
  Ordinal: number;
  /** Seconds into the match YouTube video when this event was recorded. */
  VideoOffsetSeconds?: number | null;
  /** Starred for the league highlight reel. */
  IsHighlight?: boolean;
};
export type GameEventType = 'start' | 'throw' | 'error' | 'noBlocking' | 'finish';

export type GamePlayerInfo = {
  gamePlayerId: Guid;
  playerId: Guid;
  playerName: string;
  teamHome: boolean;
};

export type DeflectionDraft = {
  receiverGamePlayerId: Guid;
  resultId: DeflectionResult;
};

export type ThrowDraft = {
  throwerGamePlayerId: Guid;
  targetGamePlayerId: Guid;
  resultId: ThrowResult | null;
  deflections: DeflectionDraft[];
  /** `undefined` = user has not chosen recovered yet */
  recoveredId: Guid | null | undefined;
};

export type ErrorDraft = {
  offenderGamePlayerId: Guid;
  /**
   * Thrower who released the ball (illegal block only). Optional so old
   * `.scrkpr` rows without `ThrowerId` still load; required to complete a new
   * illegal-block draft.
   */
  throwerGamePlayerId?: Guid;
  offenseId: GameEventErrorOffense | null;
  /** Player-less game marker on the Other tab. */
  noBlockingStarted?: boolean;
};

export type FinishDraft = {
  resultId: GameEventFinishResult | null;
};

export const throwResultUiOrder: ThrowResult[] = [
  ThrowResult.Hit,
  ThrowResult.Dodge,
  ThrowResult.Block,
  ThrowResult.Disarm,
  ThrowResult.Catch,
  ThrowResult.Miss,
];

export const deflectionResultUiOrder: DeflectionResult[] = [
  DeflectionResult.Hit,
  DeflectionResult.Block,
  DeflectionResult.Disarm,
  DeflectionResult.Catch,
];

export const throwResultLabels: Record<ThrowResult, string> = {
  [ThrowResult.Hit]: 'Hit',
  [ThrowResult.Block]: 'Block',
  [ThrowResult.BlockFailed]: 'Failed Block',
  [ThrowResult.Catch]: 'Catch',
  [ThrowResult.CatchFailed]: 'Failed Catch',
  [ThrowResult.Dodge]: 'Dodge',
  [ThrowResult.Miss]: 'Miss',
  [ThrowResult.Disarm]: 'Disarm',
};

export const deflectionResultLabels: Record<DeflectionResult, string> = {
  [DeflectionResult.Hit]: 'Hit',
  [DeflectionResult.Block]: 'Block',
  [DeflectionResult.BlockFailed]: 'Failed Block',
  [DeflectionResult.Catch]: 'Catch',
  [DeflectionResult.CatchFailed]: 'Failed Catch',
  [DeflectionResult.Disarm]: 'Disarm',
};

export const errorOffenseLabels: Record<GameEventErrorOffense, string> = {
  [GameEventErrorOffense.LineOut]: 'Line Out',
  [GameEventErrorOffense.WastedBall]: 'Wasted Ball',
  [GameEventErrorOffense.BlockIllegal]: 'Illegal Block (No Blocking)',
};

export const NO_BLOCKING_STARTED_LABEL = 'No Blocking Started';

export const finishResultLabels: Record<GameEventFinishResult, string> = {
  [GameEventFinishResult.WinHome]: 'Home win',
  [GameEventFinishResult.WinAway]: 'Away win',
  [GameEventFinishResult.Tie]: 'Tie',
};

export function emptyThrowDraft(): ThrowDraft {
  return {
    throwerGamePlayerId: '',
    targetGamePlayerId: '',
    resultId: null,
    deflections: [],
    recoveredId: undefined,
  };
}

export function emptyErrorDraft(): ErrorDraft {
  return {
    offenderGamePlayerId: '',
    throwerGamePlayerId: '',
    offenseId: null,
    noBlockingStarted: false,
  };
}

/** Illegal block is an Other-tab error that also names the thrower. */
export function errorDraftNeedsThrower(draft: ErrorDraft): boolean {
  return !draft.noBlockingStarted && draft.offenseId === GameEventErrorOffense.BlockIllegal;
}

/**
 * Throwing side for an illegal-block draft, or null until thrower/offender
 * pins a team (same idea as thrower-then-target on the Throw tab).
 */
export function resolveErrorThrowingHome(
  draft: ErrorDraft,
  players: GamePlayerInfo[],
): boolean | null {
  if (!errorDraftNeedsThrower(draft)) return null;
  if (draft.throwerGamePlayerId) {
    return (
      players.find((row) => row.gamePlayerId === draft.throwerGamePlayerId)?.teamHome ??
      null
    );
  }
  if (draft.offenderGamePlayerId) {
    const offenderHome = players.find(
      (row) => row.gamePlayerId === draft.offenderGamePlayerId,
    )?.teamHome;
    return offenderHome === undefined ? null : !offenderHome;
  }
  return null;
}

export function emptyFinishDraft(): FinishDraft {
  return { resultId: null };
}

export function getGameEvents(data: DatabaseDto, gameId: Guid): GameEventRow[] {
  return table<GameEventRow>(data, 'GameEvent')
    .filter((row) => row.GameId === gameId)
    .sort((a, b) => a.Ordinal - b.Ordinal);
}

export function getGameEventsNewestFirst(data: DatabaseDto, gameId: Guid): GameEventRow[] {
  return [...getGameEvents(data, gameId)].sort((a, b) => b.Ordinal - a.Ordinal);
}

export function gameHasFinishEvent(data: DatabaseDto, gameId: Guid): boolean {
  const finishes = table<{ GameEventId: Guid }>(data, 'GameEventFinish');
  const eventIds = new Set(getGameEvents(data, gameId).map((row) => row.Id));
  return finishes.some((row) => eventIds.has(row.GameEventId));
}

export function getGameEventType(data: DatabaseDto, gameEventId: Guid): GameEventType | null {
  if (table(data, 'GameEventStart').some((row) => (row as { GameEventId: Guid }).GameEventId === gameEventId)) {
    return 'start';
  }
  if (table(data, 'GameEventThrow').some((row) => (row as { GameEventId: Guid }).GameEventId === gameEventId)) {
    return 'throw';
  }
  if (table(data, 'GameEventError').some((row) => (row as { GameEventId: Guid }).GameEventId === gameEventId)) {
    return 'error';
  }
  if (
    table(data, 'GameEventNoBlocking').some(
      (row) => (row as { GameEventId: Guid }).GameEventId === gameEventId,
    )
  ) {
    return 'noBlocking';
  }
  if (table(data, 'GameEventFinish').some((row) => (row as { GameEventId: Guid }).GameEventId === gameEventId)) {
    return 'finish';
  }
  return null;
}

export function getGameStartEvent(data: DatabaseDto, gameId: Guid): GameEventRow | null {
  return (
    getGameEvents(data, gameId).find((event) => getGameEventType(data, event.Id) === 'start') ??
    null
  );
}

/**
 * Preferred seek when entering Track Game, or null when nothing is stamped yet.
 * Null means keep the current player position (e.g. a pop-out left at the prior
 * game's end until Game start is marked).
 * Finished games prefer game start; unfinished prefer the last stamped event.
 */
export function trackGameOpenSeekSeconds(
  data: DatabaseDto,
  gameId: Guid,
): number | null {
  const start = getGameStartEvent(data, gameId);
  const startSeconds = start?.VideoOffsetSeconds ?? null;

  if (gameHasFinishEvent(data, gameId)) {
    return startSeconds;
  }

  const events = getGameEvents(data, gameId);
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (getGameEventType(data, event.Id) === 'start') continue;
    if (event.VideoOffsetSeconds != null) return event.VideoOffsetSeconds;
  }

  return startSeconds;
}

/**
 * Latest stamped offset in a game: finish when complete, otherwise the last
 * non-start event (or game start if that is all that exists).
 */
export function lastStampedVideoOffsetInGame(
  data: DatabaseDto,
  gameId: Guid,
): number | null {
  if (gameHasFinishEvent(data, gameId)) {
    const events = getGameEvents(data, gameId);
    for (let index = events.length - 1; index >= 0; index--) {
      const event = events[index];
      if (getGameEventType(data, event.Id) === 'finish') {
        return event.VideoOffsetSeconds ?? null;
      }
    }
  }

  const events = getGameEvents(data, gameId);
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (getGameEventType(data, event.Id) === 'start') continue;
    if (event.VideoOffsetSeconds != null) return event.VideoOffsetSeconds;
  }

  return getGameStartEvent(data, gameId)?.VideoOffsetSeconds ?? null;
}

/**
 * In-page Track Game cue: current game rules, then prior game in the match when
 * nothing is stamped yet (continue after the previous game's end).
 */
export function inPageOpenSeekSeconds(
  data: DatabaseDto,
  gameId: Guid,
): number | null {
  const direct = trackGameOpenSeekSeconds(data, gameId);
  if (direct != null) return direct;

  const matchId = getMatchIdForGame(data, gameId);
  if (!matchId) return null;
  const previousGameId = getAdjacentGameId(data, matchId, gameId, -1);
  if (!previousGameId) return null;
  return lastStampedVideoOffsetInGame(data, previousGameId);
}

/**
 * Where the in-page YouTube player should cue when entering Track Game.
 * Same rules as {@link inPageOpenSeekSeconds}, falling back to 0 when unstamped.
 */
export function initialVideoSeekSeconds(data: DatabaseDto, gameId: Guid): number {
  return inPageOpenSeekSeconds(data, gameId) ?? 0;
}

/**
 * Ensure every game has a Game Start event at ordinal 1.
 * Safe to call repeatedly (idempotent).
 */
export function ensureGameStartEvent(data: DatabaseDto, gameId: Guid): Guid {
  const existing = getGameStartEvent(data, gameId);
  if (existing) return existing.Id;

  shiftOrdinalsFrom(data, gameId, 1, 1);
  const gameEventId = newIdTimestamp();
  pushRow(data, 'GameEvent', {
    Id: gameEventId,
    GameId: gameId,
    Ordinal: 1,
    VideoOffsetSeconds: null,
  });
  pushRow(data, 'GameEventStart', { GameEventId: gameEventId });
  return gameEventId;
}

/** Set or clear an event's video timestamp. Syncs Game.VideoStartSeconds for start events. */
export function setGameEventVideoOffset(
  data: DatabaseDto,
  gameEventId: Guid,
  videoOffsetSeconds: number | null,
): void {
  const row = table<GameEventRow>(data, 'GameEvent').find((entry) => entry.Id === gameEventId);
  if (!row) return;
  const previous = row.VideoOffsetSeconds ?? null;
  row.VideoOffsetSeconds = videoOffsetSeconds;
  if (getGameEventType(data, gameEventId) === 'start') {
    const game = table<{ Id: Guid; VideoStartSeconds?: number | null }>(data, 'Game').find(
      (entry) => entry.Id === row.GameId,
    );
    if (game) game.VideoStartSeconds = videoOffsetSeconds;
    return;
  }
  if (previous === videoOffsetSeconds) return;
  reslotGameEventByVideoTime(data, gameEventId);
}

/** Star or unstar a timeline event for the league highlight reel. */
export function setGameEventHighlight(
  data: DatabaseDto,
  gameEventId: Guid,
  isHighlight: boolean,
): void {
  const row = table<GameEventRow>(data, 'GameEvent').find((entry) => entry.Id === gameEventId);
  if (!row) return;
  row.IsHighlight = isHighlight;
}

export function getGamePlayerInfos(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
): GamePlayerInfo[] {
  const matchPlayers = new Map(
    getMatchPlayers(data, matchId).map((row) => [row.Id, row]),
  );
  const players = new Map(
    table<{ Id: Guid; Name: string }>(data, 'Player').map((row) => [row.Id, row]),
  );
  const infos: GamePlayerInfo[] = [];
  for (const gamePlayer of getGamePlayers(data, gameId)) {
    const matchPlayer = matchPlayers.get(gamePlayer.MatchPlayerId);
    if (!matchPlayer) continue;
    const player = players.get(matchPlayer.PlayerId);
    if (!player) continue;
    infos.push({
      gamePlayerId: gamePlayer.Id,
      playerId: player.Id,
      playerName: player.Name,
      teamHome: matchPlayer.TeamHome,
    });
  }
  return infos.sort(
    (a, b) =>
      Number(b.teamHome) - Number(a.teamHome) ||
      a.playerName.localeCompare(b.playerName),
  );
}

export function throwResultAllowsDeflections(resultId: ThrowResult | null): boolean {
  if (resultId === null) return false;
  return (
    resultId === ThrowResult.Hit ||
    resultId === ThrowResult.Block ||
    resultId === ThrowResult.Disarm
  );
}

export function throwDraftNeedsRecovered(draft: ThrowDraft): boolean {
  if (draft.resultId === ThrowResult.Catch) return true;
  return draft.deflections.some((row) => row.resultId === DeflectionResult.Catch);
}

export function isThrowDraftComplete(draft: ThrowDraft): boolean {
  if (!draft.throwerGamePlayerId || !draft.targetGamePlayerId || draft.resultId === null) {
    return false;
  }
  for (const deflection of draft.deflections) {
    if (!deflection.receiverGamePlayerId) return false;
  }
  if (throwDraftNeedsRecovered(draft) && draft.recoveredId === undefined) {
    return false;
  }
  return true;
}

export function areThrowDraftsComplete(drafts: ThrowDraft[]): boolean {
  return drafts.length > 0 && drafts.every(isThrowDraftComplete);
}

export function isErrorDraftComplete(draft: ErrorDraft): boolean {
  if (draft.noBlockingStarted) return true;
  if (!draft.offenderGamePlayerId || draft.offenseId === null) return false;
  if (errorDraftNeedsThrower(draft) && !draft.throwerGamePlayerId) return false;
  return true;
}

export function isFinishDraftComplete(draft: FinishDraft): boolean {
  return draft.resultId !== null;
}

function shiftOrdinalsFrom(data: DatabaseDto, gameId: Guid, fromOrdinal: number, delta: number): void {
  for (const row of table<GameEventRow>(data, 'GameEvent')) {
    if (row.GameId === gameId && row.Ordinal >= fromOrdinal) {
      row.Ordinal += delta;
    }
  }
}

function findInsertBeforeEventIdForVideoTime(
  data: DatabaseDto,
  gameId: Guid,
  videoOffsetSeconds: number,
  excludeEventId?: Guid,
): Guid | null {
  for (const event of getGameEvents(data, gameId)) {
    if (event.Id === excludeEventId) continue;
    if (getGameEventType(data, event.Id) === 'start') continue;
    const offset = event.VideoOffsetSeconds;
    if (offset == null || !Number.isFinite(offset)) continue;
    if (offset > videoOffsetSeconds) return event.Id;
  }
  return null;
}

function allocateOrdinal(
  data: DatabaseDto,
  gameId: Guid,
  insertBeforeEventId: Guid | null | undefined,
  videoOffsetSeconds?: number | null,
  excludeEventId?: Guid,
): number {
  let anchorId = insertBeforeEventId ?? null;
  if (
    !anchorId &&
    videoOffsetSeconds != null &&
    Number.isFinite(videoOffsetSeconds)
  ) {
    anchorId = findInsertBeforeEventIdForVideoTime(
      data,
      gameId,
      videoOffsetSeconds,
      excludeEventId,
    );
  }
  const events = getGameEvents(data, gameId).filter((row) => row.Id !== excludeEventId);
  if (!anchorId) {
    return events.length === 0 ? 1 : Math.max(...events.map((row) => row.Ordinal)) + 1;
  }
  const anchor = table<GameEventRow>(data, 'GameEvent').find((row) => row.Id === anchorId);
  if (!anchor) throw new Error('Insert anchor not found');
  const ordinal = anchor.Ordinal;
  // Never insert before game start — place immediately after it instead
  if (getGameEventType(data, anchor.Id) === 'start') {
    shiftOrdinalsFrom(data, gameId, ordinal + 1, 1);
    return ordinal + 1;
  }
  shiftOrdinalsFrom(data, gameId, ordinal, 1);
  return ordinal;
}

/**
 * Re-place a non-start event using the same slot-by-video-time rules as create.
 * Unstamped events append; Game start stays at ordinal 1.
 */
function reslotGameEventByVideoTime(data: DatabaseDto, gameEventId: Guid): void {
  const row = table<GameEventRow>(data, 'GameEvent').find((entry) => entry.Id === gameEventId);
  if (!row) return;
  if (getGameEventType(data, gameEventId) === 'start') return;

  const oldOrdinal = row.Ordinal;
  row.Ordinal = Number.MAX_SAFE_INTEGER;
  for (const event of table<GameEventRow>(data, 'GameEvent')) {
    if (event.GameId === row.GameId && event.Id !== gameEventId && event.Ordinal > oldOrdinal) {
      event.Ordinal -= 1;
    }
  }
  row.Ordinal = allocateOrdinal(
    data,
    row.GameId,
    null,
    row.VideoOffsetSeconds,
    gameEventId,
  );
}

function removeThrowChildren(data: DatabaseDto, gameEventId: Guid): void {
  const throwRows = table<{ Id: Guid; GameEventThrowId: Guid }>(data, 'Throw').filter(
    (row) => row.GameEventThrowId === gameEventId,
  );
  const throwIds = new Set(throwRows.map((row) => row.Id));
  data.Tables.Deflection = table(data, 'Deflection').filter(
    (row) => !throwIds.has((row as { ThrowId: Guid }).ThrowId),
  );
  data.Tables.Throw = table(data, 'Throw').filter(
    (row) => (row as { GameEventThrowId: Guid }).GameEventThrowId !== gameEventId,
  );
}

function writeThrowsToEvent(
  data: DatabaseDto,
  gameEventId: Guid,
  throws: ThrowDraft[],
): void {
  removeThrowChildren(data, gameEventId);
  if (!table(data, 'GameEventThrow').some((row) => (row as { GameEventId: Guid }).GameEventId === gameEventId)) {
    pushRow(data, 'GameEventThrow', { GameEventId: gameEventId });
  }
  throws.forEach((throwDraft, throwIndex) => {
    const throwId = newIdTimestamp();
    pushRow(data, 'Throw', {
      Id: throwId,
      GameEventThrowId: gameEventId,
      Ordinal: throwIndex + 1,
      ThrowerId: throwDraft.throwerGamePlayerId,
      TargetId: throwDraft.targetGamePlayerId,
      RecoveredId: throwDraft.recoveredId ?? null,
      ResultId: throwDraft.resultId!,
    });
    throwDraft.deflections.forEach((deflection, deflectionIndex) => {
      pushRow(data, 'Deflection', {
        Id: newIdTimestamp(),
        ThrowId: throwId,
        Ordinal: deflectionIndex + 1,
        ReceiverId: deflection.receiverGamePlayerId,
        ResultId: deflection.resultId,
      });
    });
  });
}

function validateThrows(data: DatabaseDto, matchId: Guid, gameId: Guid, throws: ThrowDraft[]): void {
  if (!areThrowDraftsComplete(throws)) throw new Error('Incomplete throw event');
  const infos = getGamePlayerInfos(data, matchId, gameId);
  const throwerIds = throws.map((row) => row.throwerGamePlayerId);
  const sides = new Set(
    throwerIds.map((id) => infos.find((row) => row.gamePlayerId === id)?.teamHome),
  );
  if (sides.size > 1) throw new Error('Group throwers must be on the same team');
  for (const throwDraft of throws) {
    const thrower = infos.find((row) => row.gamePlayerId === throwDraft.throwerGamePlayerId);
    const target = infos.find((row) => row.gamePlayerId === throwDraft.targetGamePlayerId);
    if (!thrower || !target || thrower.teamHome === target.teamHome) {
      throw new Error('Invalid thrower/target');
    }
  }
}

export function loadThrowDraftsFromEvent(data: DatabaseDto, gameEventId: Guid): ThrowDraft[] {
  const throws = table<{
    Id: Guid;
    GameEventThrowId: Guid;
    ThrowerId: Guid;
    TargetId: Guid;
    ResultId: number;
    RecoveredId?: Guid | null;
    Ordinal: number;
  }>(data, 'Throw')
    .filter((row) => row.GameEventThrowId === gameEventId)
    .sort((a, b) => a.Ordinal - b.Ordinal);

  return throws.map((throwRow) => {
    const deflections = table<{
      ThrowId: Guid;
      ReceiverId: Guid;
      ResultId: number;
      Ordinal: number;
    }>(data, 'Deflection')
      .filter((row) => row.ThrowId === throwRow.Id)
      .sort((a, b) => a.Ordinal - b.Ordinal)
      .map((row) => ({
        receiverGamePlayerId: row.ReceiverId,
        resultId: row.ResultId as DeflectionResult,
      }));
    const recoveredId =
      throwRow.RecoveredId === undefined ? undefined : throwRow.RecoveredId;
    return {
      throwerGamePlayerId: throwRow.ThrowerId,
      targetGamePlayerId: throwRow.TargetId,
      resultId: throwRow.ResultId as ThrowResult,
      deflections,
      recoveredId: throwDraftNeedsRecovered({
        throwerGamePlayerId: throwRow.ThrowerId,
        targetGamePlayerId: throwRow.TargetId,
        resultId: throwRow.ResultId as ThrowResult,
        deflections,
        recoveredId: undefined,
      })
        ? recoveredId ?? null
        : undefined,
    };
  });
}

type GameEventErrorPersistRow = {
  GameEventId: Guid;
  OffenderId: Guid;
  OffenseId: number;
  ThrowerId?: Guid | null;
};

export function loadErrorDraftFromEvent(data: DatabaseDto, gameEventId: Guid): ErrorDraft {
  const row = table<GameEventErrorPersistRow>(data, 'GameEventError').find(
    (entry) => entry.GameEventId === gameEventId,
  );
  if (!row) return emptyErrorDraft();
  return {
    offenderGamePlayerId: row.OffenderId,
    throwerGamePlayerId: row.ThrowerId ?? '',
    offenseId: row.OffenseId as GameEventErrorOffense,
    noBlockingStarted: false,
  };
}

export function loadOtherDraftFromEvent(data: DatabaseDto, gameEventId: Guid): ErrorDraft {
  if (getGameEventType(data, gameEventId) === 'noBlocking') {
    return {
      offenderGamePlayerId: '',
      throwerGamePlayerId: '',
      offenseId: null,
      noBlockingStarted: true,
    };
  }
  return loadErrorDraftFromEvent(data, gameEventId);
}

export function loadFinishDraftFromEvent(data: DatabaseDto, gameEventId: Guid): FinishDraft {
  const row = table<{ GameEventId: Guid; ResultId: number }>(data, 'GameEventFinish').find(
    (entry) => entry.GameEventId === gameEventId,
  );
  if (!row) return emptyFinishDraft();
  return { resultId: row.ResultId as GameEventFinishResult };
}

export type PersistGameEventOptions = {
  gameEventId?: Guid;
  insertBeforeEventId?: Guid | null;
  /** Current YouTube player time; null clears / leaves unset when unavailable. */
  videoOffsetSeconds?: number | null;
};

function applyVideoOffsetToEvent(
  data: DatabaseDto,
  gameEventId: Guid,
  videoOffsetSeconds: number | null | undefined,
): void {
  if (videoOffsetSeconds === undefined) return;
  setGameEventVideoOffset(data, gameEventId, videoOffsetSeconds);
}

export function persistThrowGameEvent(
  data: DatabaseDto,
  gameId: Guid,
  matchId: Guid,
  throws: ThrowDraft[],
  options?: PersistGameEventOptions,
): Guid {
  const editing = options?.gameEventId;
  if (!editing && gameHasFinishEvent(data, gameId)) {
    throw new Error('Cannot add events after the game is finished');
  }
  validateThrows(data, matchId, gameId, throws);

  if (editing) {
    writeThrowsToEvent(data, editing, throws);
    applyVideoOffsetToEvent(data, editing, options?.videoOffsetSeconds);
    return editing;
  }

  const gameEventId = newIdTimestamp();
  pushRow(data, 'GameEvent', {
    Id: gameEventId,
    GameId: gameId,
    Ordinal: allocateOrdinal(
      data,
      gameId,
      options?.insertBeforeEventId,
      options?.videoOffsetSeconds,
    ),
    VideoOffsetSeconds: options?.videoOffsetSeconds ?? null,
  });
  writeThrowsToEvent(data, gameEventId, throws);
  return gameEventId;
}

function throwerIdForErrorDraft(draft: ErrorDraft): Guid | null {
  if (!errorDraftNeedsThrower(draft) || !draft.throwerGamePlayerId) return null;
  return draft.throwerGamePlayerId;
}

function applyErrorDraftToRow(row: GameEventErrorPersistRow, draft: ErrorDraft): void {
  row.OffenderId = draft.offenderGamePlayerId;
  row.OffenseId = draft.offenseId!;
  row.ThrowerId = throwerIdForErrorDraft(draft);
}

function validateErrorDraftPlayers(
  infos: GamePlayerInfo[],
  draft: ErrorDraft,
): void {
  const offender = infos.find((row) => row.gamePlayerId === draft.offenderGamePlayerId);
  if (!offender) throw new Error('Invalid offender');
  if (!errorDraftNeedsThrower(draft)) return;
  const thrower = infos.find((row) => row.gamePlayerId === draft.throwerGamePlayerId);
  if (!thrower || thrower.teamHome === offender.teamHome) {
    throw new Error('Invalid thrower');
  }
}

export function persistErrorGameEvent(
  data: DatabaseDto,
  gameId: Guid,
  matchId: Guid,
  draft: ErrorDraft,
  options?: PersistGameEventOptions,
): Guid {
  if (!isErrorDraftComplete(draft)) throw new Error('Incomplete error event');
  const editing = options?.gameEventId;
  if (!editing && gameHasFinishEvent(data, gameId)) {
    throw new Error('Cannot add events after the game is finished');
  }
  const infos = getGamePlayerInfos(data, matchId, gameId);
  validateErrorDraftPlayers(infos, draft);

  if (editing) {
    const rows = table<GameEventErrorPersistRow>(data, 'GameEventError');
    const row = rows.find((entry) => entry.GameEventId === editing);
    if (row) applyErrorDraftToRow(row, draft);
    applyVideoOffsetToEvent(data, editing, options?.videoOffsetSeconds);
    return editing;
  }

  const gameEventId = newIdTimestamp();
  pushRow(data, 'GameEvent', {
    Id: gameEventId,
    GameId: gameId,
    Ordinal: allocateOrdinal(
      data,
      gameId,
      options?.insertBeforeEventId,
      options?.videoOffsetSeconds,
    ),
    VideoOffsetSeconds: options?.videoOffsetSeconds ?? null,
  });
  pushRow(data, 'GameEventError', {
    GameEventId: gameEventId,
    OffenderId: draft.offenderGamePlayerId,
    OffenseId: draft.offenseId!,
    ThrowerId: throwerIdForErrorDraft(draft),
  });
  return gameEventId;
}

function removeNoBlockingRow(data: DatabaseDto, gameEventId: Guid): void {
  data.Tables.GameEventNoBlocking = table(data, 'GameEventNoBlocking').filter(
    (row) => (row as { GameEventId: Guid }).GameEventId !== gameEventId,
  );
}

function removeErrorRow(data: DatabaseDto, gameEventId: Guid): void {
  data.Tables.GameEventError = table(data, 'GameEventError').filter(
    (row) => (row as { GameEventId: Guid }).GameEventId !== gameEventId,
  );
}

export function persistNoBlockingGameEvent(
  data: DatabaseDto,
  gameId: Guid,
  options?: PersistGameEventOptions,
): Guid {
  const editing = options?.gameEventId;
  if (!editing && gameHasFinishEvent(data, gameId)) {
    throw new Error('Cannot add events after the game is finished');
  }

  if (editing) {
    const type = getGameEventType(data, editing);
    if (type === 'noBlocking') {
      applyVideoOffsetToEvent(data, editing, options?.videoOffsetSeconds);
      return editing;
    }
    if (type === 'error') {
      removeErrorRow(data, editing);
      pushRow(data, 'GameEventNoBlocking', { GameEventId: editing });
      applyVideoOffsetToEvent(data, editing, options?.videoOffsetSeconds);
      return editing;
    }
    throw new Error('Cannot convert this event to no blocking started');
  }

  const gameEventId = newIdTimestamp();
  pushRow(data, 'GameEvent', {
    Id: gameEventId,
    GameId: gameId,
    Ordinal: allocateOrdinal(
      data,
      gameId,
      options?.insertBeforeEventId,
      options?.videoOffsetSeconds,
    ),
    VideoOffsetSeconds: options?.videoOffsetSeconds ?? null,
  });
  pushRow(data, 'GameEventNoBlocking', { GameEventId: gameEventId });
  return gameEventId;
}

/** Persist an Other-tab draft (player offense or no blocking started). */
export function persistOtherGameEvent(
  data: DatabaseDto,
  gameId: Guid,
  matchId: Guid,
  draft: ErrorDraft,
  options?: PersistGameEventOptions,
): Guid {
  if (!isErrorDraftComplete(draft)) throw new Error('Incomplete other event');
  if (draft.noBlockingStarted) {
    return persistNoBlockingGameEvent(data, gameId, options);
  }

  const editing = options?.gameEventId;
  if (editing && getGameEventType(data, editing) === 'noBlocking') {
    removeNoBlockingRow(data, editing);
  }
  return persistErrorGameEvent(data, gameId, matchId, draft, options);
}

export function persistFinishGameEvent(
  data: DatabaseDto,
  gameId: Guid,
  draft: FinishDraft,
  options?: PersistGameEventOptions,
): Guid {
  if (!isFinishDraftComplete(draft)) throw new Error('Incomplete finish event');
  const editing = options?.gameEventId;
  if (!editing && gameHasFinishEvent(data, gameId)) {
    throw new Error('Finish event already exists');
  }

  if (editing) {
    const row = table<{ GameEventId: Guid; ResultId: number }>(data, 'GameEventFinish').find(
      (entry) => entry.GameEventId === editing,
    );
    if (row) row.ResultId = draft.resultId!;
    applyVideoOffsetToEvent(data, editing, options?.videoOffsetSeconds);
    return editing;
  }

  const gameEventId = newIdTimestamp();
  pushRow(data, 'GameEvent', {
    Id: gameEventId,
    GameId: gameId,
    Ordinal: allocateOrdinal(
      data,
      gameId,
      options?.insertBeforeEventId,
      options?.videoOffsetSeconds,
    ),
    VideoOffsetSeconds: options?.videoOffsetSeconds ?? null,
  });
  pushRow(data, 'GameEventFinish', {
    GameEventId: gameEventId,
    ResultId: draft.resultId!,
  });
  return gameEventId;
}

export function gameEventIncludesGamePlayer(
  data: DatabaseDto,
  gameEventId: Guid,
  gamePlayerId: Guid,
): boolean {
  const error = table<GameEventErrorPersistRow>(data, 'GameEventError').find(
    (row) => row.GameEventId === gameEventId,
  );
  if (error?.OffenderId === gamePlayerId || error?.ThrowerId === gamePlayerId) return true;

  const throwRows = table<{
    Id: Guid;
    GameEventThrowId: Guid;
    ThrowerId: Guid;
    TargetId: Guid;
    RecoveredId?: Guid | null;
  }>(data, 'Throw').filter((row) => row.GameEventThrowId === gameEventId);

  for (const throwRow of throwRows) {
    if (
      throwRow.ThrowerId === gamePlayerId ||
      throwRow.TargetId === gamePlayerId ||
      throwRow.RecoveredId === gamePlayerId
    ) {
      return true;
    }
    const hit = table<{ ThrowId: Guid; ReceiverId: Guid }>(data, 'Deflection').some(
      (row) => row.ThrowId === throwRow.Id && row.ReceiverId === gamePlayerId,
    );
    if (hit) return true;
  }
  return false;
}

export function findFirstGameEventIncludingPlayer(
  data: DatabaseDto,
  gameId: Guid,
  gamePlayerId: Guid,
): GameEventRow | null {
  for (const event of getGameEvents(data, gameId)) {
    if (getGameEventType(data, event.Id) === 'start') continue;
    if (gameEventIncludesGamePlayer(data, event.Id, gamePlayerId)) return event;
  }
  return null;
}

export function previewGamePlayerEventRollback(
  data: DatabaseDto,
  gameId: Guid,
  gamePlayerId: Guid,
): { firstOrdinal: number; eventCount: number } | null {
  const first = findFirstGameEventIncludingPlayer(data, gameId, gamePlayerId);
  if (!first) return null;
  const eventCount = getGameEvents(data, gameId).filter(
    (event) =>
      event.Ordinal >= first.Ordinal && getGameEventType(data, event.Id) !== 'start',
  ).length;
  if (eventCount === 0) return null;
  return { firstOrdinal: first.Ordinal, eventCount };
}

export function previewRemoveGamePlayer(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  playerId: Guid,
): { gamePlayerId: Guid; eventCount: number } | null {
  const info = getGamePlayerInfos(data, matchId, gameId).find(
    (row) => row.playerId === playerId,
  );
  if (!info) return null;
  const preview = previewGamePlayerEventRollback(data, gameId, info.gamePlayerId);
  if (!preview) return null;
  return { gamePlayerId: info.gamePlayerId, eventCount: preview.eventCount };
}

/** Delete every non-start event from the player's first involvement onward. */
export function rollbackGameEventsFromPlayer(
  data: DatabaseDto,
  gameId: Guid,
  gamePlayerId: Guid,
): number {
  const first = findFirstGameEventIncludingPlayer(data, gameId, gamePlayerId);
  if (!first) return 0;
  const toDelete = getGameEvents(data, gameId)
    .filter(
      (event) =>
        event.Ordinal >= first.Ordinal && getGameEventType(data, event.Id) !== 'start',
    )
    .sort((a, b) => b.Ordinal - a.Ordinal);
  for (const event of toDelete) {
    deleteGameEvent(data, event.Id);
  }
  return toDelete.length;
}

export function removeGamePlayerFromRoster(
  data: DatabaseDto,
  matchId: Guid,
  gameId: Guid,
  playerId: Guid,
  options?: { rollbackEvents?: boolean },
): { removed: boolean; rolledBackEvents: number } {
  const info = getGamePlayerInfos(data, matchId, gameId).find(
    (row) => row.playerId === playerId,
  );
  if (!info) return { removed: false, rolledBackEvents: 0 };

  const preview = previewGamePlayerEventRollback(data, gameId, info.gamePlayerId);
  if (preview && !options?.rollbackEvents) {
    throw new Error('Player appears in recorded events');
  }

  const rolledBackEvents = preview
    ? rollbackGameEventsFromPlayer(data, gameId, info.gamePlayerId)
    : 0;
  toggleGamePlayer(data, matchId, gameId, playerId);
  return { removed: true, rolledBackEvents };
}

export type RemoveMatchSidePlayerPreview = {
  onThisMatch: boolean;
  eventCount: number;
  gameCountWithEvents: number;
  willDeletePlayer: boolean;
  canRemove: boolean;
};

export function previewRemovePlayerFromMatch(
  data: DatabaseDto,
  matchId: Guid,
  playerId: Guid,
): RemoveMatchSidePlayerPreview {
  const onThisMatch = isPlayerInMatch(data, matchId, playerId);
  const matchCount = getMatchPlayersAcrossMatches(data, playerId);
  let eventCount = 0;
  let gameCountWithEvents = 0;
  if (onThisMatch) {
    for (const { gameId } of getMatchGames(data, matchId)) {
      const preview = previewRemoveGamePlayer(data, matchId, gameId, playerId);
      if (preview && preview.eventCount > 0) {
        eventCount += preview.eventCount;
        gameCountWithEvents += 1;
      }
    }
  }
  const willDeletePlayer = matchCount <= (onThisMatch ? 1 : 0);
  const addedFromMatch = Boolean(getPlayer(data, playerId)?.AddedFromMatch);
  return {
    onThisMatch,
    eventCount,
    gameCountWithEvents,
    willDeletePlayer,
    canRemove: addedFromMatch && (onThisMatch || willDeletePlayer),
  };
}

export function removeMatchSidePlayerConfirmMessage(
  name: string,
  preview: RemoveMatchSidePlayerPreview,
): string | null {
  if (!preview.canRemove) return null;
  if (preview.eventCount > 0) {
    const eventLabel = preview.eventCount === 1 ? 'event' : 'events';
    const gameLabel = preview.gameCountWithEvents === 1 ? 'game' : 'games';
    const tail = preview.willDeletePlayer
      ? ', remove them from this match, and delete them from the team. Continue?'
      : ', and remove them from this match. Continue?';
    return `${name} appears in recorded events. Removing them will delete ${preview.eventCount} ${eventLabel} across ${preview.gameCountWithEvents} ${gameLabel}${tail}`;
  }
  if (!preview.onThisMatch) return `Delete ${name} from the team?`;
  if (preview.willDeletePlayer) {
    return `Remove ${name} from this match and delete them from the team?`;
  }
  return `Remove ${name} from this match? They will stay on the team.`;
}

export function removePlayerFromMatchSide(
  data: DatabaseDto,
  matchId: Guid,
  playerId: Guid,
  options?: { rollbackEvents?: boolean },
): { removedFromMatch: boolean; deletedPlayer: boolean; rolledBackEvents: number } {
  if (!getPlayer(data, playerId)?.AddedFromMatch) {
    throw new Error('Cannot delete a core roster player from the match screen');
  }
  const onThisMatch = isPlayerInMatch(data, matchId, playerId);
  let rolledBackEvents = 0;

  if (onThisMatch) {
    for (const { gameId } of getMatchGames(data, matchId)) {
      if (!isPlayerInGame(data, gameId, playerId, matchId)) continue;
      const preview = previewRemoveGamePlayer(data, matchId, gameId, playerId);
      if (preview && preview.eventCount > 0) {
        if (!options?.rollbackEvents) {
          throw new Error('Player appears in recorded events');
        }
        rolledBackEvents += removeGamePlayerFromRoster(data, matchId, gameId, playerId, {
          rollbackEvents: true,
        }).rolledBackEvents;
      } else {
        toggleGamePlayer(data, matchId, gameId, playerId);
      }
    }
    toggleMatchPlayer(data, matchId, playerId, true);
  }

  let deletedPlayer = false;
  if (!playerIsUsedInMatches(data, playerId)) {
    deletePlayer(data, playerId);
    deletedPlayer = true;
  }

  return { removedFromMatch: onThisMatch, deletedPlayer, rolledBackEvents };
}

function getMatchPlayersAcrossMatches(data: DatabaseDto, playerId: Guid): number {
  const matchIds = new Set(
    table<{ PlayerId: Guid; MatchId: Guid }>(data, 'MatchPlayer')
      .filter((row) => row.PlayerId === playerId)
      .map((row) => row.MatchId),
  );
  return matchIds.size;
}

export function deleteGameEvent(data: DatabaseDto, gameEventId: Guid): void {
  if (getGameEventType(data, gameEventId) === 'start') {
    throw new Error('Cannot delete the game start event');
  }
  const gameEvent = table<GameEventRow>(data, 'GameEvent').find(
    (row) => row.Id === gameEventId,
  );
  if (!gameEvent) return;

  removeThrowChildren(data, gameEventId);
  data.Tables.GameEventThrow = table(data, 'GameEventThrow').filter(
    (row) => (row as { GameEventId: Guid }).GameEventId !== gameEventId,
  );
  data.Tables.GameEventError = table(data, 'GameEventError').filter(
    (row) => (row as { GameEventId: Guid }).GameEventId !== gameEventId,
  );
  data.Tables.GameEventNoBlocking = table(data, 'GameEventNoBlocking').filter(
    (row) => (row as { GameEventId: Guid }).GameEventId !== gameEventId,
  );
  data.Tables.GameEventFinish = table(data, 'GameEventFinish').filter(
    (row) => (row as { GameEventId: Guid }).GameEventId !== gameEventId,
  );
  data.Tables.GameEventStart = table(data, 'GameEventStart').filter(
    (row) => (row as { GameEventId: Guid }).GameEventId !== gameEventId,
  );
  data.Tables.GameEvent = table<GameEventRow>(data, 'GameEvent').filter(
    (row) => row.Id !== gameEventId,
  );

  for (const row of table<GameEventRow>(data, 'GameEvent')) {
    if (row.GameId === gameEvent.GameId && row.Ordinal > gameEvent.Ordinal) {
      row.Ordinal -= 1;
    }
  }
}

export type ThrowSnapshot = {
  Id: Guid;
  Ordinal: number;
  ThrowerId: Guid;
  TargetId: Guid;
  RecoveredId: Guid | null;
  ResultId: number;
  deflections: Array<{
    Id: Guid;
    Ordinal: number;
    ReceiverId: Guid;
    ResultId: number;
  }>;
};

export type GameEventSnapshot = {
  event: GameEventRow;
  type: Exclude<GameEventType, 'start'>;
  error?: { OffenderId: Guid; OffenseId: number; ThrowerId?: Guid | null };
  noBlocking?: true;
  finish?: { ResultId: number };
  throws?: ThrowSnapshot[];
};

export function getLastUndoableGameEvent(
  data: DatabaseDto,
  gameId: Guid,
): GameEventRow | null {
  const events = getGameEventsNewestFirst(data, gameId);
  return (
    events.find((event) => {
      const type = getGameEventType(data, event.Id);
      return type !== null && type !== 'start';
    }) ?? null
  );
}

export function snapshotGameEvent(
  data: DatabaseDto,
  gameEventId: Guid,
): GameEventSnapshot | null {
  const event = table<GameEventRow>(data, 'GameEvent').find(
    (row) => row.Id === gameEventId,
  );
  if (!event) return null;
  const type = getGameEventType(data, gameEventId);
  if (!type || type === 'start') return null;

  const base: GameEventSnapshot = {
    event: { ...event },
    type,
  };

  if (type === 'error') {
    const row = table<GameEventErrorPersistRow>(data, 'GameEventError').find(
      (entry) => entry.GameEventId === gameEventId,
    );
    if (!row) return null;
    return {
      ...base,
      error: {
        OffenderId: row.OffenderId,
        OffenseId: row.OffenseId,
        ThrowerId: row.ThrowerId ?? null,
      },
    };
  }

  if (type === 'noBlocking') {
    return { ...base, noBlocking: true };
  }

  if (type === 'finish') {
    const row = table<{ GameEventId: Guid; ResultId: number }>(
      data,
      'GameEventFinish',
    ).find((entry) => entry.GameEventId === gameEventId);
    if (!row) return null;
    return { ...base, finish: { ResultId: row.ResultId } };
  }

  const throwRows = table<{
    Id: Guid;
    GameEventThrowId: Guid;
    ThrowerId: Guid;
    TargetId: Guid;
    ResultId: number;
    RecoveredId?: Guid | null;
    Ordinal: number;
  }>(data, 'Throw')
    .filter((row) => row.GameEventThrowId === gameEventId)
    .sort((a, b) => a.Ordinal - b.Ordinal);

  const throws: ThrowSnapshot[] = throwRows.map((throwRow) => ({
    Id: throwRow.Id,
    Ordinal: throwRow.Ordinal,
    ThrowerId: throwRow.ThrowerId,
    TargetId: throwRow.TargetId,
    RecoveredId: throwRow.RecoveredId ?? null,
    ResultId: throwRow.ResultId,
    deflections: table<{
      Id: Guid;
      ThrowId: Guid;
      ReceiverId: Guid;
      ResultId: number;
      Ordinal: number;
    }>(data, 'Deflection')
      .filter((row) => row.ThrowId === throwRow.Id)
      .sort((a, b) => a.Ordinal - b.Ordinal)
      .map((row) => ({
        Id: row.Id,
        Ordinal: row.Ordinal,
        ReceiverId: row.ReceiverId,
        ResultId: row.ResultId,
      })),
  }));

  return { ...base, throws };
}

/** Undo the latest non-start event; returns the snapshot for the redo stack. */
export function undoLastGameEvent(
  data: DatabaseDto,
  gameId: Guid,
): GameEventSnapshot | null {
  const last = getLastUndoableGameEvent(data, gameId);
  if (!last) return null;
  const snapshot = snapshotGameEvent(data, last.Id);
  if (!snapshot) return null;
  deleteGameEvent(data, last.Id);
  return snapshot;
}

export function restoreGameEventSnapshot(
  data: DatabaseDto,
  snapshot: GameEventSnapshot,
): Guid {
  const { event, type } = snapshot;
  if (table<GameEventRow>(data, 'GameEvent').some((row) => row.Id === event.Id)) {
    throw new Error('Event already exists');
  }

  shiftOrdinalsFrom(data, event.GameId, event.Ordinal, 1);
  pushRow(data, 'GameEvent', {
    Id: event.Id,
    GameId: event.GameId,
    Ordinal: event.Ordinal,
    VideoOffsetSeconds: event.VideoOffsetSeconds ?? null,
    IsHighlight: event.IsHighlight ?? false,
  });

  if (type === 'error') {
    if (!snapshot.error) throw new Error('Missing error snapshot');
    pushRow(data, 'GameEventError', {
      GameEventId: event.Id,
      OffenderId: snapshot.error.OffenderId,
      OffenseId: snapshot.error.OffenseId,
      ThrowerId: snapshot.error.ThrowerId ?? null,
    });
    return event.Id;
  }

  if (type === 'noBlocking') {
    pushRow(data, 'GameEventNoBlocking', { GameEventId: event.Id });
    return event.Id;
  }

  if (type === 'finish') {
    if (!snapshot.finish) throw new Error('Missing finish snapshot');
    pushRow(data, 'GameEventFinish', {
      GameEventId: event.Id,
      ResultId: snapshot.finish.ResultId,
    });
    return event.Id;
  }

  pushRow(data, 'GameEventThrow', { GameEventId: event.Id });
  for (const throwSnap of snapshot.throws ?? []) {
    pushRow(data, 'Throw', {
      Id: throwSnap.Id,
      GameEventThrowId: event.Id,
      Ordinal: throwSnap.Ordinal,
      ThrowerId: throwSnap.ThrowerId,
      TargetId: throwSnap.TargetId,
      RecoveredId: throwSnap.RecoveredId,
      ResultId: throwSnap.ResultId,
    });
    for (const deflection of throwSnap.deflections) {
      pushRow(data, 'Deflection', {
        Id: deflection.Id,
        ThrowId: throwSnap.Id,
        Ordinal: deflection.Ordinal,
        ReceiverId: deflection.ReceiverId,
        ResultId: deflection.ResultId,
      });
    }
  }
  return event.Id;
}

export function getInsertBelowTargetEventId(
  eventsNewestFirst: GameEventRow[],
  selectedEventId: Guid,
): Guid | null {
  const index = eventsNewestFirst.findIndex((row) => row.Id === selectedEventId);
  if (index < 0) return null;
  return eventsNewestFirst[index + 1]?.Id ?? null;
}

export function draftsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
