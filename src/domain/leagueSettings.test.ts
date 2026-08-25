import { describe, expect, it } from 'vitest';
import { createEmptyDatabase } from './database';
import {
  DEFAULT_HIGHLIGHT_QUALIFIERS,
  DEFAULT_PLAYERS_PER_SIDE,
  DISABLED_HIGHLIGHT_QUALIFIERS,
  getLeagueSettingsRow,
  normalizeHighlightQualifiers,
  normalizePlayersPerSide,
  resolveHighlightQualifiers,
  resolveLeagueStatPolicy,
  resolvePlayersPerSide,
  setLeagueSettings,
} from './leagueSettings';
import { LEGACY_POLICY, STAT_CREDIT_PRESETS } from './statistics/statCreditPolicy';

describe('league settings', () => {
  it('resolves legacy policy when the table is empty', () => {
    const data = createEmptyDatabase();
    expect(data.Tables.LeagueSettings).toEqual([]);
    expect(resolveLeagueStatPolicy(data)).toEqual(LEGACY_POLICY);
    expect(getLeagueSettingsRow(data)).toBeUndefined();
    expect(resolveHighlightQualifiers(data)).toEqual(DEFAULT_HIGHLIGHT_QUALIFIERS);
    expect(resolvePlayersPerSide(data)).toBe(DEFAULT_PLAYERS_PER_SIDE);
  });

  it('round-trips a preset onto the singleton row', () => {
    const data = createEmptyDatabase();
    const saved = setLeagueSettings(data, STAT_CREDIT_PRESETS.sharedCredit);
    expect(data.Tables.LeagueSettings).toHaveLength(1);
    expect(resolveLeagueStatPolicy(data)).toEqual(STAT_CREDIT_PRESETS.sharedCredit);
    expect(resolveHighlightQualifiers(data)).toEqual(DEFAULT_HIGHLIGHT_QUALIFIERS);

    const again = setLeagueSettings(data, STAT_CREDIT_PRESETS.firstHitter);
    expect(again.Id).toBe(saved.Id);
    expect(data.Tables.LeagueSettings).toHaveLength(1);
    expect(resolveLeagueStatPolicy(data)).toEqual(STAT_CREDIT_PRESETS.firstHitter);
    expect(resolveHighlightQualifiers(data)).toEqual(DEFAULT_HIGHLIGHT_QUALIFIERS);
    expect(resolvePlayersPerSide(data)).toBe(DEFAULT_PLAYERS_PER_SIDE);
  });

  it('persists highlight qualifier toggles and thresholds', () => {
    const data = createEmptyDatabase();
    const custom = {
      ...DISABLED_HIGHLIGHT_QUALIFIERS,
      minGamesEnabled: true,
      minGames: 8,
      minVolumeEnabled: true,
      minThrows: 12,
      minTargets: 18,
    };
    setLeagueSettings(data, LEGACY_POLICY, custom);
    expect(resolveHighlightQualifiers(data)).toEqual(custom);

    setLeagueSettings(data, STAT_CREDIT_PRESETS.sharedCredit);
    expect(resolveHighlightQualifiers(data)).toEqual(custom);
    expect(resolveLeagueStatPolicy(data)).toEqual(STAT_CREDIT_PRESETS.sharedCredit);
  });

  it('treats a credit-only legacy row as default qualifiers', () => {
    const data = createEmptyDatabase();
    data.Tables.LeagueSettings = [
      {
        Id: 'settings-1',
        PolicyVersion: 1,
        TeamThrowKillCreditMode: 'legacyPerThrow',
      },
    ];
    expect(resolveHighlightQualifiers(data)).toEqual(DEFAULT_HIGHLIGHT_QUALIFIERS);
  });

  it('normalizes invalid qualifier counts', () => {
    expect(normalizeHighlightQualifiers({ minGames: -3, minThrows: 12.6 }).minGames).toBe(0);
    expect(normalizeHighlightQualifiers({ minThrows: 12.6 }).minThrows).toBe(13);
    expect(normalizeHighlightQualifiers({ minGamesEnabled: false }).minGamesEnabled).toBe(false);
  });

  it('persists players per side and keeps it when only credit settings change', () => {
    const data = createEmptyDatabase();
    expect(resolvePlayersPerSide(data)).toBe(6);
    setLeagueSettings(data, LEGACY_POLICY, undefined, 4);
    expect(resolvePlayersPerSide(data)).toBe(4);
    expect(getLeagueSettingsRow(data)?.PlayersPerSide).toBe(4);

    setLeagueSettings(data, STAT_CREDIT_PRESETS.sharedCredit);
    expect(resolvePlayersPerSide(data)).toBe(4);
    expect(resolveLeagueStatPolicy(data)).toEqual(STAT_CREDIT_PRESETS.sharedCredit);
  });

  it('normalizes players per side to 1–12', () => {
    expect(normalizePlayersPerSide(undefined)).toBe(6);
    expect(normalizePlayersPerSide(0)).toBe(1);
    expect(normalizePlayersPerSide(3.6)).toBe(4);
    expect(normalizePlayersPerSide(99)).toBe(12);
  });
});
