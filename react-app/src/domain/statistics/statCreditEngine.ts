import type { Guid } from '../types';
import { DeflectionResult, EDeathType, EKillType, ThrowResult } from './constants';
import type { ThrowDetail } from './databaseViews';
import type { StatCreditPolicy } from './statCreditPolicy';

export type KillSource = 'direct' | 'deflection';

export type ThrowerKillAward = {
  throwerId: Guid;
  source: KillSource;
  killType: EKillType;
  integer: number;
  credit: number;
};

export type SupportCreditAward = {
  throwerId: Guid;
  killType: EKillType;
  credit: number;
};

export type TargetDeathAward = {
  targetId: Guid;
  source: KillSource;
  deathType: EDeathType;
  integer: number;
  credit: number;
};

export type CatchThrownDeathAward = {
  throwerId: Guid;
  source: KillSource;
  integer: number;
  credit: number;
};

export type CatchAward = {
  catcherId: Guid;
  source: KillSource;
};

export type MultiSize = 2 | 3 | 4;

export type EventCreditAwards = {
  throwerKills: ThrowerKillAward[];
  supportCredits: SupportCreditAward[];
  targetDeaths: TargetDeathAward[];
  catchThrownDeaths: CatchThrownDeathAward[];
  assists: Guid[];
  multiKills: { throwerId: Guid; size: MultiSize }[];
  catches: CatchAward[];
  multiCatches: { catcherId: Guid; size: MultiSize }[];
};

type KillResult = {
  throwerId: Guid;
  targetId: Guid;
  source: KillSource;
  ordinal: number;
  killType: EKillType;
  deathType: EDeathType;
};

export function isCatch(
  throwDetail: ThrowDetail,
): { caught: true; deflection: boolean } | { caught: false } {
  if (throwDetail.throwRow.ResultId === ThrowResult.Catch) {
    return { caught: true, deflection: false };
  }
  if (
    throwDetail.deflections.some(
      (deflection) => deflection.ResultId === DeflectionResult.Catch,
    )
  ) {
    return { caught: true, deflection: true };
  }
  return { caught: false };
}

export function tryGetKillFromThrow(
  result: number,
): { killType: EKillType; deathType: EDeathType } | undefined {
  switch (result) {
    case ThrowResult.Hit:
      return { killType: EKillType.Hit, deathType: EDeathType.Hit };
    case ThrowResult.BlockFailed:
      return { killType: EKillType.BlockFailed, deathType: EDeathType.BlockFailed };
    case ThrowResult.CatchFailed:
      return { killType: EKillType.CatchFailed, deathType: EDeathType.CatchFailed };
    default:
      return undefined;
  }
}

export function tryGetKillFromDeflection(
  result: number,
): { killType: EKillType; deathType: EDeathType } | undefined {
  switch (result) {
    case DeflectionResult.Hit:
      return { killType: EKillType.Hit, deathType: EDeathType.Hit };
    case DeflectionResult.BlockFailed:
      return { killType: EKillType.BlockFailed, deathType: EDeathType.BlockFailed };
    case DeflectionResult.CatchFailed:
      return { killType: EKillType.CatchFailed, deathType: EDeathType.CatchFailed };
    default:
      return undefined;
  }
}

