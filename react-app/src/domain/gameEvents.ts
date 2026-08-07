import { newIdTimestamp } from './id';
import {
  DeflectionResult,
  GameEventErrorOffense,
  GameEventFinishResult,
  ThrowResult,
} from './statistics/constants';
import type { DatabaseDto, Guid } from './types';
import { getGamePlayers, getMatchById, getMatchPlayers } from './matchGame';
import { getTeam } from './database';
import {
  toneForDeflectionResult,
  toneForThrowResult,
  type TimelineRowTone,
} from './timelineColors';

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
};
export type GameEventType = 'start' | 'throw' | 'error' | 'finish';

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
  offenseId: GameEventErrorOffense | null;
};

export type FinishDraft = {
  resultId: GameEventFinishResult | null;
};

export const throwResultUiOrder: ThrowResult[] = [
  ThrowResult.Hit,
  ThrowResult.Dodge,
  ThrowResult.Block,
  ThrowResult.BlockFailed,
  ThrowResult.Catch,
  ThrowResult.CatchFailed,
  ThrowResult.Miss,
];

export const deflectionResultUiOrder: DeflectionResult[] = [
  DeflectionResult.Hit,
  DeflectionResult.Block,
  DeflectionResult.BlockFailed,
  DeflectionResult.Catch,
  DeflectionResult.CatchFailed,
];

export const throwResultLabels: Record<ThrowResult, string> = {
  [ThrowResult.Hit]: 'Hit',
  [ThrowResult.Block]: 'Block',
  [ThrowResult.BlockFailed]: 'Failed Block',
  [ThrowResult.Catch]: 'Catch',
  [ThrowResult.CatchFailed]: 'Failed Catch',
  [ThrowResult.Dodge]: 'Dodge',
  [ThrowResult.Miss]: 'Miss',
};

export const deflectionResultLabels: Record<DeflectionResult, string> = {
  [DeflectionResult.Hit]: 'Hit',
  [DeflectionResult.Block]: 'Block',
  [DeflectionResult.BlockFailed]: 'Failed Block',
  [DeflectionResult.Catch]: 'Catch',
  [DeflectionResult.CatchFailed]: 'Failed Catch',
};

export const errorOffenseLabels: Record<GameEventErrorOffense, string> = {
  [GameEventErrorOffense.LineOut]: 'Line Out',
  [GameEventErrorOffense.WastedBall]: 'Wasted Ball',
  [GameEventErrorOffense.BlockIllegal]: 'Illegal Block',
};

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
  return { offenderGamePlayerId: '', offenseId: null };
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
  row.VideoOffsetSeconds = videoOffsetSeconds;
  if (getGameEventType(data, gameEventId) === 'start') {
    const game = table<{ Id: Guid; VideoStartSeconds?: number | null }>(data, 'Game').find(
      (entry) => entry.Id === row.GameId,
    );
    if (game) game.VideoStartSeconds = videoOffsetSeconds;
  }
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
    resultId === ThrowResult.BlockFailed ||
    resultId === ThrowResult.CatchFailed
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
  return Boolean(draft.offenderGamePlayerId && draft.offenseId !== null);
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

