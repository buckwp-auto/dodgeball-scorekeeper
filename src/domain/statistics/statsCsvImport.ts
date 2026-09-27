import { ECompetitionOutcome } from './constants';
import { parseFlatStatsCsv } from './flatCsvImport';
import { isSectionedStatsHeader, parseSectionedStatsCsv } from './legacyCsvImport';
import {
  normalizeImportName,
  type StatsCsvParseResult,
  type StatsCsvRow,
} from './statsCsvCommon';

function detectDelimiter(headerLine: string): string {
  const candidates = ['\t', ',', ';'];
  let best = ',';
  let bestCount = 0;
  for (const delimiter of candidates) {
    const count = headerLine.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function parseDelimitedRows(text: string): string[][] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim());
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => parseDelimitedLine(line, delimiter));
}

/**
 * Parse a player statistics CSV/TSV: scorekeeper section-header exports (any
 * column order or subset) or flat one-column-per-stat spreadsheets.
 */
export function parseStatsCsv(text: string): StatsCsvParseResult {
  const [header, ...body] = parseDelimitedRows(text);
  if (!header || body.length === 0) {
    throw new Error('Statistics CSV must include a header row and at least one player row');
  }
  const result = isSectionedStatsHeader(header)
    ? parseSectionedStatsCsv(header, body)
    : parseFlatStatsCsv(header, body);
  if (result.rows.length === 0) {
    throw new Error('Statistics CSV has no player rows');
  }
  return result;
}

/** Team names in order of first appearance (deduplicated by normalized name). */
export function getCsvTeamNames(rows: StatsCsvRow[]): string[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeImportName(row.teamName);
    if (!seen.has(key)) seen.set(key, row.teamName);
  }
  return [...seen.values()];
}

/** Optional hint for the import game-score form (not authoritative). */
export type StatsCsvSeriesHint = {
  homeGameWins: number;
  awayGameWins: number;
  tiedGames: number;
};

export function suggestSeriesFromCsv(
  rows: StatsCsvRow[],
  homeCsvTeamName: string,
  awayCsvTeamName: string,
): StatsCsvSeriesHint {
  const homeKey = normalizeImportName(homeCsvTeamName);
  const awayKey = normalizeImportName(awayCsvTeamName);
  let homeGameWins = 0;
  let awayGameWins = 0;
  let tiedGames = 0;
  for (const row of rows) {
    const key = normalizeImportName(row.teamName);
    const wins = row.aggregates.games[String(ECompetitionOutcome.Win)] ?? 0;
    const losses = row.aggregates.games[String(ECompetitionOutcome.Loss)] ?? 0;
    const ties = row.aggregates.games[String(ECompetitionOutcome.Tie)] ?? 0;
    if (key === homeKey) {
      homeGameWins = Math.max(homeGameWins, wins);
      awayGameWins = Math.max(awayGameWins, losses);
      tiedGames = Math.max(tiedGames, ties);
    } else if (key === awayKey) {
      awayGameWins = Math.max(awayGameWins, wins);
      homeGameWins = Math.max(homeGameWins, losses);
      tiedGames = Math.max(tiedGames, ties);
    }
  }
  return { homeGameWins, awayGameWins, tiedGames };
}

export type { StatsCsvFormat, StatsCsvParseResult, StatsCsvRow } from './statsCsvCommon';
