import { MAX_THROW_TAG, MAX_THROW_TAGS } from './limits';
import { DeflectionResult, ThrowResult } from './statistics/constants';
import { isDisarmDeflectionResult, isDisarmThrowResult } from './throwResults';

/** Controlled throw-annotation vocabulary (skill / paper-trail; not ResultIds). */
export const ThrowTag = {
  CounterRush: 'CounterRush',
  CounterPreThrow: 'CounterPreThrow',
  CounterWave: 'CounterWave',
  CounterRegular: 'CounterRegular',
  InvalidGrounded: 'InvalidGrounded',
  InvalidHigh: 'InvalidHigh',
  InvalidCounter: 'InvalidCounter',
  Headshot: 'Headshot',
  FailedDodge: 'FailedDodge',
  FailedBlock: 'FailedBlock',
  FailedCatch: 'FailedCatch',
} as const;

export type ThrowTagId = (typeof ThrowTag)[keyof typeof ThrowTag];

export type ThrowTagGroup = 'counter' | 'invalid' | 'contact' | 'defensiveFailure';

const ALL_THROW_TAGS = new Set<string>(Object.values(ThrowTag));

const COUNTER_TAGS = new Set<string>([
  ThrowTag.CounterRush,
  ThrowTag.CounterPreThrow,
  ThrowTag.CounterWave,
  ThrowTag.CounterRegular,
]);

const INVALID_TAGS = new Set<string>([
  ThrowTag.InvalidGrounded,
  ThrowTag.InvalidHigh,
  ThrowTag.InvalidCounter,
]);

const CONTACT_TAGS = new Set<string>([ThrowTag.Headshot]);

const DEFENSIVE_FAILURE_TAGS = new Set<string>([
  ThrowTag.FailedDodge,
  ThrowTag.FailedBlock,
  ThrowTag.FailedCatch,
]);

export const throwTagLabels: Record<ThrowTagId, string> = {
  [ThrowTag.CounterRush]: 'Rush counter',
  [ThrowTag.CounterPreThrow]: 'Pre-throw counter',
  [ThrowTag.CounterWave]: 'Wave counter',
  [ThrowTag.CounterRegular]: 'Regular counter',
  [ThrowTag.InvalidGrounded]: 'Grounded',
  [ThrowTag.InvalidHigh]: 'High throw',
  [ThrowTag.InvalidCounter]: 'Invalid counter',
  [ThrowTag.Headshot]: 'Headshot',
  [ThrowTag.FailedDodge]: 'Failed dodge',
  [ThrowTag.FailedBlock]: 'Failed block',
  [ThrowTag.FailedCatch]: 'Failed catch',
};

export const throwTagGroups: {
  id: ThrowTagGroup;
  label: string;
  tags: readonly ThrowTagId[];
  exclusive: boolean;
}[] = [
  {
    id: 'counter',
    label: 'Counter',
    tags: [
      ThrowTag.CounterRush,
      ThrowTag.CounterPreThrow,
      ThrowTag.CounterWave,
      ThrowTag.CounterRegular,
    ],
    exclusive: true,
  },
  {
    id: 'invalid',
    label: 'Invalid',
    tags: [ThrowTag.InvalidGrounded, ThrowTag.InvalidHigh, ThrowTag.InvalidCounter],
    exclusive: false,
  },
  {
    id: 'contact',
    label: 'Contact',
    tags: [ThrowTag.Headshot],
    exclusive: false,
  },
  {
    id: 'defensiveFailure',
    label: 'How out',
    tags: [ThrowTag.FailedDodge, ThrowTag.FailedBlock, ThrowTag.FailedCatch],
    exclusive: true,
  },
];

export function throwTagGroupOf(tag: string): ThrowTagGroup | null {
  if (COUNTER_TAGS.has(tag)) return 'counter';
  if (INVALID_TAGS.has(tag)) return 'invalid';
  if (CONTACT_TAGS.has(tag)) return 'contact';
  if (DEFENSIVE_FAILURE_TAGS.has(tag)) return 'defensiveFailure';
  return null;
}

export function isKnownThrowTag(value: string): value is ThrowTagId {
  return ALL_THROW_TAGS.has(value);
}

function resultAllowsKillAnnotations(
  resultId: ThrowResult | DeflectionResult | null | undefined,
): boolean {
  if (resultId == null) return false;
  if (resultId === ThrowResult.Hit || resultId === DeflectionResult.Hit) return true;
  if (isDisarmThrowResult(resultId as ThrowResult)) return true;
  if (isDisarmDeflectionResult(resultId as DeflectionResult)) return true;
  // Legacy failed block/catch are Hit subtypes on old saves.
  if (
    resultId === ThrowResult.BlockFailed ||
    resultId === ThrowResult.CatchFailed ||
    resultId === DeflectionResult.BlockFailed ||
    resultId === DeflectionResult.CatchFailed
  ) {
    return true;
  }
  return false;
}

/**
 * Trim unknown values, keep only vocabulary ids, enforce group rules, cap count.
 * Contact / defensive-failure tags require Hit or Disarm (or legacy failed).
 */
export function normalizeThrowTags(
  raw: unknown,
  resultId?: ThrowResult | DeflectionResult | null,
): ThrowTagId[] {
  if (!Array.isArray(raw)) return [];
  const allowKill = resultAllowsKillAnnotations(resultId);
  const seen = new Set<string>();
  let counter: ThrowTagId | null = null;
  let defensiveFailure: ThrowTagId | null = null;
  const out: ThrowTagId[] = [];

  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim().slice(0, MAX_THROW_TAG);
    if (!isKnownThrowTag(trimmed)) continue;
    if (seen.has(trimmed)) continue;

    const group = throwTagGroupOf(trimmed);
    if (group === 'counter') {
      if (counter) continue;
      counter = trimmed;
    } else if (group === 'defensiveFailure') {
      if (!allowKill || defensiveFailure) continue;
      defensiveFailure = trimmed;
    } else if (group === 'contact') {
      if (!allowKill) continue;
    }

    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_THROW_TAGS) break;
  }
  return out;
}

/** Toggle a tag in a draft list, respecting exclusivity and result constraints. */
export function toggleThrowTag(
  current: readonly string[] | undefined,
  tag: ThrowTagId,
  resultId: ThrowResult | DeflectionResult | null,
): ThrowTagId[] {
  const normalized = normalizeThrowTags(current ?? [], resultId);
  const group = throwTagGroupOf(tag);
  const has = normalized.includes(tag);
  if (has) {
    return normalized.filter((row) => row !== tag);
  }
  if (group === 'contact' || group === 'defensiveFailure') {
    if (!resultAllowsKillAnnotations(resultId)) return normalized;
  }
  let next = [...normalized];
  if (group === 'counter' || group === 'defensiveFailure') {
    next = next.filter((row) => throwTagGroupOf(row) !== group);
  }
  next.push(tag);
  return normalizeThrowTags(next, resultId);
}

export function throwTagsForPersist(
  tags: readonly string[] | undefined,
  resultId: ThrowResult | DeflectionResult | null,
): ThrowTagId[] | undefined {
  const normalized = normalizeThrowTags(tags ?? [], resultId);
  return normalized.length > 0 ? normalized : undefined;
}