export function uniqueThrowerIds(details: ThrowDetail[]): Guid[] {
  const ids: Guid[] = [];
  for (const detail of details) {
    const id = detail.throwRow.ThrowerId;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function emptyAwards(): EventCreditAwards {
  return {
    throwerKills: [],
    supportCredits: [],
    targetDeaths: [],
    catchThrownDeaths: [],
    assists: [],
    multiKills: [],
    catches: [],
    multiCatches: [],
  };
}

function multiSize(count: number): MultiSize | undefined {
  if (count >= 4) return 4;
  if (count === 3) return 3;
  if (count === 2) return 2;
  return undefined;
}

function collectCatches(details: ThrowDetail[]): CatchAward[] {
  const catches: CatchAward[] = [];
  for (const detail of details) {
    if (detail.throwRow.ResultId === ThrowResult.Catch) {
      catches.push({ catcherId: detail.throwRow.TargetId, source: 'direct' });
    }
    for (const deflection of detail.deflections) {
      if (deflection.ResultId !== DeflectionResult.Catch) continue;
      catches.push({ catcherId: deflection.ReceiverId, source: 'deflection' });
    }
  }
  return catches;
}

function collectCatchThrown(
  details: ThrowDetail[],
  policy: StatCreditPolicy,
): CatchThrownDeathAward[] {
  const deaths: CatchThrownDeathAward[] = [];
  for (const detail of details) {
    const catchResult = isCatch(detail);
    if (!catchResult.caught) continue;
    deaths.push({
      throwerId: detail.throwRow.ThrowerId,
      source: catchResult.deflection ? 'deflection' : 'direct',
      integer: 1,
      credit: catchResult.deflection ? policy.deflectionCatchDeathWeight : 1,
    });
  }
  return deaths;
}

function collectKillResults(details: ThrowDetail[]): KillResult[] {
  const results: KillResult[] = [];
  for (const detail of details) {
    if (isCatch(detail).caught) continue;
    const ordinal = detail.throwRow.Ordinal;
    const throwKill = tryGetKillFromThrow(detail.throwRow.ResultId);
    if (throwKill) {
      results.push({
        throwerId: detail.throwRow.ThrowerId,
        targetId: detail.throwRow.TargetId,
        source: 'direct',
        ordinal,
        killType: throwKill.killType,
        deathType: throwKill.deathType,
      });
    }
    for (const deflection of detail.deflections) {
      const deflKill = tryGetKillFromDeflection(deflection.ResultId);
      if (!deflKill) continue;
      results.push({
        throwerId: detail.throwRow.ThrowerId,
        targetId: deflection.ReceiverId,
        source: 'deflection',
        ordinal,
        killType: deflKill.killType,
        deathType: deflKill.deathType,
      });
    }
  }
  return results;
}

function creditWeight(result: KillResult, policy: StatCreditPolicy): number {
  return result.source === 'deflection' ? policy.deflectionKillWeight : 1;
}

type HitterShare = {
  throwerId: Guid;
  ordinal: number;
  source: KillSource;
  killType: EKillType;
  deathType: EDeathType;
  credit: number;
};

function hitterSharesForTarget(
  results: KillResult[],
  policy: StatCreditPolicy,
): HitterShare[] {
  const byThrower = new Map<Guid, KillResult[]>();
  for (const result of results) {
    const list = byThrower.get(result.throwerId) ?? [];
    list.push(result);
    byThrower.set(result.throwerId, list);
  }

  const hitters = [...byThrower.entries()]
    .map(([throwerId, list]) => {
      const sorted = [...list].sort((a, b) => a.ordinal - b.ordinal || (a.source === 'direct' ? -1 : 1));
      const primary = sorted[0];
      return {
        throwerId,
        ordinal: Math.min(...list.map((row) => row.ordinal)),
        source: list.some((row) => row.source === 'direct') ? ('direct' as const) : primary.source,
        killType: primary.killType,
        deathType: primary.deathType,
        weight: creditWeight(
          list.some((row) => row.source === 'direct')
            ? list.find((row) => row.source === 'direct')!
            : primary,
          policy,
        ),
      };
    })
    .sort((a, b) => a.ordinal - b.ordinal || a.throwerId.localeCompare(b.throwerId));

  const n = hitters.length;
  if (n === 0) return [];

  const baseCredits = ((): number[] => {
    switch (policy.teamThrowKillCreditMode) {
      case 'fullEach':
        return hitters.map(() => 1);
      case 'primaryOnly':
        return hitters.map((_, index) => (index === 0 ? 1 : 0));
      case 'firstWeighted': {
        if (n === 1) return [1];
        const first = policy.teamThrowFirstHitPercent / 100;
        const rest = (1 - first) / (n - 1);
        return hitters.map((_, index) => (index === 0 ? first : rest));
      }
      case 'splitEqual':
      case 'legacyPerThrow':
      default:
        return hitters.map(() => 1 / n);
    }
  })();

  return hitters.map((hitter, index) => ({
    throwerId: hitter.throwerId,
    ordinal: hitter.ordinal,
    source: hitter.source,
    killType: hitter.killType,
    deathType: hitter.deathType,
    credit: baseCredits[index] * hitter.weight,
  }));
}

function awardNonLegacyKills(
  awards: EventCreditAwards,
  details: ThrowDetail[],
  policy: StatCreditPolicy,
): void {
  const killResults = collectKillResults(details);
  if (!policy.dedupeSameTargetEliminations) {
    for (const result of killResults) {
      awards.throwerKills.push({
        throwerId: result.throwerId,
        source: result.source,
        killType: result.killType,
        integer: 1,
        credit: creditWeight(result, policy),
      });
      awards.targetDeaths.push({
        targetId: result.targetId,
        source: result.source,
        deathType: result.deathType,
        integer: 1,
        credit: 1,
      });
    }
    return;
  }

  const byTarget = new Map<Guid, KillResult[]>();
  for (const result of killResults) {
    const list = byTarget.get(result.targetId) ?? [];
    list.push(result);
    byTarget.set(result.targetId, list);
  }

  for (const group of byTarget.values()) {
    const shares = hitterSharesForTarget(group, policy);
    const deathSource = group.some((row) => row.source === 'direct') ? 'direct' : 'deflection';
    const deathType =
      shares[0]?.deathType ??
      group.find((row) => row.source === 'direct')?.deathType ??
      group[0].deathType;
    awards.targetDeaths.push({
      targetId: group[0].targetId,
      source: deathSource,
      deathType,
      integer: 1,
      credit: 1,
    });
    for (const share of shares) {
      awards.throwerKills.push({
        throwerId: share.throwerId,
        source: share.source,
        killType: share.killType,
        integer: 1,
        credit: share.credit,
      });
    }
  }
}

function awardLegacyKills(
  awards: EventCreditAwards,
  details: ThrowDetail[],
  policy: StatCreditPolicy,
): void {
  const throwers = uniqueThrowerIds(details);
  const killCredit = throwers.length > 0 ? 1 / throwers.length : 1;

  for (const detail of details) {
    if (isCatch(detail).caught) continue;

    const throwKill = tryGetKillFromThrow(detail.throwRow.ResultId);
    if (throwKill) {
      awards.throwerKills.push({
        throwerId: detail.throwRow.ThrowerId,
        source: 'direct',
        killType: throwKill.killType,
        integer: 1,
        credit: killCredit,
      });
      awards.targetDeaths.push({
        targetId: detail.throwRow.TargetId,
        source: 'direct',
        deathType: throwKill.deathType,
        integer: 1,
        credit: 1,
      });
      for (const other of throwers) {
        if (other === detail.throwRow.ThrowerId) continue;
        awards.supportCredits.push({
          throwerId: other,
          killType: throwKill.killType,
          credit: killCredit,
        });
      }
    }

    for (const deflection of detail.deflections) {
      const deflKill = tryGetKillFromDeflection(deflection.ResultId);
      if (!deflKill) continue;
      awards.throwerKills.push({
        throwerId: detail.throwRow.ThrowerId,
        source: 'deflection',
        killType: deflKill.killType,
        integer: 1,
        credit: killCredit * policy.deflectionKillWeight,
      });
      awards.targetDeaths.push({
        targetId: deflection.ReceiverId,
        source: 'deflection',
        deathType: deflKill.deathType,
        integer: 1,
        credit: 1,
      });
      for (const other of throwers) {
        if (other === detail.throwRow.ThrowerId) continue;
        awards.supportCredits.push({
          throwerId: other,
          killType: deflKill.killType,
          credit: killCredit,
        });
      }
    }
  }
}

function awardAssists(
  awards: EventCreditAwards,
  throwerIds: Guid[],
  policy: StatCreditPolicy,
): void {
  if (policy.teamThrowAssistMode !== 'nonKillThrowers' || throwerIds.length < 2) return;
  if (awards.throwerKills.length === 0) return;
  const killers = new Set(awards.throwerKills.map((row) => row.throwerId));
  for (const throwerId of throwerIds) {
    if (!killers.has(throwerId)) awards.assists.push(throwerId);
  }
}

function awardMultiKillsFromResults(
  awards: EventCreditAwards,
  killResults: KillResult[],
  policy: StatCreditPolicy,
): void {
  if (!policy.trackMultiKills) return;
  const byThrower = new Map<Guid, Set<Guid>>();
  for (const result of killResults) {
    const set = byThrower.get(result.throwerId) ?? new Set<Guid>();
    set.add(result.targetId);
    byThrower.set(result.throwerId, set);
  }
  for (const [throwerId, targets] of byThrower) {
    const size = multiSize(targets.size);
    if (size) awards.multiKills.push({ throwerId, size });
  }
}

function awardMultiCatches(awards: EventCreditAwards, policy: StatCreditPolicy): void {
  if (!policy.trackMultiCatches) return;
  const counts = new Map<Guid, number>();
  for (const row of awards.catches) {
    counts.set(row.catcherId, (counts.get(row.catcherId) ?? 0) + 1);
  }
  for (const [catcherId, count] of counts) {
    const size = multiSize(count);
    if (size) awards.multiCatches.push({ catcherId, size });
  }
}

export function awardThrowEventCredit(
  details: ThrowDetail[],
  policy: StatCreditPolicy,
): EventCreditAwards {
  const awards = emptyAwards();
  if (details.length === 0) return awards;

  awards.catches.push(...collectCatches(details));
  awards.catchThrownDeaths.push(...collectCatchThrown(details, policy));

  if (policy.teamThrowKillCreditMode === 'legacyPerThrow') {
    awardLegacyKills(awards, details, policy);
  } else {
    awardNonLegacyKills(awards, details, policy);
  }

  awardAssists(awards, uniqueThrowerIds(details), policy);
  awardMultiKillsFromResults(awards, collectKillResults(details), policy);
  awardMultiCatches(awards, policy);

  return awards;
}