function allocateOrdinal(
  data: DatabaseDto,
  gameId: Guid,
  insertBeforeEventId: Guid | null | undefined,
): number {
  if (!insertBeforeEventId) {
    const events = getGameEvents(data, gameId);
    return events.length === 0 ? 1 : Math.max(...events.map((row) => row.Ordinal)) + 1;
  }
  const anchor = table<GameEventRow>(data, 'GameEvent').find((row) => row.Id === insertBeforeEventId);
  if (!anchor) throw new Error('Insert anchor not found');
  // Never insert before game start — place immediately after it instead
  if (getGameEventType(data, anchor.Id) === 'start') {
    shiftOrdinalsFrom(data, gameId, anchor.Ordinal + 1, 1);
    return anchor.Ordinal + 1;
  }
  shiftOrdinalsFrom(data, gameId, anchor.Ordinal, 1);
  return anchor.Ordinal;
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

export function loadErrorDraftFromEvent(data: DatabaseDto, gameEventId: Guid): ErrorDraft {
  const row = table<{
    GameEventId: Guid;
    OffenderId: Guid;
    OffenseId: number;
  }>(data, 'GameEventError').find((entry) => entry.GameEventId === gameEventId);
  if (!row) return emptyErrorDraft();
  return {
    offenderGamePlayerId: row.OffenderId,
    offenseId: row.OffenseId as GameEventErrorOffense,
  };
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
  const row = table<GameEventRow>(data, 'GameEvent').find((entry) => entry.Id === gameEventId);
  if (row) row.VideoOffsetSeconds = videoOffsetSeconds;
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
    Ordinal: allocateOrdinal(data, gameId, options?.insertBeforeEventId),
    VideoOffsetSeconds: options?.videoOffsetSeconds ?? null,
  });
  writeThrowsToEvent(data, gameEventId, throws);
  return gameEventId;
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
  if (!infos.some((row) => row.gamePlayerId === draft.offenderGamePlayerId)) {
    throw new Error('Invalid offender');
  }

  if (editing) {
    const rows = table<{ GameEventId: Guid; OffenderId: Guid; OffenseId: number }>(
      data,
      'GameEventError',
    );
    const row = rows.find((entry) => entry.GameEventId === editing);
    if (row) {
      row.OffenderId = draft.offenderGamePlayerId;
      row.OffenseId = draft.offenseId!;
    }
    applyVideoOffsetToEvent(data, editing, options?.videoOffsetSeconds);
    return editing;
  }

  const gameEventId = newIdTimestamp();
  pushRow(data, 'GameEvent', {
    Id: gameEventId,
    GameId: gameId,
    Ordinal: allocateOrdinal(data, gameId, options?.insertBeforeEventId),
    VideoOffsetSeconds: options?.videoOffsetSeconds ?? null,
  });
  pushRow(data, 'GameEventError', {
    GameEventId: gameEventId,
    OffenderId: draft.offenderGamePlayerId,
    OffenseId: draft.offenseId!,
  });
  return gameEventId;
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
    Ordinal: allocateOrdinal(data, gameId, options?.insertBeforeEventId),
    VideoOffsetSeconds: options?.videoOffsetSeconds ?? null,
  });
  pushRow(data, 'GameEventFinish', {
    GameEventId: gameEventId,
    ResultId: draft.resultId!,
  });
  return gameEventId;
}

/** @deprecated use persistThrowGameEvent */
export function saveThrowGameEvent(
  data: DatabaseDto,
  gameId: Guid,
  matchId: Guid,
  throws: Array<Omit<ThrowDraft, 'resultId' | 'recoveredId'> & { resultId: ThrowResult }>,
): Guid {
  return persistThrowGameEvent(
    data,
    gameId,
    matchId,
    throws.map((row) => ({ ...row, resultId: row.resultId, recoveredId: undefined })),
  );
}

/** @deprecated use persistFinishGameEvent */
export function saveFinishGameEvent(
  data: DatabaseDto,
  gameId: Guid,
  resultId: GameEventFinishResult,
): Guid {
  return persistFinishGameEvent(data, gameId, { resultId });
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

export function getInsertBelowTargetEventId(
  eventsNewestFirst: GameEventRow[],
  selectedEventId: Guid,
): Guid | null {
  const index = eventsNewestFirst.findIndex((row) => row.Id === selectedEventId);
  if (index < 0) return null;
  return eventsNewestFirst[index + 1]?.Id ?? null;
}

export type TimelinePlayerRef = {
  gamePlayerId: Guid;
  playerId: Guid;
  playerName: string;
  teamHome: boolean;
};

export type TimelineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'player'; player: TimelinePlayerRef };

export type TimelineAction =
  | { kind: 'throw'; resultId: ThrowResult }
  | { kind: 'deflection'; resultId: DeflectionResult }
  | { kind: 'error' }
  | { kind: 'finish' }
  | { kind: 'start' };

export type TimelineRow = {
  segments: TimelineSegment[];
  tone: TimelineRowTone;
  role: 'throw' | 'deflection' | 'error' | 'finish' | 'start';
  /** Action badge(s) shown on the left of the row. */
  actions: TimelineAction[];
};

export type TimelineEntry = {
  id: Guid;
  type: GameEventType;
  rows: TimelineRow[];
  videoOffsetSeconds?: number | null;
};

function playerRef(players: GamePlayerInfo[], id: Guid): TimelinePlayerRef {
  const info = players.find((row) => row.gamePlayerId === id);
  return {
    gamePlayerId: id,
    playerId: info?.playerId ?? id,
    playerName: info?.playerName ?? '?',
    teamHome: info?.teamHome ?? true,
  };
}

function articleForResult(label: string): string {
  return /^[aeiou]/i.test(label) ? 'an' : 'a';
}

