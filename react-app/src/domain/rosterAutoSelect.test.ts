import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from './database';
import { setLeagueSettings } from './leagueSettings';
import { LEGACY_POLICY } from './statistics/statCreditPolicy';
import {
  addGame,
  getMatchPlayers,
  getGamePlayers,
  isPlayerInMatch,
  isPlayerInGame,
  setMatchPlayerSubstitute,
  toggleGamePlayer,
  toggleMatchPlayer,
} from './matchGame';
import {
  AUTO_SELECT_PLAYER_LIMIT,
  addGameWithAutoRoster,
  autoSelectMatchRoster,
  autoSelectGameRoster,
} from './rosterAutoSelect';

function seedTeamsWithManyPlayers(homeCount: number, awayCount: number) {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home');
  const away = addTeam(data, 'Away');
  const homePlayers = Array.from({ length: homeCount }, (_, i) =>
    addPlayer(data, home.Id, `H${i + 1}`),
  );
  const awayPlayers = Array.from({ length: awayCount }, (_, i) =>
    addPlayer(data, away.Id, `A${i + 1}`),
  );
  const match = addMatch(data, home.Id, away.Id);
  return { data, match, homePlayers, awayPlayers };
}

describe('roster auto-select', () => {
  it(`selects up to ${AUTO_SELECT_PLAYER_LIMIT} home and away players on the match`, () => {
    const { data, match, homePlayers, awayPlayers } = seedTeamsWithManyPlayers(8, 8);
    autoSelectMatchRoster(data, match.Id);

    const rows = getMatchPlayers(data, match.Id);
    const homeSelected = rows.filter((row) => row.TeamHome);
    const awaySelected = rows.filter((row) => !row.TeamHome);
    expect(homeSelected).toHaveLength(AUTO_SELECT_PLAYER_LIMIT);
    expect(awaySelected).toHaveLength(AUTO_SELECT_PLAYER_LIMIT);
    for (let i = 0; i < AUTO_SELECT_PLAYER_LIMIT; i++) {
      expect(isPlayerInMatch(data, match.Id, homePlayers[i].Id)).toBe(true);
      expect(isPlayerInMatch(data, match.Id, awayPlayers[i].Id)).toBe(true);
    }
    expect(isPlayerInMatch(data, match.Id, homePlayers[6].Id)).toBe(false);
  });

  it('addGameWithAutoRoster creates a game and fills starters', () => {
    const { data, match, homePlayers } = seedTeamsWithManyPlayers(8, 8);
    autoSelectMatchRoster(data, match.Id);
    const gameId = addGameWithAutoRoster(data, match.Id);
    expect(getGamePlayers(data, gameId).length).toBe(AUTO_SELECT_PLAYER_LIMIT * 2);
    expect(isPlayerInGame(data, gameId, homePlayers[0].Id, match.Id)).toBe(true);
  });

  it('auto-selects game roster from match roster (first six per side)', () => {
    const { data, match, homePlayers } = seedTeamsWithManyPlayers(8, 8);
    autoSelectMatchRoster(data, match.Id);
    const gameId = addGame(data, match.Id);
    autoSelectGameRoster(data, match.Id, gameId);

    const gameRows = getGamePlayers(data, gameId);
    expect(gameRows.length).toBe(AUTO_SELECT_PLAYER_LIMIT * 2);
    expect(isPlayerInGame(data, gameId, homePlayers[0].Id, match.Id)).toBe(true);
    expect(isPlayerInGame(data, gameId, homePlayers[6].Id, match.Id)).toBe(false);
  });

  it('prefers non-subs when auto-selecting a game roster', () => {
    const { data, match, homePlayers, awayPlayers } = seedTeamsWithManyPlayers(8, 8);
    autoSelectMatchRoster(data, match.Id);
    setMatchPlayerSubstitute(data, match.Id, homePlayers[0].Id, true);
    setMatchPlayerSubstitute(data, match.Id, awayPlayers[0].Id, true);
    toggleMatchPlayer(data, match.Id, homePlayers[6].Id, true);
    toggleMatchPlayer(data, match.Id, awayPlayers[6].Id, false);

    const gameId = addGame(data, match.Id);
    autoSelectGameRoster(data, match.Id, gameId);

    expect(isPlayerInGame(data, gameId, homePlayers[1].Id, match.Id)).toBe(true);
    expect(isPlayerInGame(data, gameId, homePlayers[6].Id, match.Id)).toBe(true);
    expect(isPlayerInGame(data, gameId, homePlayers[0].Id, match.Id)).toBe(false);
    expect(isPlayerInGame(data, gameId, awayPlayers[0].Id, match.Id)).toBe(false);
    expect(getGamePlayers(data, gameId).length).toBe(AUTO_SELECT_PLAYER_LIMIT * 2);
  });

  it('respects a custom players-per-side league setting', () => {
    const { data, match, homePlayers, awayPlayers } = seedTeamsWithManyPlayers(8, 8);
    setLeagueSettings(data, LEGACY_POLICY, undefined, 3);
    autoSelectMatchRoster(data, match.Id);
    const rows = getMatchPlayers(data, match.Id);
    expect(rows.filter((row) => row.TeamHome)).toHaveLength(3);
    expect(rows.filter((row) => !row.TeamHome)).toHaveLength(3);

    const gameId = addGameWithAutoRoster(data, match.Id);
    expect(getGamePlayers(data, gameId)).toHaveLength(6);
    expect(isPlayerInGame(data, gameId, homePlayers[2].Id, match.Id)).toBe(true);
    expect(isPlayerInGame(data, gameId, homePlayers[3].Id, match.Id)).toBe(false);
    expect(isPlayerInGame(data, gameId, awayPlayers[3].Id, match.Id)).toBe(false);
  });

  it('does not add more players when the game already has a roster', () => {
    const { data, match, homePlayers, awayPlayers } = seedTeamsWithManyPlayers(8, 8);
    autoSelectMatchRoster(data, match.Id);
    const gameId = addGame(data, match.Id);
    // Manually select a smaller starter set
    toggleGamePlayer(data, match.Id, gameId, homePlayers[0].Id);
    toggleGamePlayer(data, match.Id, gameId, awayPlayers[0].Id);

    expect(autoSelectGameRoster(data, match.Id, gameId)).toBe(false);
    expect(getGamePlayers(data, gameId)).toHaveLength(2);
    expect(isPlayerInGame(data, gameId, homePlayers[1].Id, match.Id)).toBe(false);
  });
});
