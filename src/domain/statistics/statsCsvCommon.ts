import {
  finalizeImportedAggregates,
  type ImportedAggregatesPayload,
} from './importedMatchStats';

export type StatsCsvRow = {
  teamName: string;
  playerName: string;
  aggregates: ImportedAggregatesPayload;
};

export type StatsCsvFormat = 'sectioned' | 'flat';

export type StatsCsvParseResult = {
  format: StatsCsvFormat;
  rows: StatsCsvRow[];
  /** Expected stats the file does not provide (imported as zero). */
  missingStats: string[];
  /** Header cells that were not recognized and were skipped. */
  ignoredColumns: string[];
  /** How incomplete data was filled in. */
  notes: string[];
};

export function emptyPayload(): ImportedAggregatesPayload {
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

export function finalizeRow(
  teamName: string,
  playerName: string,
  aggregates: ImportedAggregatesPayload,
): StatsCsvRow {
  finalizeImportedAggregates(aggregates);
  return { teamName, playerName, aggregates };
}

export function parseCount(value: string, context: () => string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${context()}: "${value}" is not a valid count`);
  }
  return parsed;
}

/** Case, accent, punctuation, and curly-apostrophe insensitive name key. */
export function normalizeImportName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2018\u2019\u02bc`]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function addToMap(map: Record<string, number>, key: number, amount: number): void {
  if (amount <= 0) return;
  const k = String(key);
  map[k] = (map[k] ?? 0) + amount;
}
