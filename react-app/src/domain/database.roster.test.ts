import { describe, expect, it } from 'vitest';
import {
  addMatch,
  addPlayer,
  addTeam,
  createEmptyDatabase,
  deletePlayer,
  deleteTeam,
  getPlayersForTeam,
  getTeam,
  playerIsUsedInMatches,
  renamePlayer,
  renameTeam,
  teamIsUsedInMatches,
} from './database';
import { toggleMatchPlayer } from './matchGame';

describe('team and player rename/delete', () => {
  it('renames teams and players', () => {
    const data = createEmptyDatabase();
    const team = addTeam(data, 'Dogs');
    const player = addPlayer(data, team.Id, 'Alice');

    renameTeam(data, team.Id, 'Big Dogs');
    renamePlayer(data, player.Id, 'Alicia');

    expect(getTeam(data, team.Id)?.Name).toBe('Big Dogs');
    expect(getPlayersForTeam(data, team.Id)[0]?.Name).toBe('Alicia');
  });

  it('deletes unused teams and players', () => {
    const data = createEmptyDatabase();
    const team = addTeam(data, 'Dogs');
    const player = addPlayer(data, team.Id, 'Alice');

    deletePlayer(data, player.Id);
    expect(getPlayersForTeam(data, team.Id)).toHaveLength(0);

    deleteTeam(data, team.Id);
    expect(getTeam(data, team.Id)).toBeUndefined();
  });

  it('blocks delete when referenced by a match', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const player = addPlayer(data, home.Id, 'Alice');
    const match = addMatch(data, home.Id, away.Id);
    toggleMatchPlayer(data, match.Id, player.Id, true);

    expect(teamIsUsedInMatches(data, home.Id)).toBe(true);
    expect(playerIsUsedInMatches(data, player.Id)).toBe(true);
    expect(() => deleteTeam(data, home.Id)).toThrow(/match/);
    expect(() => deletePlayer(data, player.Id)).toThrow(/match roster/);
  });
});
