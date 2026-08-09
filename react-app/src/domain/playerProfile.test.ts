import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from './database';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from './matchGame';
import { getPlayerGamesPlayed, listPlayersForDirectory, playerHref } from './playerProfile';

describe('player profile', () => {
  it('builds a player href', () => {
    expect(playerHref('abc')).toBe('/players/abc');
  });

  it('lists rostered players with team names', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Hawks');
    const away = addTeam(data, 'Owls');
    addPlayer(data, home.Id, 'Alex');
    addPlayer(data, away.Id, 'Casey');
    expect(listPlayersForDirectory(data)).toEqual([
      expect.objectContaining({ playerName: 'Alex', teamName: 'Hawks' }),
      expect.objectContaining({ playerName: 'Casey', teamName: 'Owls' }),
    ]);
  });

  it('lists games the player was on the roster for', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Hawks');
    const away = addTeam(data, 'Owls');
    const alex = addPlayer(data, home.Id, 'Alex');
    const casey = addPlayer(data, away.Id, 'Casey');
    const match = addMatch(data, home.Id, away.Id);
    toggleMatchPlayer(data, match.Id, alex.Id, true);
    toggleMatchPlayer(data, match.Id, casey.Id, false);
    const game1 = addGame(data, match.Id);
    const game2 = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, game1, alex.Id);
    toggleGamePlayer(data, match.Id, game1, casey.Id);
    toggleGamePlayer(data, match.Id, game2, casey.Id);

    const alexGames = getPlayerGamesPlayed(data, alex.Id);
    expect(alexGames).toEqual([
      expect.objectContaining({
        matchId: match.Id,
        matchName: 'Hawks vs. Owls',
        gameId: game1,
        gameName: 'Game 1',
      }),
    ]);
    expect(getPlayerGamesPlayed(data, casey.Id).map((row) => row.gameId)).toEqual([
      game1,
      game2,
    ]);
  });
});
