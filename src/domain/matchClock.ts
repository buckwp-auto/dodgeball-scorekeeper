import { getGameEventType, getGameEvents, getGameStartEvent } from './gameEvents';
import { getMatchGames } from './matchGame';
import type { DatabaseDto, Guid } from './types';
import { formatVideoTime } from './youtube';

export const MATCH_CLOCK_NO_VIDEO = 'No video';
export const MATCH_CLOCK_NO_START = 'Stamp Game start';
export const MATCH_CLOCK_NO_TIME = '—';

export type MatchRunningTime =
  | { status: 'ready'; elapsedSeconds: number; paused: boolean }
  | { status: 'no-video' }
  | { status: 'no-start-stamp' }
  | { status: 'no-current-time' }
  | { status: 'before-start' };

/** Closed or open VOD pause from Timeout / Timeout ends. `endSeconds` null = still open. */
export type TimeoutPauseInterval = {
  startSeconds: number;
  endSeconds: number | null;
};

/** VOD offset the match clock counts from: first stamped Game start in the match. */
export function matchClockStartOffsetSeconds(
  data: DatabaseDto,
  matchId: Guid,
): number | null {
  for (const game of getMatchGames(data, matchId)) {
    const offset = getGameStartEvent(data, game.gameId)?.VideoOffsetSeconds;
    if (offset != null && Number.isFinite(offset)) return offset;
  }
  return null;
}

/** VOD offset the game clock counts from: this game's Game start stamp. */
export function gameClockStartOffsetSeconds(data: DatabaseDto, gameId: Guid): number | null {
  const offset = getGameStartEvent(data, gameId)?.VideoOffsetSeconds;
  if (offset != null && Number.isFinite(offset)) return offset;
  return null;
}

/**
 * Pair stamped Timeout / Timeout ends into pause intervals.
 * Unpaired ends are ignored; an unmatched start stays open (`endSeconds: null`).
 */
export function collectTimeoutPauseIntervals(
  data: DatabaseDto,
  scope: { matchId: Guid } | { gameId: Guid },
): TimeoutPauseInterval[] {
  const gameIds =
    'gameId' in scope
      ? [scope.gameId]
      : getMatchGames(data, scope.matchId).map((game) => game.gameId);

  const intervals: TimeoutPauseInterval[] = [];
  for (const gameId of gameIds) {
    let openStart: number | null = null;
    for (const event of getGameEvents(data, gameId)) {
      const type = getGameEventType(data, event.Id);
      const offset = event.VideoOffsetSeconds;
      if (offset == null || !Number.isFinite(offset)) continue;
      if (type === 'timeout') {
        if (openStart != null) {
          intervals.push({ startSeconds: openStart, endSeconds: offset });
        }
        openStart = offset;
      } else if (type === 'timeoutEnd') {
        if (openStart == null) continue;
        intervals.push({ startSeconds: openStart, endSeconds: offset });
        openStart = null;
      }
    }
    if (openStart != null) {
      intervals.push({ startSeconds: openStart, endSeconds: null });
    }
  }
  return intervals;
}

/** Seconds of pause overlapping (startOffset, videoNow]. */
export function pauseSecondsOverlapping(
  startOffsetSeconds: number,
  videoNowSeconds: number,
  intervals: TimeoutPauseInterval[],
): number {
  let paused = 0;
  for (const interval of intervals) {
    const end = interval.endSeconds ?? videoNowSeconds;
    const overlapStart = Math.max(interval.startSeconds, startOffsetSeconds);
    const overlapEnd = Math.min(end, videoNowSeconds);
    if (overlapEnd > overlapStart) paused += overlapEnd - overlapStart;
  }
  return paused;
}

function isTimeoutOpenAt(
  intervals: TimeoutPauseInterval[],
  videoNowSeconds: number,
): boolean {
  return intervals.some(
    (interval) =>
      interval.endSeconds == null &&
      interval.startSeconds <= videoNowSeconds,
  );
}

/** Elapsed match time from the VOD clock minus Game start and timeout pauses. */
export function resolveMatchRunningTime(args: {
  hasVideo: boolean;
  startOffsetSeconds: number | null;
  videoNowSeconds: number | null;
  pauseIntervals?: TimeoutPauseInterval[];
}): MatchRunningTime {
  if (!args.hasVideo) return { status: 'no-video' };
  if (args.startOffsetSeconds == null || !Number.isFinite(args.startOffsetSeconds)) {
    return { status: 'no-start-stamp' };
  }
  if (args.videoNowSeconds == null || !Number.isFinite(args.videoNowSeconds)) {
    return { status: 'no-current-time' };
  }
  const elapsed = args.videoNowSeconds - args.startOffsetSeconds;
  if (elapsed < 0) return { status: 'before-start' };
  const intervals = args.pauseIntervals ?? [];
  const pausedSeconds = pauseSecondsOverlapping(
    args.startOffsetSeconds,
    args.videoNowSeconds,
    intervals,
  );
  return {
    status: 'ready',
    elapsedSeconds: Math.max(0, elapsed - pausedSeconds),
    paused: isTimeoutOpenAt(intervals, args.videoNowSeconds),
  };
}

export function formatMatchRunningTime(time: MatchRunningTime): string {
  switch (time.status) {
    case 'ready':
      return formatVideoTime(time.elapsedSeconds);
    case 'no-video':
      return MATCH_CLOCK_NO_VIDEO;
    case 'no-start-stamp':
      return MATCH_CLOCK_NO_START;
    case 'no-current-time':
    case 'before-start':
      return MATCH_CLOCK_NO_TIME;
  }
}

export function isMatchRunningTimeEmpty(time: MatchRunningTime): boolean {
  return time.status !== 'ready';
}
