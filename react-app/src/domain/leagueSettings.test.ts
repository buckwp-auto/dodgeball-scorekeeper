import { describe, expect, it } from 'vitest';
import { createEmptyDatabase } from './database';
import {
  getLeagueSettingsRow,
  resolveLeagueStatPolicy,
  setLeagueSettings,
} from './leagueSettings';
import { LEGACY_POLICY, STAT_CREDIT_PRESETS } from './statistics/statCreditPolicy';

describe('league settings', () => {
  it('resolves legacy policy when the table is empty', () => {
    const data = createEmptyDatabase();
    expect(data.Tables.LeagueSettings).toEqual([]);
    expect(resolveLeagueStatPolicy(data)).toEqual(LEGACY_POLICY);
    expect(getLeagueSettingsRow(data)).toBeUndefined();
  });

  it('round-trips a preset onto the singleton row', () => {
    const data = createEmptyDatabase();
    const saved = setLeagueSettings(data, STAT_CREDIT_PRESETS.sharedCredit);
    expect(data.Tables.LeagueSettings).toHaveLength(1);
    expect(resolveLeagueStatPolicy(data)).toEqual(STAT_CREDIT_PRESETS.sharedCredit);

    const again = setLeagueSettings(data, STAT_CREDIT_PRESETS.firstHitter);
    expect(again.Id).toBe(saved.Id);
    expect(data.Tables.LeagueSettings).toHaveLength(1);
    expect(resolveLeagueStatPolicy(data)).toEqual(STAT_CREDIT_PRESETS.firstHitter);
  });
});
