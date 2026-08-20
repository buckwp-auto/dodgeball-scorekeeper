import {
  DeflectionResult,
  ECompetitionOutcome,
  EDeathError,
  EDeathType,
  EKillType,
  EThrowError,
  ThrowResult,
} from './constants';
import type { StatisticAggregates } from './statisticAggregates';
import type { PlayerStatistics } from './statisticsService';

/** Legacy CSV columns — frozen; Disarm is folded into Hit, failed columns emit 0. */
export const LEGACY_KILL_TYPE_COLUMNS = [
  EKillType.Hit,
  EKillType.BlockFailed,
  EKillType.CatchFailed,
] as const;

export const LEGACY_DEATH_TYPE_COLUMNS = [
  EDeathType.Hit,
  EDeathType.BlockFailed,
  EDeathType.CatchFailed,
  EDeathType.CatchThrown,
] as const;

export const LEGACY_THROW_RESULT_COLUMNS = [
  ThrowResult.Hit,
  ThrowResult.Block,
  ThrowResult.BlockFailed,
  ThrowResult.Catch,
  ThrowResult.CatchFailed,
  ThrowResult.Dodge,
  ThrowResult.Miss,
] as const;

export const LEGACY_DEFLECTION_RESULT_COLUMNS = [
  DeflectionResult.Hit,
  DeflectionResult.Block,
  DeflectionResult.BlockFailed,
  DeflectionResult.Catch,
  DeflectionResult.CatchFailed,
] as const;

function enumKey(
  enumObject: Record<string, number | string>,
  key: number,
): string {
  return Object.entries(enumObject).find(([, value]) => value === key)?.[0] ?? String(key);
}

function legacyHitKillValue(
  aggregate: StatisticAggregates<number, number>,
  key: number,
): number {
  if (key === EKillType.BlockFailed || key === EKillType.CatchFailed) return 0;
  if (key === EKillType.Hit) {
    return (
      (aggregate.get(EKillType.Hit) ?? 0) +
      (aggregate.get(EKillType.BlockFailed) ?? 0) +
      (aggregate.get(EKillType.CatchFailed) ?? 0)
    );
  }
  return aggregate.get(key) ?? 0;
}

function legacyHitDeathValue(
  aggregate: StatisticAggregates<number, number>,
  key: number,
): number {
  if (key === EDeathType.BlockFailed || key === EDeathType.CatchFailed) return 0;
  if (key === EDeathType.Hit) {
    return (
      (aggregate.get(EDeathType.Hit) ?? 0) +
      (aggregate.get(EDeathType.BlockFailed) ?? 0) +
      (aggregate.get(EDeathType.CatchFailed) ?? 0)
    );
  }
  return aggregate.get(key) ?? 0;
}

function legacyHitThrowValue(
  aggregate: StatisticAggregates<number, number>,
  key: number,
): number {
  if (key === ThrowResult.BlockFailed || key === ThrowResult.CatchFailed) return 0;
  if (key === ThrowResult.Hit) {
    return (
      (aggregate.get(ThrowResult.Hit) ?? 0) +
      (aggregate.get(ThrowResult.Disarm) ?? 0) +
      (aggregate.get(ThrowResult.BlockFailed) ?? 0) +
      (aggregate.get(ThrowResult.CatchFailed) ?? 0)
    );
  }
  return aggregate.get(key) ?? 0;
}

function legacyHitDeflectionValue(
  aggregate: StatisticAggregates<number, number>,
  key: number,
): number {
  if (key === DeflectionResult.BlockFailed || key === DeflectionResult.CatchFailed) {
    return 0;
  }
  if (key === DeflectionResult.Hit) {
    return (
      (aggregate.get(DeflectionResult.Hit) ?? 0) +
      (aggregate.get(DeflectionResult.Disarm) ?? 0) +
      (aggregate.get(DeflectionResult.BlockFailed) ?? 0) +
      (aggregate.get(DeflectionResult.CatchFailed) ?? 0)
    );
  }
  return aggregate.get(key) ?? 0;
}

export function legacyCsvColumnValue(
  sectionTitle: string,
  key: number,
  stats: PlayerStatistics,
): number {
  const sections: {
    title: string;
    getAggregate: (stats: PlayerStatistics) => StatisticAggregates<number, number>;
    value: (aggregate: StatisticAggregates<number, number>, key: number) => number;
  }[] = [
    {
      title: 'Kills (Direct) (Individual)',
      getAggregate: (s) => s.killsDirectIndividual,
      value: legacyHitKillValue,
    },
    {
      title: 'Kills (Direct) (Group)',
      getAggregate: (s) => s.killsDirectGroup,
      value: legacyHitKillValue,
    },
    {
      title: 'Kills Credit (Direct)',
      getAggregate: (s) => s.killsDirectCredit,
      value: legacyHitKillValue,
    },
    {
      title: 'Kills (Deflection) (Individual)',
      getAggregate: (s) => s.killsDeflectionsIndividual,
      value: legacyHitKillValue,
    },
    {
      title: 'Kills (Deflection) (Group)',
      getAggregate: (s) => s.killsDeflectionsGroup,
      value: legacyHitKillValue,
    },
    {
      title: 'Kills Credit (Deflection)',
      getAggregate: (s) => s.killsDeflectionsCredit,
      value: legacyHitKillValue,
    },
    {
      title: 'Deaths (Direct)',
      getAggregate: (s) => s.deathsDirect,
      value: legacyHitDeathValue,
    },
    {
      title: 'Deaths (Deflection)',
      getAggregate: (s) => s.deathsDeflections,
      value: legacyHitDeathValue,
    },
    {
      title: 'Throws (Direct) (Individual)',
      getAggregate: (s) => s.offenseThrowsIndividual,
      value: legacyHitThrowValue,
    },
    {
      title: 'Throws (Direct) (Group)',
      getAggregate: (s) => s.offenseThrowsGroup,
      value: legacyHitThrowValue,
    },
    {
      title: 'Throws (Deflection) (Individual)',
      getAggregate: (s) => s.offenseDeflectionsIndividual,
      value: legacyHitDeflectionValue,
    },
    {
      title: 'Throws (Deflection) (Group)',
      getAggregate: (s) => s.offenseDeflectionsGroup,
      value: legacyHitDeflectionValue,
    },
    {
      title: 'Targeted (Direct)',
      getAggregate: (s) => s.defenseTargets,
      value: legacyHitThrowValue,
    },
    {
      title: 'Targeted (Deflection)',
      getAggregate: (s) => s.defenseDeflections,
      value: legacyHitDeflectionValue,
    },
  ];

  const section = sections.find((row) => row.title === sectionTitle);
  if (!section) return 0;
  return section.value(section.getAggregate(stats), key);
}

export { enumKey, ECompetitionOutcome, EDeathError, EThrowError };
