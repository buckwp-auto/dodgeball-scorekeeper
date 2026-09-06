import { describe, expect, it } from 'vitest';
import { addMatch, addTeam, createEmptyDatabase, getMatchDisplayName, getMatchName } from './database';
import {
  SUGGESTED_MATCH_LABELS,
  formatMatchDisplayName,
  listLeagueMatchLabels,
  listMatchLabelSuggestions,
  matchPassesListSearch,
  normalizeMatchLabels,
  setMatchLabels,
} from './matchLabels';

describe('normalizeMatchLabels', () => {
  it('trims, clamps, dedupes case-insensitively, and caps count', () => {
    expect(
      normalizeMatchLabels([
        '  Week 3  ',
        'week 3',
        '',
        'Playoffs',
        '   ',
        'a'.repeat(50),
        'GOTW',
        'Extra1',
        'Extra2',
        'Extra3',
        'Extra4',
        'Extra5',
        'Extra6',
      ]),
    ).toEqual([
      'Week 3',
      'Playoffs',
      'a'.repeat(40),
      'GOTW',
      'Extra1',
      'Extra2',
      'Extra3',
      'Extra4',
    ]);
  });

  it('returns empty for non-arrays', () => {
    expect(normalizeMatchLabels(null)).toEqual([]);
    expect(normalizeMatchLabels('Week 3')).toEqual([]);
  });
});

describe('formatMatchDisplayName', () => {
  it('keeps pairing when there are no labels', () => {
    expect(formatMatchDisplayName('Hawks vs. Owls', [])).toBe('Hawks vs. Owls');
  });

  it('appends labels with middots', () => {
    expect(formatMatchDisplayName('Hawks vs. Owls', ['Week 3', 'GOTW'])).toBe(
      'Hawks vs. Owls · Week 3 · GOTW',
    );
  });
});

describe('setMatchLabels / league suggestions', () => {
  it('stores normalized labels and lists league-wide suggestions', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Hawks');
    const away = addTeam(data, 'Owls');
    const otherAway = addTeam(data, 'Eagles');
    const matchA = addMatch(data, home.Id, away.Id);
    const matchB = addMatch(data, home.Id, otherAway.Id);

    expect(getMatchName(data, matchA)).toBe('Hawks vs. Owls');
    expect(getMatchDisplayName(data, matchA)).toBe('Hawks vs. Owls');

    setMatchLabels(data, matchA.Id, ['Week 3', 'Game of the Week']);
    setMatchLabels(data, matchB.Id, ['week 3', 'Playoffs']);

    expect(matchA.Labels).toEqual(['Week 3', 'Game of the Week']);
    expect(getMatchDisplayName(data, matchA)).toBe(
      'Hawks vs. Owls · Week 3 · Game of the Week',
    );
    expect(listLeagueMatchLabels(data)).toEqual([
      'Game of the Week',
      'Playoffs',
      'Week 3',
    ]);

    setMatchLabels(data, matchA.Id, []);
    expect(matchA.Labels).toBeUndefined();
  });
});

describe('listMatchLabelSuggestions', () => {
  it('includes presets then custom league labels', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Hawks');
    const away = addTeam(data, 'Owls');
    const match = addMatch(data, home.Id, away.Id);
    setMatchLabels(data, match.Id, ['Charity Cup']);

    const suggestions = listMatchLabelSuggestions(data);
    expect(suggestions.slice(0, SUGGESTED_MATCH_LABELS.length)).toEqual([
      ...SUGGESTED_MATCH_LABELS,
    ]);
    expect(suggestions).toContain('Charity Cup');
    expect(suggestions.filter((label) => label === 'Week 3')).toHaveLength(1);
  });
});

describe('matchPassesListSearch', () => {
  it('matches team names and labels; empty query keeps all', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Hawks');
    const away = addTeam(data, 'Owls');
    const other = addTeam(data, 'Eagles');
    const labeled = addMatch(data, home.Id, away.Id);
    const plain = addMatch(data, home.Id, other.Id);
    setMatchLabels(data, labeled.Id, ['Week 3', 'Playoffs']);

    expect(matchPassesListSearch(data, labeled, '')).toBe(true);
    expect(matchPassesListSearch(data, labeled, '  ')).toBe(true);
    expect(matchPassesListSearch(data, labeled, 'hawk')).toBe(true);
    expect(matchPassesListSearch(data, labeled, 'OWL')).toBe(true);
    expect(matchPassesListSearch(data, labeled, 'week')).toBe(true);
    expect(matchPassesListSearch(data, labeled, 'playoff')).toBe(true);
    expect(matchPassesListSearch(data, labeled, 'eagles')).toBe(false);
    expect(matchPassesListSearch(data, plain, 'week')).toBe(false);
    expect(matchPassesListSearch(data, plain, 'eagles')).toBe(true);
  });
});
