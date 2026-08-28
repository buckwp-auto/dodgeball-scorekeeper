import { ECompetitionOutcome } from './constants';
import type { ImportedAggregatesPayload } from './importedMatchStats';
import {
  getLegacyStatisticsColumnSpecs,
  getLegacyStatisticsHeaderNames,
  type LegacyCsvColumnSpec,
} from './legacyCsvSchema';

export type ParsedLegacyCsvRow = {
  teamName: string;
  playerName: string;
  aggregates: ImportedAggregatesPayload;
};

export type ParsedLegacyCsv = {
  rows: ParsedLegacyCsvRow[];
};

function parseCsvRows(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
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
    if (char === ',') {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function emptyPayload(): ImportedAggregatesPayload {
  return {
    matches: {},
    games: {},
    offenseThrowsIndividual: {},
    offenseThrowsGroup: {},
    offenseDeflectionsIndividual: {},
    offenseDeflectionsGroup: {},
    offenseErrors: {},
    defenseTargets: {},
    defenseDeflections: {},
    killsDirectIndividual: {},
    killsDirectGroup: {},
    killsDirectCredit: {},
    killsDeflectionsIndividual: {},
    killsDeflectionsGroup: {},
    killsDeflectionsCredit: {},
    killsSupportCredit: {},
    deathsDirect: {},
    deathsDeflections: {},
    deathsErrors: {},
    deathsCredit: 0,
    deathsCatchThrownCredit: 0,
    teamThrowAssists: 0,
    doubleKills: 0,
    tripleKills: 0,
    quadKills: 0,
    doubleCatches: 0,
    tripleCatches: 0,
    quadCatches: 0,
    catchesDirect: 0,
    catchesDeflection: 0,
  };
}

type SectionField = keyof Omit<
  ImportedAggregatesPayload,
  | 'deathsCredit'
  | 'deathsCatchThrownCredit'
  | 'teamThrowAssists'
  | 'doubleKills'
  | 'tripleKills'
  | 'quadKills'
  | 'doubleCatches'
  | 'tripleCatches'
  | 'quadCatches'
  | 'catchesDirect'
  | 'catchesDeflection'
>;

const SECTION_TO_FIELD: Record<string, SectionField> = {
  Matches: 'matches',
  Games: 'games',
  'Kills (Direct) (Individual)': 'killsDirectIndividual',
  'Kills (Direct) (Group)': 'killsDirectGroup',
  'Kills Credit (Direct)': 'killsDirectCredit',
  'Kills (Deflection) (Individual)': 'killsDeflectionsIndividual',
  'Kills (Deflection) (Group)': 'killsDeflectionsGroup',
  'Kills Credit (Deflection)': 'killsDeflectionsCredit',
  'Deaths (Direct)': 'deathsDirect',
  'Deaths (Deflection)': 'deathsDeflections',
  'Deaths (Error)': 'deathsErrors',
  'Throws (Direct) (Individual)': 'offenseThrowsIndividual',
  'Throws (Direct) (Group)': 'offenseThrowsGroup',
  'Throws (Deflection) (Individual)': 'offenseDeflectionsIndividual',
  'Throws (Deflection) (Group)': 'offenseDeflectionsGroup',
  'Throws (Error)': 'offenseErrors',
  'Targeted (Direct)': 'defenseTargets',
  'Targeted (Deflection)': 'defenseDeflections',
};

function parseCount(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid stat count: ${value}`);
  }
  return parsed;
}

function applyLegacyImportValue(
  payload: ImportedAggregatesPayload,
  column: LegacyCsvColumnSpec,
  rawValue: string,
): void {
  if (!column.sectionTitle || column.enumKey == null) return;
  const field = SECTION_TO_FIELD[column.sectionTitle];
  if (!field) return;
  const count = parseCount(rawValue);
  if (count === 0) return;
  const map = payload[field];
  const key = String(column.enumKey);
  if (column.legacyRemap) {
    map[key] = (map[key] ?? 0) + count;
    return;
  }
  map[key] = count;
}

function rowFromCells(cells: string[], specs: LegacyCsvColumnSpec[]): ParsedLegacyCsvRow {
  if (cells.length < specs.length) {
    throw new Error('Statistics CSV row has too few columns');
  }
  let teamName = '';
  let playerName = '';
  const aggregates = emptyPayload();
  for (let i = 0; i < specs.length; i += 1) {
    const spec = specs[i];
    const value = cells[i] ?? '';
    if (spec.kind === 'team') teamName = value.trim();
    else if (spec.kind === 'player') playerName = value.trim();
    else if (spec.kind === 'enumValue') applyLegacyImportValue(aggregates, spec, value);
  }
  if (!teamName || !playerName) {
    throw new Error('Statistics CSV row is missing Team or Player');
  }
  return { teamName, playerName, aggregates };
}

export function parseLegacyStatisticsCsv(text: string): ParsedLegacyCsv {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    throw new Error('Statistics CSV must include a header row and at least one player row');
  }
  const expected = getLegacyStatisticsHeaderNames();
  const header = rows[0];
  if (header.length < expected.length) {
    throw new Error('Statistics CSV header does not match the legacy format');
  }
  for (let i = 0; i < expected.length; i += 1) {
    if ((header[i] ?? '').trim() !== expected[i]) {
      throw new Error(
        `Statistics CSV header mismatch at column ${i + 1}: expected "${expected[i]}", got "${header[i] ?? ''}"`,
      );
    }
  }
  const specs = getLegacyStatisticsColumnSpecs();
  const parsedRows = rows.slice(1).map((cells) => rowFromCells(cells, specs));
  if (parsedRows.length === 0) {
    throw new Error('Statistics CSV has no player rows');
  }
  return { rows: parsedRows };
}

/** Optional hint for the import game-score form (not authoritative). */
export type LegacyCsvSeriesHint = {
  homeGameWins: number;
  awayGameWins: number;
  tiedGames: number;
};

export function suggestSeriesFromLegacyCsv(
  parsed: ParsedLegacyCsv,
  homeTeamName: string,
  awayTeamName: string,
): LegacyCsvSeriesHint {
  const homeNorm = homeTeamName.trim().toLowerCase();
  const awayNorm = awayTeamName.trim().toLowerCase();
  let homeGameWins = 0;
  let awayGameWins = 0;
  let tiedGames = 0;
  for (const row of parsed.rows) {
    const teamNorm = row.teamName.trim().toLowerCase();
    const wins = row.aggregates.games[String(ECompetitionOutcome.Win)] ?? 0;
    const losses = row.aggregates.games[String(ECompetitionOutcome.Loss)] ?? 0;
    const ties = row.aggregates.games[String(ECompetitionOutcome.Tie)] ?? 0;
    if (teamNorm === homeNorm) {
      homeGameWins = Math.max(homeGameWins, wins);
      awayGameWins = Math.max(awayGameWins, losses);
      tiedGames = Math.max(tiedGames, ties);
    } else if (teamNorm === awayNorm) {
      awayGameWins = Math.max(awayGameWins, wins);
      homeGameWins = Math.max(homeGameWins, losses);
      tiedGames = Math.max(tiedGames, ties);
    }
  }
  return { homeGameWins, awayGameWins, tiedGames };
}
