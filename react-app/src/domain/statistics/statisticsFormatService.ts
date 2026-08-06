import type { DatabaseDto, Guid } from '../types';
import {
  DeflectionResult,
  ECompetitionOutcome,
  EDeathError,
  EDeathType,
  EKillType,
  EThrowError,
  ThrowResult,
  enumValues,
} from './constants';
import { type StatisticAggregates } from './statisticAggregates';
import {
  createStatisticsSummary,
  type PlayerStatistics,
} from './statisticsService';

function getStatisticsSummaryFormat(): {
  header: string;
  value: (stats: PlayerStatistics) => string;
}[] {
  const sections: {
    title: string;
    getAggregate: (stats: PlayerStatistics) => StatisticAggregates<number, number>;
    enumObject: Record<string, number | string>;
  }[] = [
    { title: 'Matches', getAggregate: (s) => s.matches, enumObject: ECompetitionOutcome },
    { title: 'Games', getAggregate: (s) => s.games, enumObject: ECompetitionOutcome },
    {
      title: 'Kills (Direct) (Individual)',
      getAggregate: (s) => s.killsDirectIndividual,
      enumObject: EKillType,
    },
    {
      title: 'Kills (Direct) (Group)',
      getAggregate: (s) => s.killsDirectGroup,
      enumObject: EKillType,
    },
    {
      title: 'Kills Credit (Direct)',
      getAggregate: (s) => s.killsDirectCredit,
      enumObject: EKillType,
    },
    {
      title: 'Kills (Deflection) (Individual)',
      getAggregate: (s) => s.killsDeflectionsIndividual,
      enumObject: EKillType,
    },
    {
      title: 'Kills (Deflection) (Group)',
      getAggregate: (s) => s.killsDeflectionsGroup,
      enumObject: EKillType,
    },
    {
      title: 'Kills Credit (Deflection)',
      getAggregate: (s) => s.killsDeflectionsCredit,
      enumObject: EKillType,
    },
    {
      title: 'Deaths (Direct)',
      getAggregate: (s) => s.deathsDirect,
      enumObject: EDeathType,
    },
    {
      title: 'Deaths (Deflection)',
      getAggregate: (s) => s.deathsDeflections,
      enumObject: EDeathType,
    },
    {
      title: 'Deaths (Error)',
      getAggregate: (s) => s.deathsErrors,
      enumObject: EDeathError,
    },
    {
      title: 'Throws (Direct) (Individual)',
      getAggregate: (s) => s.offenseThrowsIndividual,
      enumObject: ThrowResult,
    },
    {
      title: 'Throws (Direct) (Group)',
      getAggregate: (s) => s.offenseThrowsGroup,
      enumObject: ThrowResult,
    },
    {
      title: 'Throws (Deflection) (Individual)',
      getAggregate: (s) => s.offenseDeflectionsIndividual,
      enumObject: DeflectionResult,
    },
    {
      title: 'Throws (Deflection) (Group)',
      getAggregate: (s) => s.offenseDeflectionsGroup,
      enumObject: DeflectionResult,
    },
    {
      title: 'Throws (Error)',
      getAggregate: (s) => s.offenseErrors,
      enumObject: EThrowError,
    },
    {
      title: 'Targeted (Direct)',
      getAggregate: (s) => s.defenseTargets,
      enumObject: ThrowResult,
    },
    {
      title: 'Targeted (Deflection)',
      getAggregate: (s) => s.defenseDeflections,
      enumObject: DeflectionResult,
    },
  ];

  const format: { header: string; value: (stats: PlayerStatistics) => string }[] = [
    { header: 'Team', value: (stats) => stats.team.Name },
    { header: 'Player', value: (stats) => stats.player.Name },
  ];

  for (const section of sections) {
    const keys = enumValues(section.enumObject).sort((a, b) => a - b);
    format.push({
      header: `********** ${section.title}`,
      value: (stats) => formatTotal(section.getAggregate(stats).total),
    });
    for (const key of keys) {
      const keyName = Object.entries(section.enumObject).find(
        ([, value]) => value === key,
      )?.[0];
      format.push({
        header: keyName ?? String(key),
        value: (stats) => formatCount(section.getAggregate(stats).get(key)),
      });
    }
  }

  return format;
}

function formatTotal(value: number | undefined): string {
  return String(value ?? 0);
}

function formatCount(value: number | undefined): string {
  return String(value ?? 0);
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function getStatisticsSummaryLines(data: DatabaseDto, matchIds: Guid[]): string[][] {
  const format = getStatisticsSummaryFormat();
  const playerStatistics = createStatisticsSummary(data, matchIds);
  const lines: string[][] = [format.map((column) => column.header)];
  for (const stats of playerStatistics) {
    lines.push(format.map((column) => column.value(stats)));
  }
  return lines;
}

export function getStatisticsSummaryCsv(
  data: DatabaseDto,
  matchIds: Guid[],
): Uint8Array {
  const lines = getStatisticsSummaryLines(data, matchIds);
  const text = lines
    .map((line) => line.map(escapeCsvCell).join(','))
    .join('\n');
  return new TextEncoder().encode(text);
}

export function getStatisticsSummaryCsvText(
  data: DatabaseDto,
  matchIds: Guid[],
): string {
  const bytes = getStatisticsSummaryCsv(data, matchIds);
  return new TextDecoder().decode(bytes);
}

export function getStatisticsSummaryHeaderLine(): string {
  const format = getStatisticsSummaryFormat();
  return format.map((column) => escapeCsvCell(column.header)).join(',');
}
