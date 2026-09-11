import { describe, expect, it } from 'vitest';
import { SAMPLE_LEAGUE_LABEL } from './localLeagueLabel';
import {
  SAMPLE_PLAYER_UNIVERSE,
  SAMPLE_PRIOR_LEAGUE_NAME,
} from './samplePlayerUniverse';
import { suggestUniversePlayers } from './playerUniverse';

describe('SAMPLE_PLAYER_UNIVERSE', () => {
  it('provides ranked suggestions for the sample-league demo fixture', () => {
    expect(SAMPLE_LEAGUE_LABEL).toBe('Sample league (demo)');
    expect(SAMPLE_PLAYER_UNIVERSE.length).toBeGreaterThan(5);
    expect(
      SAMPLE_PLAYER_UNIVERSE.every(
        (row) => row.leagueName === SAMPLE_PRIOR_LEAGUE_NAME && row.image?.url,
      ),
    ).toBe(true);

    const hits = suggestUniversePlayers(SAMPLE_PLAYER_UNIVERSE, {
      query: 'Kat',
      excludeNames: ['Frodo Baggins'],
    });
    expect(hits[0]?.playerName).toBe('Katniss Everdeen');
    expect(hits.map((row) => row.playerName)).not.toContain('Frodo Baggins');
  });
});
