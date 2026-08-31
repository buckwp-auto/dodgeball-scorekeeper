import { getMatchName } from './database';
import { isStatsImportedMatchId } from './importedMatch';
import {
  canNavigateToGameEvents,
  getMatchById,
  getMatchGames,
} from './matchGame';
import type { DatabaseDto } from './types';

export const LAST_SCORING_KEY = 'SCOREKEEPER_LAST_SCORING';
export const LAST_SCORING_EVENT = 'scorekeeper-last-scoring';

export type LastScoringStored =
  | { target: 'game'; matchId: string; gameId: string }
  | { target: 'match'; matchId: string };

export type LastScoringLink = {
  href: string;
  /** Short control label, e.g. "Resume Game 2" or "Resume match". */
  title: string;
  /** Match name, for secondary text. */
  matchName: string;
  target: 'game' | 'match';
};

export function loadLastScoring(): LastScoringStored | null {
  try {
    const raw = localStorage.getItem(LAST_SCORING_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const row = parsed as Partial<LastScoringStored>;
    if (row.target === 'game' && row.matchId && row.gameId) {
      return { target: 'game', matchId: row.matchId, gameId: row.gameId };
    }
    if (row.target === 'match' && row.matchId) {
      return { target: 'match', matchId: row.matchId };
    }
  } catch {
    /* ignore quota / private mode / bad JSON */
  }
  return null;
}

export function saveLastScoring(value: LastScoringStored): void {
  try {
    localStorage.setItem(LAST_SCORING_KEY, JSON.stringify(value));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(LAST_SCORING_EVENT));
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function rememberLastGame(matchId: string, gameId: string): void {
  if (!matchId || !gameId) return;
  saveLastScoring({ target: 'game', matchId, gameId });
}

export function rememberLastMatch(matchId: string): void {
  if (!matchId) return;
  saveLastScoring({ target: 'match', matchId });
}

export function resolveLastScoring(
  data: DatabaseDto,
  stored: LastScoringStored | null,
): LastScoringLink | null {
  if (!stored) return null;
  const match = getMatchById(data, stored.matchId);
  if (!match) return null;
  if (isStatsImportedMatchId(data, stored.matchId)) return null;
  const matchName = getMatchName(data, match);

  if (stored.target === 'match') {
    return {
      href: `/matches/${stored.matchId}/events`,
      title: 'Resume match',
      matchName,
      target: 'match',
    };
  }

  const game = getMatchGames(data, stored.matchId).find(
    (row) => row.gameId === stored.gameId,
  );
  if (!game) {
    return {
      href: `/matches/${stored.matchId}/events`,
      title: 'Resume match',
      matchName,
      target: 'match',
    };
  }

  const href = canNavigateToGameEvents(data, stored.matchId, stored.gameId)
    ? `/matches/${stored.matchId}/games/${stored.gameId}/events`
    : `/matches/${stored.matchId}/games/${stored.gameId}`;

  return {
    href,
    title: `Resume ${game.label}`,
    matchName,
    target: 'game',
  };
}
