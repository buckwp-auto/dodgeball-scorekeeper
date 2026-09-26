import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase, normalizeDatabase } from './database';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from './matchGame';
import {
  gameIdFromPath,
  gameTrackHref,
  resolveMatchNavTargets,
  resolveMatchTrackGameId,
} from './matchNavigation';

const fixturePath = path.join(
  import.meta.dirname,
  '../../tests/fixtures/league-six-teams.scrkpr',
);
const sample = normalizeDatabase(JSON.parse(readFileSync(fixturePath, 'utf-8')));

function databaseWithGames(count: number) {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home');
  const away = addTeam(data, 'Away');
  const homePlayer = addPlayer(data, home.Id, 'H1');
  const awayPlayer = addPlayer(data, away.Id, 'A1');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, homePlayer.Id, true);
  toggleMatchPlayer(data, match.Id, awayPlayer.Id, false);
  const gameIds: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const gameId = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, gameId, homePlayer.Id);
    toggleGamePlayer(data, match.Id, gameId, awayPlayer.Id);
    gameIds.push(gameId);
  }
  return { data, matchId: match.Id, gameIds };
}

describe('matchNavigation', () => {
  it('reads game id from nested match routes', () => {
    expect(gameIdFromPath('/matches/m1/games/g1/events')).toBe('g1');
    expect(gameIdFromPath('/matches/m1/stats')).toBeNull();
  });

  it('resolves go-to-match for a tracked match', () => {
    const matchId = (sample.Tables.Match as { Id: string }[])[0]!.Id;
    const nav = resolveMatchNavTargets(
      sample,
      matchId,
      `/matches/${matchId}/events`,
    );
    expect(nav?.goToMatch.href).toBe(`/matches/${matchId}`);
    expect(nav?.goToMatch.disabled).toBe(false);
  });

  it('defaults track game to the last game in the match', () => {
    const { data, matchId, gameIds } = databaseWithGames(2);
    const lastId = gameIds[1]!;
    expect(resolveMatchTrackGameId(data, matchId, `/matches/${matchId}`, null)).toBe(
      lastId,
    );
    const nav = resolveMatchNavTargets(data, matchId, `/matches/${matchId}`, null);
    expect(nav?.trackGame.href).toBe(gameTrackHref(data, matchId, lastId));
    expect(nav?.trackGame.label).toBe('Track Game 2');
    expect(nav?.trackGame.disabled).toBe(false);
  });

  it('prefers the last opened game for this match over the last game', () => {
    const { data, matchId, gameIds } = databaseWithGames(2);
    const firstId = gameIds[0]!;
    const nav = resolveMatchNavTargets(data, matchId, `/matches/${matchId}`, {
      target: 'game',
      matchId,
      gameId: firstId,
    });
    expect(nav?.trackGame.href).toBe(gameTrackHref(data, matchId, firstId));
    expect(nav?.trackGame.label).toBe('Track Game 1');
  });

  it('prefers the game in the URL over last-scoring memory', () => {
    const { data, matchId, gameIds } = databaseWithGames(2);
    const firstId = gameIds[0]!;
    const secondId = gameIds[1]!;
    expect(
      resolveMatchTrackGameId(data, matchId, `/matches/${matchId}/games/${secondId}`, {
        target: 'game',
        matchId,
        gameId: firstId,
      }),
    ).toBe(secondId);
  });

  it('ignores last-scoring memory from a different match', () => {
    const { data, matchId, gameIds } = databaseWithGames(2);
    const lastId = gameIds[1]!;
    expect(
      resolveMatchTrackGameId(data, matchId, `/matches/${matchId}`, {
        target: 'game',
        matchId: 'other-match',
        gameId: gameIds[0]!,
      }),
    ).toBe(lastId);
  });
});
