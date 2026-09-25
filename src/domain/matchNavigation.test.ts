import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase, normalizeDatabase } from './database';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from './matchGame';
import {
  activeMatchGameId,
  gameIdFromPath,
  gameTrackHref,
  resolveMatchNavTargets,
} from './matchNavigation';

const fixturePath = path.join(
  import.meta.dirname,
  '../../tests/fixtures/league-six-teams.scrkpr',
);
const sample = normalizeDatabase(JSON.parse(readFileSync(fixturePath, 'utf-8')));

function databaseWithOpenGame() {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home');
  const away = addTeam(data, 'Away');
  const homePlayer = addPlayer(data, home.Id, 'H1');
  const awayPlayer = addPlayer(data, away.Id, 'A1');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, homePlayer.Id, true);
  toggleMatchPlayer(data, match.Id, awayPlayer.Id, false);
  const gameId = addGame(data, match.Id);
  toggleGamePlayer(data, match.Id, gameId, homePlayer.Id);
  toggleGamePlayer(data, match.Id, gameId, awayPlayer.Id);
  return { data, matchId: match.Id, gameId };
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

  it('points continue game at the first unfinished game', () => {
    const { data, matchId, gameId } = databaseWithOpenGame();
    expect(activeMatchGameId(data, matchId)).toBe(gameId);
    const nav = resolveMatchNavTargets(data, matchId, `/matches/${matchId}/events`);
    expect(nav?.continueGame.href).toBe(gameTrackHref(data, matchId, gameId));
    expect(nav?.continueGame.disabled).toBe(false);
  });
});
