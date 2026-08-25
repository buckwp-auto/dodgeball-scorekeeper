import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from './database';
import { getGameStartEvent, setGameEventVideoOffset } from './gameEvents';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from './matchGame';
import {
  MATCH_CLOCK_NO_START,
  MATCH_CLOCK_NO_TIME,
  MATCH_CLOCK_NO_VIDEO,
  formatMatchRunningTime,
  matchClockStartOffsetSeconds,
  resolveMatchRunningTime,
} from './matchClock';

function setupMatchWithTwoGames() {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home Hawks');
  const away = addTeam(data, 'Away Owls');
  const h1 = addPlayer(data, home.Id, 'Alex');
  const a1 = addPlayer(data, away.Id, 'Casey');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  const game1 = addGame(data, match.Id);
  const game2 = addGame(data, match.Id);
  toggleGamePlayer(data, match.Id, game1, h1.Id);
  toggleGamePlayer(data, match.Id, game1, a1.Id);
  toggleGamePlayer(data, match.Id, game2, h1.Id);
  toggleGamePlayer(data, match.Id, game2, a1.Id);
  return { data, match, game1, game2 };
}

describe('matchClockStartOffsetSeconds', () => {
  it('returns null when no Game start is stamped', () => {
    const { data, match, game1 } = setupMatchWithTwoGames();
    expect(matchClockStartOffsetSeconds(data, match.Id, game1)).toBeNull();
  });

  it('prefers the current game start stamp', () => {
    const { data, match, game1, game2 } = setupMatchWithTwoGames();
    setGameEventVideoOffset(data, getGameStartEvent(data, game1)!.Id, 60);
    setGameEventVideoOffset(data, getGameStartEvent(data, game2)!.Id, 180);
    expect(matchClockStartOffsetSeconds(data, match.Id, game2)).toBe(180);
  });

  it('falls back to the first stamped Game start in the match', () => {
    const { data, match, game1, game2 } = setupMatchWithTwoGames();
    setGameEventVideoOffset(data, getGameStartEvent(data, game1)!.Id, 45);
    expect(matchClockStartOffsetSeconds(data, match.Id, game2)).toBe(45);
  });
});

describe('resolveMatchRunningTime', () => {
  it('uses empty states instead of fabricating a clock', () => {
    expect(
      resolveMatchRunningTime({
        hasVideo: false,
        startOffsetSeconds: 10,
        videoNowSeconds: 20,
      }),
    ).toEqual({ status: 'no-video' });
    expect(
      resolveMatchRunningTime({
        hasVideo: true,
        startOffsetSeconds: null,
        videoNowSeconds: 20,
      }),
    ).toEqual({ status: 'no-start-stamp' });
    expect(
      resolveMatchRunningTime({
        hasVideo: true,
        startOffsetSeconds: 10,
        videoNowSeconds: null,
      }),
    ).toEqual({ status: 'no-current-time' });
    expect(
      resolveMatchRunningTime({
        hasVideo: true,
        startOffsetSeconds: 90,
        videoNowSeconds: 30,
      }),
    ).toEqual({ status: 'before-start' });
  });

  it('subtracts Game start from the VOD clock', () => {
    expect(
      resolveMatchRunningTime({
        hasVideo: true,
        startOffsetSeconds: 90,
        videoNowSeconds: 152,
      }),
    ).toEqual({ status: 'ready', elapsedSeconds: 62 });
  });
});

describe('formatMatchRunningTime', () => {
  it('formats elapsed video time and empty-state labels', () => {
    expect(
      formatMatchRunningTime({ status: 'ready', elapsedSeconds: 62 }),
    ).toBe('1:02');
    expect(formatMatchRunningTime({ status: 'no-video' })).toBe(MATCH_CLOCK_NO_VIDEO);
    expect(formatMatchRunningTime({ status: 'no-start-stamp' })).toBe(
      MATCH_CLOCK_NO_START,
    );
    expect(formatMatchRunningTime({ status: 'no-current-time' })).toBe(
      MATCH_CLOCK_NO_TIME,
    );
    expect(formatMatchRunningTime({ status: 'before-start' })).toBe(MATCH_CLOCK_NO_TIME);
  });
});