export function buildThrowTimelineRows(draft: ThrowDraft, players: GamePlayerInfo[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const thrower = playerRef(players, draft.throwerGamePlayerId);
  const target = playerRef(players, draft.targetGamePlayerId);
  const resultLabel = draft.resultId ? throwResultLabels[draft.resultId] : '?';
  const tone = draft.resultId ? toneForThrowResult(draft.resultId) : 'neutral';

  const throwSegments: TimelineSegment[] = [
    { kind: 'player', player: thrower },
    { kind: 'text', text: ' threw at ' },
    { kind: 'player', player: target },
    {
      kind: 'text',
      text: `, resulting in ${articleForResult(resultLabel)} ${resultLabel}`,
    },
  ];

  if (draft.recoveredId !== undefined) {
    throwSegments.push({ kind: 'text', text: ' · recovered ' });
    if (draft.recoveredId) {
      throwSegments.push({ kind: 'player', player: playerRef(players, draft.recoveredId) });
    } else {
      throwSegments.push({ kind: 'text', text: 'None' });
    }
  }

  rows.push({
    segments: throwSegments,
    tone,
    role: 'throw',
    actions: draft.resultId !== null ? [{ kind: 'throw', resultId: draft.resultId }] : [],
  });

  for (const deflection of draft.deflections) {
    const receiver = playerRef(players, deflection.receiverGamePlayerId);
    const defLabel = deflectionResultLabels[deflection.resultId];
    rows.push({
      role: 'deflection',
      tone: toneForDeflectionResult(deflection.resultId),
      actions: [{ kind: 'deflection', resultId: deflection.resultId }],
      segments: [
        { kind: 'player', player: receiver },
        {
          kind: 'text',
          text: ` deflected, resulting in ${articleForResult(defLabel)} ${defLabel}`,
        },
      ],
    });
  }

  return rows;
}

export function buildTimelineEntries(
  data: DatabaseDto,
  gameId: Guid,
  matchId: Guid,
): TimelineEntry[] {
  const players = getGamePlayerInfos(data, matchId, gameId);
  const match = getMatchById(data, matchId);
  const homeName = match ? getTeam(data, match.TeamIdHome)?.Name ?? 'Home' : 'Home';
  const awayName = match ? getTeam(data, match.TeamIdAway)?.Name ?? 'Away' : 'Away';

  return getGameEventsNewestFirst(data, gameId).map((event) => {
    const type = getGameEventType(data, event.Id)!;
    if (type === 'start') {
      return {
        id: event.Id,
        type,
        videoOffsetSeconds: event.VideoOffsetSeconds ?? null,
        rows: [
          {
            role: 'start',
            tone: 'neutral',
            actions: [{ kind: 'start' }],
            segments: [{ kind: 'text', text: 'Game start' }],
          },
        ],
      };
    }
    if (type === 'throw') {
      const drafts = loadThrowDraftsFromEvent(data, event.Id);
      return {
        id: event.Id,
        type,
        videoOffsetSeconds: event.VideoOffsetSeconds ?? null,
        rows: drafts.flatMap((draft) => buildThrowTimelineRows(draft, players)),
      };
    }
    if (type === 'error') {
      const draft = loadErrorDraftFromEvent(data, event.Id);
      const offenseLabel = draft.offenseId ? errorOffenseLabels[draft.offenseId] : 'Error';
      return {
        id: event.Id,
        type,
        videoOffsetSeconds: event.VideoOffsetSeconds ?? null,
        rows: [
          {
            role: 'error',
            tone: 'error',
            actions: [{ kind: 'error' }],
            segments: [
              { kind: 'player', player: playerRef(players, draft.offenderGamePlayerId) },
              { kind: 'text', text: ` — ${offenseLabel}` },
            ],
          },
        ],
      };
    }
    const draft = loadFinishDraftFromEvent(data, event.Id);
    let finishText = 'Finish';
    if (draft.resultId === GameEventFinishResult.Tie) finishText = 'Tie';
    else if (draft.resultId === GameEventFinishResult.WinHome) finishText = `${homeName} win`;
    else if (draft.resultId === GameEventFinishResult.WinAway) finishText = `${awayName} win`;
    return {
      id: event.Id,
      type,
      videoOffsetSeconds: event.VideoOffsetSeconds ?? null,
      rows: [
        {
          role: 'finish',
          tone: 'finish',
          actions: [{ kind: 'finish' }],
          segments: [{ kind: 'text', text: finishText }],
        },
      ],
    };
  });
}

export function draftsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
