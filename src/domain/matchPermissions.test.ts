import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from './database';
import { canDeleteMatchGame, canUndoMatchEnd } from './matchPermissions';

describe('canDeleteMatchGame', () => {
  it('allows anyone when there is no cloud league', () => {
    expect(
      canDeleteMatchGame({
        hasActiveLeague: false,
        isLeagueAdmin: false,
        userUid: null,
        createdByUid: null,
      }),
    ).toBe(true);
  });

  it('allows league admins even if they did not create the match', () => {
    expect(
      canDeleteMatchGame({
        hasActiveLeague: true,
        isLeagueAdmin: true,
        userUid: 'admin-1',
        createdByUid: 'scorer-1',
      }),
    ).toBe(true);
  });

  it('allows the match scorer who created the match', () => {
    expect(
      canDeleteMatchGame({
        hasActiveLeague: true,
        isLeagueAdmin: false,
        userUid: 'scorer-1',
        createdByUid: 'scorer-1',
      }),
    ).toBe(true);
  });

  it('denies other members, including matches with no creator', () => {
    expect(
      canDeleteMatchGame({
        hasActiveLeague: true,
        isLeagueAdmin: false,
        userUid: 'member-2',
        createdByUid: 'scorer-1',
      }),
    ).toBe(false);
    expect(
      canDeleteMatchGame({
        hasActiveLeague: true,
        isLeagueAdmin: false,
        userUid: 'member-2',
        createdByUid: null,
      }),
    ).toBe(false);
  });
});

describe('canUndoMatchEnd', () => {
  it('matches canDeleteMatchGame so scorers can undo without being admin', () => {
    const cases = [
      {
        hasActiveLeague: false,
        isLeagueAdmin: false,
        userUid: null,
        createdByUid: null,
      },
      {
        hasActiveLeague: true,
        isLeagueAdmin: true,
        userUid: 'admin-1',
        createdByUid: 'scorer-1',
      },
      {
        hasActiveLeague: true,
        isLeagueAdmin: false,
        userUid: 'scorer-1',
        createdByUid: 'scorer-1',
      },
      {
        hasActiveLeague: true,
        isLeagueAdmin: false,
        userUid: 'member-2',
        createdByUid: 'scorer-1',
      },
    ] as const;
    for (const options of cases) {
      expect(canUndoMatchEnd(options)).toBe(canDeleteMatchGame(options));
    }
  });
});

describe('addMatch CreatedByUid', () => {
  it('stamps the creator when provided', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    addPlayer(data, home.Id, 'Alex');
    const match = addMatch(data, home.Id, away.Id, 'uid-42');
    expect(match.CreatedByUid).toBe('uid-42');
  });

  it('omits creator when unsigned-in', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const match = addMatch(data, home.Id, away.Id);
    expect(match.CreatedByUid).toBeUndefined();
  });
});
