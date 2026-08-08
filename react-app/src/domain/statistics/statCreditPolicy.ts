export const STAT_CREDIT_POLICY_VERSION = 1;

export const TEAM_THROW_KILL_CREDIT_MODES = [
  'legacyPerThrow',
  'splitEqual',
  'fullEach',
  'firstWeighted',
  'primaryOnly',
] as const;

export type TeamThrowKillCreditMode = (typeof TEAM_THROW_KILL_CREDIT_MODES)[number];

export const TEAM_THROW_ASSIST_MODES = ['none', 'nonKillThrowers'] as const;

export type TeamThrowAssistMode = (typeof TEAM_THROW_ASSIST_MODES)[number];

export type StatCreditPolicy = {
  version: typeof STAT_CREDIT_POLICY_VERSION;
  teamThrowKillCreditMode: TeamThrowKillCreditMode;
  /** 0–100; used by firstWeighted. A solo hitter always gets 1.0. */
  teamThrowFirstHitPercent: number;
  teamThrowAssistMode: TeamThrowAssistMode;
  dedupeSameTargetEliminations: boolean;
  deflectionKillWeight: number;
  deflectionCatchDeathWeight: number;
  countDeflectionCatchesSeparately: boolean;
  trackMultiKills: boolean;
  trackMultiCatches: boolean;
};

export type StatCreditPresetId = 'legacy' | 'sharedCredit' | 'fullEach' | 'firstHitter';

export const LEGACY_POLICY: StatCreditPolicy = {
  version: STAT_CREDIT_POLICY_VERSION,
  teamThrowKillCreditMode: 'legacyPerThrow',
  teamThrowFirstHitPercent: 60,
  teamThrowAssistMode: 'none',
  dedupeSameTargetEliminations: false,
  deflectionKillWeight: 1,
  deflectionCatchDeathWeight: 1,
  countDeflectionCatchesSeparately: false,
  trackMultiKills: false,
  trackMultiCatches: false,
};

export const STAT_CREDIT_PRESETS: Record<StatCreditPresetId, StatCreditPolicy> = {
  legacy: LEGACY_POLICY,
  sharedCredit: {
    version: STAT_CREDIT_POLICY_VERSION,
    teamThrowKillCreditMode: 'splitEqual',
    teamThrowFirstHitPercent: 60,
    teamThrowAssistMode: 'nonKillThrowers',
    dedupeSameTargetEliminations: true,
    deflectionKillWeight: 0.5,
    deflectionCatchDeathWeight: 0.5,
    countDeflectionCatchesSeparately: true,
    trackMultiKills: true,
    trackMultiCatches: true,
  },
  fullEach: {
    version: STAT_CREDIT_POLICY_VERSION,
    teamThrowKillCreditMode: 'fullEach',
    teamThrowFirstHitPercent: 60,
    teamThrowAssistMode: 'nonKillThrowers',
    dedupeSameTargetEliminations: true,
    deflectionKillWeight: 1,
    deflectionCatchDeathWeight: 1,
    countDeflectionCatchesSeparately: false,
    trackMultiKills: true,
    trackMultiCatches: true,
  },
  firstHitter: {
    version: STAT_CREDIT_POLICY_VERSION,
    teamThrowKillCreditMode: 'firstWeighted',
    teamThrowFirstHitPercent: 60,
    teamThrowAssistMode: 'nonKillThrowers',
    dedupeSameTargetEliminations: true,
    deflectionKillWeight: 1,
    deflectionCatchDeathWeight: 1,
    countDeflectionCatchesSeparately: false,
    trackMultiKills: true,
    trackMultiCatches: true,
  },
};

