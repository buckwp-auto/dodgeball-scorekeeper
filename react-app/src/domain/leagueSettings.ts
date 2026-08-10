import { newIdTimestamp } from './id';
import type { DatabaseDto, Guid } from './types';
import {
  LEGACY_POLICY,
  normalizeStatCreditPolicy,
  type StatCreditPolicy,
  type TeamThrowAssistMode,
  type TeamThrowKillCreditMode,
} from './statistics/statCreditPolicy';

export type HighlightQualifierSettings = {
  minGamesEnabled: boolean;
  minGames: number;
  minMatchesEnabled: boolean;
  minMatches: number;
  minVolumeEnabled: boolean;
  minThrows: number;
  minTargets: number;
};

export const DEFAULT_HIGHLIGHT_QUALIFIERS: HighlightQualifierSettings = {
  minGamesEnabled: true,
  minGames: 15,
  minMatchesEnabled: true,
  minMatches: 2,
  minVolumeEnabled: true,
  minThrows: 20,
  minTargets: 20,
};

/** All qualifier switches off — useful in tests and when a league opts out. */
export const DISABLED_HIGHLIGHT_QUALIFIERS: HighlightQualifierSettings = {
  minGamesEnabled: false,
  minGames: DEFAULT_HIGHLIGHT_QUALIFIERS.minGames,
  minMatchesEnabled: false,
  minMatches: DEFAULT_HIGHLIGHT_QUALIFIERS.minMatches,
  minVolumeEnabled: false,
  minThrows: DEFAULT_HIGHLIGHT_QUALIFIERS.minThrows,
  minTargets: DEFAULT_HIGHLIGHT_QUALIFIERS.minTargets,
};

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
  HighlightMinGamesEnabled?: boolean;
  HighlightMinGames?: number;
  HighlightMinMatchesEnabled?: boolean;
  HighlightMinMatches?: number;
  HighlightMinVolumeEnabled?: boolean;
  HighlightMinThrows?: number;
  HighlightMinTargets?: number;
  PlayersPerSide?: number;
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

export function normalizeHighlightQualifiers(
  input: Partial<HighlightQualifierSettings> | null | undefined,
): HighlightQualifierSettings {
  const source = input ?? {};
  return {
    minGamesEnabled: readBoolean(source.minGamesEnabled, DEFAULT_HIGHLIGHT_QUALIFIERS.minGamesEnabled),
    minGames: clampCount(source.minGames, DEFAULT_HIGHLIGHT_QUALIFIERS.minGames, 999),
    minMatchesEnabled: readBoolean(
      source.minMatchesEnabled,
      DEFAULT_HIGHLIGHT_QUALIFIERS.minMatchesEnabled,
    ),
    minMatches: clampCount(source.minMatches, DEFAULT_HIGHLIGHT_QUALIFIERS.minMatches, 999),
    minVolumeEnabled: readBoolean(
      source.minVolumeEnabled,
      DEFAULT_HIGHLIGHT_QUALIFIERS.minVolumeEnabled,
    ),
    minThrows: clampCount(source.minThrows, DEFAULT_HIGHLIGHT_QUALIFIERS.minThrows, 9999),
    minTargets: clampCount(source.minTargets, DEFAULT_HIGHLIGHT_QUALIFIERS.minTargets, 9999),
  };
}

export function qualifiersFromSettingsRow(
  row: LeagueSettingsRow | null | undefined,
): HighlightQualifierSettings {
  if (!row || !rowHasHighlightQualifiers(row)) return { ...DEFAULT_HIGHLIGHT_QUALIFIERS };
  return normalizeHighlightQualifiers({
    minGamesEnabled: row.HighlightMinGamesEnabled,
    minGames: row.HighlightMinGames,
    minMatchesEnabled: row.HighlightMinMatchesEnabled,
    minMatches: row.HighlightMinMatches,
    minVolumeEnabled: row.HighlightMinVolumeEnabled,
    minThrows: row.HighlightMinThrows,
    minTargets: row.HighlightMinTargets,
  });
}

export function settingsRowFromQualifiers(
  qualifiers: HighlightQualifierSettings,
): Pick<
  LeagueSettingsRow,
  | 'HighlightMinGamesEnabled'
  | 'HighlightMinGames'
  | 'HighlightMinMatchesEnabled'
  | 'HighlightMinMatches'
  | 'HighlightMinVolumeEnabled'
  | 'HighlightMinThrows'
  | 'HighlightMinTargets'
> {
  const normalized = normalizeHighlightQualifiers(qualifiers);
  return {
    HighlightMinGamesEnabled: normalized.minGamesEnabled,
    HighlightMinGames: normalized.minGames,
    HighlightMinMatchesEnabled: normalized.minMatchesEnabled,
    HighlightMinMatches: normalized.minMatches,
    HighlightMinVolumeEnabled: normalized.minVolumeEnabled,
    HighlightMinThrows: normalized.minThrows,
    HighlightMinTargets: normalized.minTargets,
  };
}

export function resolveLeagueStatPolicy(data: DatabaseDto): StatCreditPolicy {
  return policyFromSettingsRow(getLeagueSettingsRow(data));
}

export function resolveHighlightQualifiers(data: DatabaseDto): HighlightQualifierSettings {
  return qualifiersFromSettingsRow(getLeagueSettingsRow(data));
}

export const DEFAULT_PLAYERS_PER_SIDE = 6;
export const MIN_PLAYERS_PER_SIDE = 1;
export const MAX_PLAYERS_PER_SIDE = 12;

export function normalizePlayersPerSide(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_PLAYERS_PER_SIDE;
  return Math.min(
    MAX_PLAYERS_PER_SIDE,
    Math.max(MIN_PLAYERS_PER_SIDE, Math.round(value)),
  );
}

export function resolvePlayersPerSide(data: DatabaseDto): number {
  return normalizePlayersPerSide(getLeagueSettingsRow(data)?.PlayersPerSide);
}

export function setLeagueSettings(
  data: DatabaseDto,
  policy: StatCreditPolicy,
  qualifiers?: HighlightQualifierSettings,
  playersPerSide?: number,
): LeagueSettingsRow {
  const existing = getLeagueSettingsRow(data);
  const resolvedQualifiers = qualifiers
    ? normalizeHighlightQualifiers(qualifiers)
    : qualifiersFromSettingsRow(existing);
  const resolvedPlayersPerSide =
    playersPerSide != null
      ? normalizePlayersPerSide(playersPerSide)
      : resolvePlayersPerSideFromRow(existing);
  const row: LeagueSettingsRow = {
    ...settingsRowFromPolicy(existing?.Id ?? newIdTimestamp(), policy),
    ...settingsRowFromQualifiers(resolvedQualifiers),
    PlayersPerSide: resolvedPlayersPerSide,
  };
  data.Tables.LeagueSettings = [row];
  return row;
}

function resolvePlayersPerSideFromRow(
  row: LeagueSettingsRow | null | undefined,
): number {
  return normalizePlayersPerSide(row?.PlayersPerSide);
}

function rowHasHighlightQualifiers(row: LeagueSettingsRow): boolean {
  return (
    row.HighlightMinGamesEnabled != null ||
    row.HighlightMinGames != null ||
    row.HighlightMinMatchesEnabled != null ||
    row.HighlightMinMatches != null ||
    row.HighlightMinVolumeEnabled != null ||
    row.HighlightMinThrows != null ||
    row.HighlightMinTargets != null
  );
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampCount(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.round(value)));
}
