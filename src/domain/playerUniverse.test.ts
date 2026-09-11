import { describe, expect, it } from 'vitest';
import {
  addPlayer,
  addTeam,
  createEmptyDatabase,
  setPlayerImage,
} from './database';
import { linkPlayer } from './playerMatch';
import {
  buildUniversePlayers,
  suggestUniversePlayers,
  universePlayerLabel,
} from './playerUniverse';

describe('buildUniversePlayers', () => {
  it('skips linked aliases and dedupes by normalized name preferring image then core', () => {
    const summer = createEmptyDatabase();
    const hawks = addTeam(summer, 'Hawks');
    const owls = addTeam(summer, 'Owls');
    const alex = addPlayer(summer, hawks.Id, 'Alex');
    setPlayerImage(summer, alex.Id, 'https://cdn.example/alex.png');
    const guest = addPlayer(summer, owls.Id, 'Alex');
    guest.AddedFromMatch = true;
    linkPlayer(summer, guest.Id, alex.Id);

    const winter = createEmptyDatabase();
    const wolves = addTeam(winter, 'Wolves');
    const alexGuest = addPlayer(winter, wolves.Id, '  alex  ');
    alexGuest.AddedFromMatch = true;

    const universe = buildUniversePlayers([
      { leagueId: 'summer', leagueName: 'Summer', data: summer },
      { leagueId: 'winter', leagueName: 'Winter', data: winter },
    ]);

    expect(universe).toHaveLength(1);
    expect(universe[0]).toMatchObject({
      playerName: 'Alex',
      teamName: 'Hawks',
      leagueName: 'Summer',
      leagueId: 'summer',
      addedFromMatch: false,
    });
    expect(universe[0]?.image).toMatchObject({
      url: 'https://cdn.example/alex.png',
    });
    expect(universe.map((row) => row.key)).not.toContain(
      `summer:${guest.Id}`,
    );
  });

  it('prefers a core roster row without image over a match-added guest', () => {
    const leagueA = createEmptyDatabase();
    const teamA = addTeam(leagueA, 'A');
    const guest = addPlayer(leagueA, teamA.Id, 'Pat');
    guest.AddedFromMatch = true;

    const leagueB = createEmptyDatabase();
    const teamB = addTeam(leagueB, 'B');
    addPlayer(leagueB, teamB.Id, 'Pat');

    const universe = buildUniversePlayers([
      { leagueId: 'a', leagueName: 'League A', data: leagueA },
      { leagueId: 'b', leagueName: 'League B', data: leagueB },
    ]);

    expect(universe).toHaveLength(1);
    expect(universe[0]).toMatchObject({
      leagueId: 'b',
      teamName: 'B',
      addedFromMatch: false,
    });
  });
});

describe('suggestUniversePlayers', () => {
  it('ranks matches and excludes names already on the target team', () => {
    const summer = createEmptyDatabase();
    const hawks = addTeam(summer, 'Hawks');
    addPlayer(summer, hawks.Id, 'Alex Smith');
    addPlayer(summer, hawks.Id, 'Casey');

    const winter = createEmptyDatabase();
    const wolves = addTeam(winter, 'Wolves');
    addPlayer(winter, wolves.Id, 'Alexandra');

    const universe = buildUniversePlayers([
      { leagueId: 'summer', leagueName: 'Summer', data: summer },
      { leagueId: 'winter', leagueName: 'Winter', data: winter },
    ]);

    const hits = suggestUniversePlayers(universe, {
      query: 'Alex',
      excludeNames: ['Casey'],
    });
    expect(hits.map((row) => row.playerName)).toEqual([
      'Alex Smith',
      'Alexandra',
    ]);
    expect(hits[0]?.rank).toBe('prefix');
    expect(hits[1]?.rank).toBe('prefix');
    expect(universePlayerLabel(hits[0]!)).toBe(
      'Alex Smith (Hawks · Summer)',
    );

    const excluded = suggestUniversePlayers(universe, {
      query: 'Cas',
      excludeNames: ['casey'],
    });
    expect(excluded).toEqual([]);
  });
});
