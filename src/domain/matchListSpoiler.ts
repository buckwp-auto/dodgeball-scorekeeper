import {
  getGameStartEvent,
  lastStampedVideoOffsetInGame,
} from './gameEvents';
import { getMatchGames } from './matchGame';
import {
  buildMatchSeries,
  formatMatchSeriesScore,
} from './statistics/teamStandings';
import type { DatabaseDto, Guid } from './types';
import { formatVideoTime } from './youtube';

/** Session set of match ids whose list scores are currently revealed. */
export const MATCH_SCORE_REVEALED_KEY = 'SCOREKEEPER_MATCH_SCORE_REVEALED';

export type MatchListProgress = 'notStarted' | 'inProgress' | 'finished';

export type MatchListSpoiler = {
  matchId: Guid;
  progress: MatchListProgress;
  progressLabel: string;
  scoreText: string;
  /** First unfinished game in match order, if the series is still open. */
  activeGameLabel: string | null;
  /**
   * Clock for the active game: elapsed from Game start when both start and the
   * latest event are stamped; otherwise the latest VideoOffsetSeconds as VOD
   * time. Null when nothing is stamped (no invented wall-clock minutes).
   */
  gameClockText: string | null;
};

const PROGRESS_LABEL: Record<MatchListProgress, string> = {
  notStarted: 'Not started',
  inProgress: 'In progress',
  finished: 'Finished',
};

export function buildMatchListSpoiler(
  data: DatabaseDto,
  matchId: Guid,
): MatchListSpoiler | null {
  const series = buildMatchSeries(data, matchId);
  if (!series) return null;

  const games = getMatchGames(data, matchId);
  const active = games.find((game) => !game.scoringComplete) ?? null;
  const progress: MatchListProgress =
    games.length === 0 ? 'notStarted' : active ? 'inProgress' : 'finished';

  return {
    matchId,
    progress,
    progressLabel: PROGRESS_LABEL[progress],
    scoreText: formatMatchSeriesScore(series),
    activeGameLabel: active?.label ?? null,
    gameClockText:
      active != null ? formatInProgressGameClock(data, active.gameId) : null,
  };
}

/** Elapsed from Game start when both are stamped; else latest stamped VOD time. */
export function formatInProgressGameClock(
  data: DatabaseDto,
  gameId: Guid,
): string | null {
  const last = lastStampedVideoOffsetInGame(data, gameId);
  if (last == null || !Number.isFinite(last)) return null;
  const start = getGameStartEvent(data, gameId)?.VideoOffsetSeconds;
  if (start != null && Number.isFinite(start)) {
    return formatVideoTime(Math.max(0, last - start));
  }
  return formatVideoTime(last);
}

export function loadRevealedMatchScoreIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(MATCH_SCORE_REVEALED_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is string => typeof id === 'string' && id.length > 0),
    );
  } catch {
    return new Set();
  }
}

export function saveRevealedMatchScoreIds(ids: Set<string>): void {
  try {
    sessionStorage.setItem(MATCH_SCORE_REVEALED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}
