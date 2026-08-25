import { describe, expect, it } from 'vitest';
import {
  addMatch,
  addPlayer,
  addTeam,
  createEmptyDatabase,
  deletePlayer,
  deleteTeam,
  getPlayer,
  getPlayersForTeam,
  getTeam,
  getTeamForPlayer,
  playerIsUsedInMatches,
  renamePlayer,
  renameTeam,
  setPlayerImage,
  setTeamImage,
  teamIsUsedInMatches,
} from './database';
import { toggleMatchPlayer } from './matchGame';

describe('team and player rename/delete', () => {
  it('finds a player and their team', () => {
    const data = createEmptyDatabase();
    const team = addTeam(data, 'Hawks');
    const player = addPlayer(data, team.Id, 'Alice');

    expect(getPlayer(data, player.Id)?.Name).toBe('Alice');
    expect(getTeamForPlayer(data, player.Id)?.Id).toBe(team.Id);
  });

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

  it('sets and clears team and player image URLs', () => {
    const data = createEmptyDatabase();
    const team = addTeam(data, 'Hawks');
    const player = addPlayer(data, team.Id, 'Alice');

    setTeamImage(data, team.Id, 'https://cdn.example/hawks.png');
    setPlayerImage(data, player.Id, 'https://cdn.example/alice.png');

    expect(getTeam(data, team.Id)?.Image).toMatchObject({
      kind: 'external',
      url: 'https://cdn.example/hawks.png',
    });
    expect(getPlayersForTeam(data, team.Id)[0]?.Image).toMatchObject({
      kind: 'external',
      url: 'https://cdn.example/alice.png',
    });

    setTeamImage(data, team.Id, '  ');
    setPlayerImage(data, player.Id, null);
    expect(getTeam(data, team.Id)?.Image).toBeUndefined();
    expect(getPlayersForTeam(data, team.Id)[0]?.Image).toBeUndefined();
  });

  it('rejects non-https team image URLs', () => {
    const data = createEmptyDatabase();
    const team = addTeam(data, 'Hawks');
    expect(() => setTeamImage(data, team.Id, 'http://cdn.example/hawks.png')).toThrow(
      /https/,
    );
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
