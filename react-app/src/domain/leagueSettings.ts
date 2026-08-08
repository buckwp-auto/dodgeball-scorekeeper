import { newIdTimestamp } from './id';
import type { DatabaseDto, Guid } from './types';
import {
  LEGACY_POLICY,
  normalizeStatCreditPolicy,
  type StatCreditPolicy,
  type TeamThrowAssistMode,
  type TeamThrowKillCreditMode,
} from './statistics/statCreditPolicy';

export type LeagueSettingsRow = {
  Id: Guid;
  PolicyVersion?: number;
  TeamThrowKillCreditMode?: TeamThrowKillCreditMode;
  TeamThrowFirstHitPercent?: number;
  TeamThrowAssistMode?: TeamThrowAssistMode;
  DedupeSameTargetEliminations?: boolean;
  DeflectionKillWeight?: number;
  DeflectionCatchDeathWeight?: number;
  CountDeflectionCatchesSeparately?: boolean;
  TrackMultiKills?: boolean;
  TrackMultiCatches?: boolean;
};

function table<T>(data: DatabaseDto, name: string): T[] {
  return (data.Tables[name] ?? []) as T[];
}

export function getLeagueSettingsRow(data: DatabaseDto): LeagueSettingsRow | undefined {
  return table<LeagueSettingsRow>(data, 'LeagueSettings')[0];
}

export function policyFromSettingsRow(
  row: LeagueSettingsRow | null | undefined,
): StatCreditPolicy {
  if (!row) return LEGACY_POLICY;
  return normalizeStatCreditPolicy({
    version: 1,
    teamThrowKillCreditMode: row.TeamThrowKillCreditMode,
    teamThrowFirstHitPercent: row.TeamThrowFirstHitPercent,
    teamThrowAssistMode: row.TeamThrowAssistMode,
    dedupeSameTargetEliminations: row.DedupeSameTargetEliminations,
    deflectionKillWeight: row.DeflectionKillWeight,
    deflectionCatchDeathWeight: row.DeflectionCatchDeathWeight,
    countDeflectionCatchesSeparately: row.CountDeflectionCatchesSeparately,
    trackMultiKills: row.TrackMultiKills,
    trackMultiCatches: row.TrackMultiCatches,
  });
}

export function settingsRowFromPolicy(id: Guid, policy: StatCreditPolicy): LeagueSettingsRow {
  const normalized = normalizeStatCreditPolicy(policy);
  return {
    Id: id,
    PolicyVersion: normalized.version,
    TeamThrowKillCreditMode: normalized.teamThrowKillCreditMode,
    TeamThrowFirstHitPercent: normalized.teamThrowFirstHitPercent,
    TeamThrowAssistMode: normalized.teamThrowAssistMode,
    DedupeSameTargetEliminations: normalized.dedupeSameTargetEliminations,
    DeflectionKillWeight: normalized.deflectionKillWeight,
    DeflectionCatchDeathWeight: normalized.deflectionCatchDeathWeight,
    CountDeflectionCatchesSeparately: normalized.countDeflectionCatchesSeparately,
    TrackMultiKills: normalized.trackMultiKills,
    TrackMultiCatches: normalized.trackMultiCatches,
  };
}

export function resolveLeagueStatPolicy(data: DatabaseDto): StatCreditPolicy {
  return policyFromSettingsRow(getLeagueSettingsRow(data));
}

export function setLeagueSettings(
  data: DatabaseDto,
  policy: StatCreditPolicy,
): LeagueSettingsRow {
  const existing = getLeagueSettingsRow(data);
  const row = settingsRowFromPolicy(existing?.Id ?? newIdTimestamp(), policy);
  data.Tables.LeagueSettings = [row];
  return row;
}
