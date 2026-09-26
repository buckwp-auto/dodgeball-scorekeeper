import { describe, expect, it } from 'vitest';
import { canViewLeague, isViewerBanned } from './viewerAccess';

describe('viewerAccess', () => {
  it('treats null restriction as not banned and all leagues allowed', () => {
    expect(isViewerBanned(null)).toBe(false);
    expect(canViewLeague('league-a', null)).toBe(true);
  });

  it('blocks banned viewers from every league', () => {
    const banned = { banned: true, allowedLeagueIds: ['league-a'] };
    expect(isViewerBanned(banned)).toBe(true);
    expect(canViewLeague('league-a', banned)).toBe(false);
    expect(canViewLeague('league-b', banned)).toBe(false);
  });

  it('allows any league when allowlist is empty', () => {
    const open = { banned: false, allowedLeagueIds: [] as string[] };
    expect(canViewLeague('league-a', open)).toBe(true);
    expect(canViewLeague('league-b', open)).toBe(true);
  });

  it('restricts to allowlisted league ids', () => {
    const limited = {
      banned: false,
      allowedLeagueIds: ['league-a', 'league-c'],
    };
    expect(canViewLeague('league-a', limited)).toBe(true);
    expect(canViewLeague('league-b', limited)).toBe(false);
    expect(canViewLeague('league-c', limited)).toBe(true);
  });

  it('rejects blank league ids', () => {
    expect(canViewLeague('', null)).toBe(false);
    expect(canViewLeague('   ', null)).toBe(false);
  });
});
