import type { DatabaseDto, Guid } from './types';
import {
  getStatisticsSummaryCsv,
  getStatisticsSummaryCsvText,
  getStatisticsSummaryHeaderLine,
} from './statistics/statisticsFormatService';

export function buildStatisticsCsvHeaderLine(): string {
  return getStatisticsSummaryHeaderLine();
}

export function buildStatisticsCsvBytes(data: DatabaseDto, matchId: Guid): Uint8Array {
  return getStatisticsSummaryCsv(data, [matchId]);
}

export function buildStatisticsCsvText(data: DatabaseDto, matchId: Guid): string {
  return getStatisticsSummaryCsvText(data, [matchId]);
}
