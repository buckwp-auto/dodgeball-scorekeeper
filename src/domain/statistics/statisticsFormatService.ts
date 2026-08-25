import type { DatabaseDto, Guid } from '../types';
import {
  ECompetitionOutcome,
  EDeathError,
  EThrowError,
  enumValues,
} from './constants';
import { type StatisticAggregates } from './statisticAggregates';
import {
  createStatisticsSummary,
  type PlayerStatistics,
} from './statisticsService';
import {
  enumKey,
  legacyCsvColumnValue,
  LEGACY_DEATH_TYPE_COLUMNS,
  LEGACY_DEFLECTION_RESULT_COLUMNS,
  LEGACY_KILL_TYPE_COLUMNS,
  LEGACY_THROW_RESULT_COLUMNS,
} from './legacyCsvExport';

function getStatisticsSummaryFormat(): {
  header: string;
  value: (stats: PlayerStatistics) => string;
}[] {
  const sections: {
    title: string;
    getAggregate: (stats: PlayerStatistics) => StatisticAggregates<number, number>;
    keys: readonly number[];
    enumObject: Record<string, number | string>;
    legacyRemap?: boolean;
  }[] = [
    { title: 'Matches', getAggregate: (s) => s.matches, keys: enumValues(ECompetitionOutcome), enumObject: ECompetitionOutcome },
    { title: 'Games', getAggregate: (s) => s.games, keys: enumValues(ECompetitionOutcome), enumObject: ECompetitionOutcome },
    {
      title: 'Kills (Direct) (Individual)',
      getAggregate: (s) => s.killsDirectIndividual,
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: { Hit: 1, BlockFailed: 2, CatchFailed: 3 },
      legacyRemap: true,
    },
    {
      title: 'Kills (Direct) (Group)',
      getAggregate: (s) => s.killsDirectGroup,
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: { Hit: 1, BlockFailed: 2, CatchFailed: 3 },
      legacyRemap: true,
    },
    {
      title: 'Kills Credit (Direct)',
      getAggregate: (s) => s.killsDirectCredit,
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: { Hit: 1, BlockFailed: 2, CatchFailed: 3 },
      legacyRemap: true,
    },
    {
      title: 'Kills (Deflection) (Individual)',
      getAggregate: (s) => s.killsDeflectionsIndividual,
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: { Hit: 1, BlockFailed: 2, CatchFailed: 3 },
      legacyRemap: true,
    },
    {
      title: 'Kills (Deflection) (Group)',
      getAggregate: (s) => s.killsDeflectionsGroup,
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: { Hit: 1, BlockFailed: 2, CatchFailed: 3 },
      legacyRemap: true,
    },
    {
      title: 'Kills Credit (Deflection)',
      getAggregate: (s) => s.killsDeflectionsCredit,
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: { Hit: 1, BlockFailed: 2, CatchFailed: 3 },
      legacyRemap: true,
    },
    {
      title: 'Deaths (Direct)',
      getAggregate: (s) => s.deathsDirect,
      keys: LEGACY_DEATH_TYPE_COLUMNS,
      enumObject: { Hit: 1, BlockFailed: 2, CatchFailed: 3, CatchThrown: 4 },
      legacyRemap: true,
    },
    {
      title: 'Deaths (Deflection)',
      getAggregate: (s) => s.deathsDeflections,
      keys: LEGACY_DEATH_TYPE_COLUMNS,
      enumObject: { Hit: 1, BlockFailed: 2, CatchFailed: 3, CatchThrown: 4 },
      legacyRemap: true,
    },
    {
      title: 'Deaths (Error)',
      getAggregate: (s) => s.deathsErrors,
      keys: enumValues(EDeathError),
      enumObject: EDeathError,
    },
    {
      title: 'Throws (Direct) (Individual)',
      getAggregate: (s) => s.offenseThrowsIndividual,
      keys: LEGACY_THROW_RESULT_COLUMNS,
      enumObject: { Hit: 1, Block: 2, BlockFailed: 3, Catch: 4, CatchFailed: 5, Dodge: 6, Miss: 7 },
      legacyRemap: true,
    },
    {
      title: 'Throws (Direct) (Group)',
      getAggregate: (s) => s.offenseThrowsGroup,
      keys: LEGACY_THROW_RESULT_COLUMNS,
      enumObject: { Hit: 1, Block: 2, BlockFailed: 3, Catch: 4, CatchFailed: 5, Dodge: 6, Miss: 7 },
      legacyRemap: true,
    },
    {
      title: 'Throws (Deflection) (Individual)',
      getAggregate: (s) => s.offenseDeflectionsIndividual,
      keys: LEGACY_DEFLECTION_RESULT_COLUMNS,
      enumObject: { Hit: 1, Block: 2, BlockFailed: 3, Catch: 4, CatchFailed: 5 },
      legacyRemap: true,
    },
    {
      title: 'Throws (Deflection) (Group)',
      getAggregate: (s) => s.offenseDeflectionsGroup,
      keys: LEGACY_DEFLECTION_RESULT_COLUMNS,
      enumObject: { Hit: 1, Block: 2, BlockFailed: 3, Catch: 4, CatchFailed: 5 },
      legacyRemap: true,
    },
    {
      title: 'Throws (Error)',
      getAggregate: (s) => s.offenseErrors,
      keys: enumValues(EThrowError),
      enumObject: EThrowError,
    },
    {
      title: 'Targeted (Direct)',
      getAggregate: (s) => s.defenseTargets,
      keys: LEGACY_THROW_RESULT_COLUMNS,
      enumObject: { Hit: 1, Block: 2, BlockFailed: 3, Catch: 4, CatchFailed: 5, Dodge: 6, Miss: 7 },
      legacyRemap: true,
    },
    {
      title: 'Targeted (Deflection)',
      getAggregate: (s) => s.defenseDeflections,
      keys: LEGACY_DEFLECTION_RESULT_COLUMNS,
      enumObject: { Hit: 1, Block: 2, BlockFailed: 3, Catch: 4, CatchFailed: 5 },
      legacyRemap: true,
    },
  ];

  const format: { header: string; value: (stats: PlayerStatistics) => string }[] = [
    { header: 'Team', value: (stats) => stats.team.Name },
    { header: 'Player', value: (stats) => stats.player.Name },
  ];

  for (const section of sections) {
    format.push({
      header: `********** ${section.title}`,
      value: (stats) => formatTotal(section.getAggregate(stats).total),
    });
    for (const key of section.keys) {
      const keyName = enumKey(section.enumObject, key);
      format.push({
        header: keyName,
        value: (stats) =>
          formatCount(
            section.legacyRemap
              ? legacyCsvColumnValue(section.title, key, stats)
              : section.getAggregate(stats).get(key),
          ),
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
