import { beforeEach, describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from './database';
import {
  LAST_SCORING_KEY,
  loadLastScoring,
  rememberLastGame,
  rememberLastMatch,
  resolveLastScoring,
  saveLastScoring,
} from './lastScoring';
import {
  addGame,
  deleteGame,
  deleteMatch,
  toggleGamePlayer,
  toggleMatchPlayer,
} from './matchGame';

function mockLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  return store;
}

function seedMatchWithGame(opts?: { withRoster?: boolean }) {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Hawks');
  const away = addTeam(data, 'Owls');
  const h1 = addPlayer(data, home.Id, 'Alex');
  const a1 = addPlayer(data, away.Id, 'Casey');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  const gameId = addGame(data, match.Id);
  if (opts?.withRoster !== false) {
    toggleGamePlayer(data, match.Id, gameId, h1.Id);
    toggleGamePlayer(data, match.Id, gameId, a1.Id);
  }
  return { data, match, gameId };
}

describe('last scoring storage', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('round-trips game and match pointers', () => {
    rememberLastGame('match-1', 'game-1');
    expect(loadLastScoring()).toEqual({
      target: 'game',
      matchId: 'match-1',
      gameId: 'game-1',
    });

    rememberLastMatch('match-1');
    expect(loadLastScoring()).toEqual({
      target: 'match',
      matchId: 'match-1',
    });
  });

  it('ignores invalid stored JSON', () => {
    localStorage.setItem(LAST_SCORING_KEY, '{not json');
    expect(loadLastScoring()).toBeNull();
    saveLastScoring({ target: 'match', matchId: 'm1' });
    localStorage.setItem(LAST_SCORING_KEY, JSON.stringify({ target: 'game' }));
    expect(loadLastScoring()).toBeNull();
  });
});

describe('resolveLastScoring', () => {
  it('links an in-progress game with a roster to track-game events', () => {
    const { data, match, gameId } = seedMatchWithGame();
    const link = resolveLastScoring(data, {
      target: 'game',
      matchId: match.Id,
      gameId,
    });
    expect(link).toEqual({
      href: `/matches/${match.Id}/games/${gameId}/events`,
      title: 'Resume Game 1',
      matchName: 'Hawks vs. Owls',
      target: 'game',
    });
  });

  it('links a game without both sides to the roster screen', () => {
    const { data, match, gameId } = seedMatchWithGame({ withRoster: false });
    const link = resolveLastScoring(data, {
      target: 'game',
      matchId: match.Id,
      gameId,
    });
    expect(link?.href).toBe(`/matches/${match.Id}/games/${gameId}`);
    expect(link?.target).toBe('game');
  });

  it('links a finished-scoring pointer to track match', () => {
    const { data, match } = seedMatchWithGame();
    const link = resolveLastScoring(data, {
      target: 'match',
      matchId: match.Id,
    });
    expect(link).toEqual({
      href: `/matches/${match.Id}/events`,
      title: 'Resume match',
      matchName: 'Hawks vs. Owls',
      target: 'match',
    });
  });

  it('falls back to the match when the remembered game was deleted', () => {
    const { data, match, gameId } = seedMatchWithGame();
    deleteGame(data, match.Id, gameId);
    const link = resolveLastScoring(data, {
      target: 'game',
      matchId: match.Id,
      gameId,
    });
    expect(link).toEqual({
      href: `/matches/${match.Id}/events`,
      title: 'Resume match',
      matchName: 'Hawks vs. Owls',
      target: 'match',
    });
  });

  it('returns null when the match is gone', () => {
    const { data, match, gameId } = seedMatchWithGame();
    deleteMatch(data, match.Id);
    expect(
      resolveLastScoring(data, {
        target: 'game',
        matchId: match.Id,
        gameId,
      }),
    ).toBeNull();
    expect(
      resolveLastScoring(data, { target: 'match', matchId: match.Id }),
    ).toBeNull();
  });
});
