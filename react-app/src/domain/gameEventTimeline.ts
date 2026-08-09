import {
  DeflectionResult,
  GameEventFinishResult,
  ThrowResult,
} from './statistics/constants';
import type { DatabaseDto, Guid } from './types';
import { getTeam } from './database';
import { getMatchById } from './matchGame';
import {
  deflectionResultLabels,
  errorOffenseLabels,
  getGameEventsNewestFirst,
  getGameEventType,
  getGamePlayerInfos,
  loadErrorDraftFromEvent,
  loadFinishDraftFromEvent,
  loadThrowDraftsFromEvent,
  throwResultLabels,
  type GameEventRow,
  type GameEventType,
  type GamePlayerInfo,
  type ThrowDraft,
} from './gameEvents';
import {
  toneForDeflectionResult,
  toneForThrowResult,
  type TimelineRowTone,
} from './timelineColors';
import { formatVideoTime } from './youtube';

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
  actions: TimelineAction[];
};

export type TimelineEntry = {
  id: Guid;
  type: GameEventType;
  rows: TimelineRow[];
  videoOffsetSeconds?: number | null;
  isHighlight: boolean;
};

function playerRef(
  players: GamePlayerInfo[],
  id: Guid,
): TimelinePlayerRef {
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

export function buildThrowTimelineRows(
  draft: ThrowDraft,
  players: GamePlayerInfo[],
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const resultLabel = draft.resultId
    ? throwResultLabels[draft.resultId]
    : '?';
  const throwSegments: TimelineSegment[] = [
    { kind: 'player', player: playerRef(players, draft.throwerGamePlayerId) },
    { kind: 'text', text: ' threw at ' },
    { kind: 'player', player: playerRef(players, draft.targetGamePlayerId) },
    {
      kind: 'text',
      text: `, resulting in ${articleForResult(resultLabel)} ${resultLabel}`,
    },
  ];

  if (draft.recoveredId !== undefined) {
    throwSegments.push({ kind: 'text', text: ' · recovered ' });
    throwSegments.push(
      draft.recoveredId
        ? { kind: 'player', player: playerRef(players, draft.recoveredId) }
        : { kind: 'text', text: 'None' },
    );
  }

  rows.push({
    segments: throwSegments,
    tone: draft.resultId ? toneForThrowResult(draft.resultId) : 'neutral',
    role: 'throw',
    actions:
      draft.resultId !== null
        ? [{ kind: 'throw', resultId: draft.resultId }]
        : [],
  });

  for (const deflection of draft.deflections) {
    const label = deflectionResultLabels[deflection.resultId];
    rows.push({
      role: 'deflection',
      tone: toneForDeflectionResult(deflection.resultId),
      actions: [{ kind: 'deflection', resultId: deflection.resultId }],
      segments: [
        {
          kind: 'player',
          player: playerRef(players, deflection.receiverGamePlayerId),
        },
        {
          kind: 'text',
          text: ` deflected, resulting in ${articleForResult(label)} ${label}`,
        },
      ],
    });
  }

  return rows;
}

export function buildTimelineEntry(
  data: DatabaseDto,
  event: GameEventRow,
  players: GamePlayerInfo[],
  homeName: string,
  awayName: string,
): TimelineEntry | null {
  const type = getGameEventType(data, event.Id);
  if (!type) return null;

  const base = {
    id: event.Id,
    type,
    videoOffsetSeconds: event.VideoOffsetSeconds ?? null,
    isHighlight: Boolean(event.IsHighlight),
  };

  if (type === 'start') {
    return {
      ...base,
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
    return {
      ...base,
      rows: loadThrowDraftsFromEvent(data, event.Id).flatMap((draft) =>
        buildThrowTimelineRows(draft, players),
      ),
    };
  }
  if (type === 'error') {
    const draft = loadErrorDraftFromEvent(data, event.Id);
    const offenseLabel = draft.offenseId
      ? errorOffenseLabels[draft.offenseId]
      : 'Error';
    return {
      ...base,
      rows: [
        {
          role: 'error',
          tone: 'error',
          actions: [{ kind: 'error' }],
          segments: [
            {
              kind: 'player',
              player: playerRef(players, draft.offenderGamePlayerId),
            },
            { kind: 'text', text: ` — ${offenseLabel}` },
          ],
        },
      ],
    };
  }

  const draft = loadFinishDraftFromEvent(data, event.Id);
  let finishText = 'Finish';
  if (draft.resultId === GameEventFinishResult.Tie) finishText = 'Tie';
  else if (draft.resultId === GameEventFinishResult.WinHome) {
    finishText = `${homeName} win`;
  } else if (draft.resultId === GameEventFinishResult.WinAway) {
    finishText = `${awayName} win`;
  }
  return {
    ...base,
    rows: [
      {
        role: 'finish',
        tone: 'finish',
        actions: [{ kind: 'finish' }],
        segments: [{ kind: 'text', text: finishText }],
      },
    ],
  };
}

/** Time chip for a timeline row; throw rows in a team throw share the event stamp. */
export function timelineRowVideoTimeLabel(
  entry: TimelineEntry,
  rowIndex: number,
): string | undefined {
  const row = entry.rows[rowIndex];
  if (!row || row.role === 'deflection') return undefined;
  return formatVideoTime(entry.videoOffsetSeconds ?? null) || undefined;
}

export function buildTimelineEntries(
  data: DatabaseDto,
  gameId: Guid,
  matchId: Guid,
): TimelineEntry[] {
  const players = getGamePlayerInfos(data, matchId, gameId);
  const match = getMatchById(data, matchId);
  const homeName = match
    ? getTeam(data, match.TeamIdHome)?.Name ?? 'Home'
    : 'Home';
  const awayName = match
    ? getTeam(data, match.TeamIdAway)?.Name ?? 'Away'
    : 'Away';

  return getGameEventsNewestFirst(data, gameId).flatMap((event) => {
    const entry = buildTimelineEntry(data, event, players, homeName, awayName);
    return entry ? [entry] : [];
  });
}
