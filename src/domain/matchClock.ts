import { getGameStartEvent } from './gameEvents';
import { getMatchGames } from './matchGame';
import type { DatabaseDto, Guid } from './types';
import { formatVideoTime } from './youtube';

export const MATCH_CLOCK_NO_VIDEO = 'No video';
export const MATCH_CLOCK_NO_START = 'Stamp Game start';
export const MATCH_CLOCK_NO_TIME = '—';

export type MatchRunningTime =
  | { status: 'ready'; elapsedSeconds: number }
  | { status: 'no-video' }
  | { status: 'no-start-stamp' }
  | { status: 'no-current-time' }
  | { status: 'before-start' };

/**
 * VOD offset the match clock counts from: this game's Game start stamp when
 * present, otherwise the first stamped Game start in the match.
 */
export function matchClockStartOffsetSeconds(
  data: DatabaseDto,
  matchId: Guid,
  gameId?: Guid,
): number | null {
  if (gameId) {
    const current = getGameStartEvent(data, gameId)?.VideoOffsetSeconds;
    if (current != null && Number.isFinite(current)) return current;
  }
  for (const game of getMatchGames(data, matchId)) {
    const offset = getGameStartEvent(data, game.gameId)?.VideoOffsetSeconds;
    if (offset != null && Number.isFinite(offset)) return offset;
  }
  return null;
}

/** Elapsed match time from the VOD clock minus Game start. Never uses wall time. */
export function resolveMatchRunningTime(args: {
  hasVideo: boolean;
  startOffsetSeconds: number | null;
  videoNowSeconds: number | null;
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
  return { status: 'ready', elapsedSeconds: elapsed };
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
