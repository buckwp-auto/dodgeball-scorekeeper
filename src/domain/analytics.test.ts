import { describe, expect, it } from 'vitest';
import { pageNameFromPath } from './analytics';

describe('pageNameFromPath', () => {
  it('maps known routes', () => {
    expect(pageNameFromPath('/')).toBe('overview');
    expect(pageNameFromPath('/teams')).toBe('teams');
    expect(pageNameFromPath('/teams/abc')).toBe('team');
    expect(pageNameFromPath('/players/p1')).toBe('player');
    expect(pageNameFromPath('/matches')).toBe('matches');
    expect(pageNameFromPath('/matches/m1')).toBe('match');
    expect(pageNameFromPath('/matches/m1/stats')).toBe('match_stats');
    expect(pageNameFromPath('/matches/m1/events')).toBe('match_events');
    expect(pageNameFromPath('/matches/m1/games/g1')).toBe('game');
    expect(pageNameFromPath('/matches/m1/games/g1/stats')).toBe('game_stats');
    expect(pageNameFromPath('/matches/m1/games/g1/events')).toBe('track_game');
    expect(pageNameFromPath('/stats')).toBe('stats');
    expect(pageNameFromPath('/highlights')).toBe('highlights');
    expect(pageNameFromPath('/settings')).toBe('settings');
    expect(pageNameFromPath('/history')).toBe('history');
    expect(pageNameFromPath('/youtube-popout')).toBe('youtube_popout');
  });

  it('ignores trailing slashes', () => {
    expect(pageNameFromPath('/teams/')).toBe('teams');
    expect(pageNameFromPath('/matches/m1/games/g1/events/')).toBe('track_game');
  });

  it('returns other for unknown paths', () => {
    expect(pageNameFromPath('/not-a-real-page')).toBe('other');
    expect(pageNameFromPath('/matches/m1/games')).toBe('other');
  });
});