export const STAT_CREDIT_PRESET_OPTIONS: {
  id: StatCreditPresetId;
  label: string;
  description: string;
}[] = [
  {
    id: 'legacy',
    label: 'Legacy',
    description:
      'Today’s engine: each hitting throw counts a full kill, deaths can double-count the same target, and team-throw credit is 1/N including non-hitters.',
  },
  {
    id: 'sharedCredit',
    label: 'Shared credit',
    description:
      'One death per unique target. Hitters split kill credit equally. Non-hitting teammates get an assist. Deflection kills and deflection-catch deaths count at half weight.',
  },
  {
    id: 'fullEach',
    label: 'Full credit each',
    description:
      'One death per unique target. Every hitter gets full kill credit. Non-hitting teammates get an assist.',
  },
  {
    id: 'firstHitter',
    label: 'First-hitter',
    description:
      'One death per unique target. The first throw (lowest ordinal) gets the first-hit share; remaining hitters split the rest. Order team throws as first ball to connect first.',
  },
];

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return LEGACY_POLICY.teamThrowFirstHitPercent;
  return Math.min(100, Math.max(0, value));
}

export function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2, Math.max(0, value));
}

function isKillCreditMode(value: unknown): value is TeamThrowKillCreditMode {
  return (
    typeof value === 'string' &&
    (TEAM_THROW_KILL_CREDIT_MODES as readonly string[]).includes(value)
  );
}

function isAssistMode(value: unknown): value is TeamThrowAssistMode {
  return (
    typeof value === 'string' &&
    (TEAM_THROW_ASSIST_MODES as readonly string[]).includes(value)
  );
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Fill missing/unknown fields from legacy defaults so old files stay stable. */
export function normalizeStatCreditPolicy(
  partial: Partial<StatCreditPolicy> | null | undefined,
): StatCreditPolicy {
  const source = partial ?? {};
  return {
    version: STAT_CREDIT_POLICY_VERSION,
    teamThrowKillCreditMode: isKillCreditMode(source.teamThrowKillCreditMode)
      ? source.teamThrowKillCreditMode
      : LEGACY_POLICY.teamThrowKillCreditMode,
    teamThrowFirstHitPercent: clampPercent(
      readNumber(source.teamThrowFirstHitPercent, LEGACY_POLICY.teamThrowFirstHitPercent),
    ),
    teamThrowAssistMode: isAssistMode(source.teamThrowAssistMode)
      ? source.teamThrowAssistMode
      : LEGACY_POLICY.teamThrowAssistMode,
    dedupeSameTargetEliminations: readBoolean(
      source.dedupeSameTargetEliminations,
      LEGACY_POLICY.dedupeSameTargetEliminations,
    ),
    deflectionKillWeight: clampWeight(
      readNumber(source.deflectionKillWeight, LEGACY_POLICY.deflectionKillWeight),
    ),
    deflectionCatchDeathWeight: clampWeight(
      readNumber(source.deflectionCatchDeathWeight, LEGACY_POLICY.deflectionCatchDeathWeight),
    ),
    countDeflectionCatchesSeparately: readBoolean(
      source.countDeflectionCatchesSeparately,
      LEGACY_POLICY.countDeflectionCatchesSeparately,
    ),
    trackMultiKills: readBoolean(source.trackMultiKills, LEGACY_POLICY.trackMultiKills),
    trackMultiCatches: readBoolean(source.trackMultiCatches, LEGACY_POLICY.trackMultiCatches),
  };
}

export function matchingStatCreditPreset(
  policy: StatCreditPolicy,
): StatCreditPresetId | 'custom' {
  const normalized = normalizeStatCreditPolicy(policy);
  for (const [id, preset] of Object.entries(STAT_CREDIT_PRESETS) as [
    StatCreditPresetId,
    StatCreditPolicy,
  ][]) {
    if (policiesEqual(normalized, preset)) return id;
  }
  return 'custom';
}

export function policiesEqual(left: StatCreditPolicy, right: StatCreditPolicy): boolean {
  return (
    left.teamThrowKillCreditMode === right.teamThrowKillCreditMode &&
    left.teamThrowFirstHitPercent === right.teamThrowFirstHitPercent &&
    left.teamThrowAssistMode === right.teamThrowAssistMode &&
    left.dedupeSameTargetEliminations === right.dedupeSameTargetEliminations &&
    left.deflectionKillWeight === right.deflectionKillWeight &&
    left.deflectionCatchDeathWeight === right.deflectionCatchDeathWeight &&
    left.countDeflectionCatchesSeparately === right.countDeflectionCatchesSeparately &&
    left.trackMultiKills === right.trackMultiKills &&
    left.trackMultiCatches === right.trackMultiCatches
  );
}
