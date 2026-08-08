import { describe, expect, it } from 'vitest';
import {
  LEGACY_POLICY,
  matchingStatCreditPreset,
  normalizeStatCreditPolicy,
  STAT_CREDIT_PRESETS,
} from './statCreditPolicy';

describe('normalizeStatCreditPolicy', () => {
  it('returns legacy defaults for empty input', () => {
    expect(normalizeStatCreditPolicy(undefined)).toEqual(LEGACY_POLICY);
    expect(normalizeStatCreditPolicy({})).toEqual(LEGACY_POLICY);
  });

  it('ignores unknown modes and clamps weights', () => {
    const policy = normalizeStatCreditPolicy({
      teamThrowKillCreditMode: 'nope' as never,
      teamThrowFirstHitPercent: 140,
      deflectionKillWeight: -1,
      deflectionCatchDeathWeight: 9,
      trackMultiKills: true,
    });
    expect(policy.teamThrowKillCreditMode).toBe('legacyPerThrow');
    expect(policy.teamThrowFirstHitPercent).toBe(100);
    expect(policy.deflectionKillWeight).toBe(0);
    expect(policy.deflectionCatchDeathWeight).toBe(2);
    expect(policy.trackMultiKills).toBe(true);
  });

  it('matches named presets', () => {
    expect(matchingStatCreditPreset(LEGACY_POLICY)).toBe('legacy');
    expect(matchingStatCreditPreset(STAT_CREDIT_PRESETS.sharedCredit)).toBe('sharedCredit');
    expect(
      matchingStatCreditPreset({
        ...STAT_CREDIT_PRESETS.sharedCredit,
        teamThrowFirstHitPercent: 75,
      }),
    ).toBe('custom');
  });
});
