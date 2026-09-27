import type { ImportedAggregatesPayload } from './importedMatchStats';
import { getLegacyStatisticsColumnSpecs, type LegacyCsvColumnSpec } from './legacyCsvSchema';
import {
  emptyPayload,
  finalizeRow,
  parseCount,
  type StatsCsvParseResult,
  type StatsCsvRow,
} from './statsCsvCommon';

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

const SECTION_MARKER = /^\*{3,}\s*(.+)$/;

export function isSectionedStatsHeader(header: string[]): boolean {
  return header.some((cell) => SECTION_MARKER.test(cell.trim()));
}

function specKey(sectionTitle: string, header: string): string {
  return `${sectionTitle.toLowerCase()}|${header.toLowerCase()}`;
}

function applySectionValue(
  payload: ImportedAggregatesPayload,
  column: LegacyCsvColumnSpec,
  count: number,
): void {
  if (!column.sectionTitle || column.enumKey == null || count === 0) return;
  const field = SECTION_TO_FIELD[column.sectionTitle];
  if (!field) return;
  const map = payload[field];
  const key = String(column.enumKey);
  map[key] = column.legacyRemap ? (map[key] ?? 0) + count : count;
}

function describeMissing(missing: LegacyCsvColumnSpec[]): string[] {
  const baseline = getLegacyStatisticsColumnSpecs({ deflectionDodge: false }).filter(
    (spec) => spec.kind === 'enumValue',
  );
  const bySection = new Map<string, string[]>();
  for (const spec of missing) {
    const list = bySection.get(spec.sectionTitle!) ?? [];
    list.push(spec.header);
    bySection.set(spec.sectionTitle!, list);
  }
  return [...bySection].map(([section, headers]) => {
    const sectionSize = baseline.filter((spec) => spec.sectionTitle === section).length;
    return headers.length === sectionSize ? section : `${section}: ${headers.join(', ')}`;
  });
}

/** Scorekeeper-style export: `********** Section` markers followed by result columns. */
export function parseSectionedStatsCsv(
  header: string[],
  body: string[][],
): StatsCsvParseResult {
  const known = new Map<string, LegacyCsvColumnSpec>();
  for (const spec of getLegacyStatisticsColumnSpecs()) {
    if (spec.kind === 'enumValue') known.set(specKey(spec.sectionTitle!, spec.header), spec);
  }

  let teamCol = -1;
  let playerCol = -1;
  let section: string | null = null;
  const columns = new Map<number, LegacyCsvColumnSpec>();
  const ignoredColumns: string[] = [];
  const seen = new Set<string>();

  header.forEach((raw, index) => {
    const cell = raw.trim();
    if (!cell) return;
    const marker = SECTION_MARKER.exec(cell);
    if (marker) {
      const title = marker[1].trim();
      section = Object.keys(SECTION_TO_FIELD).find(
        (candidate) => candidate.toLowerCase() === title.toLowerCase(),
      ) ?? null;
      if (!section) ignoredColumns.push(cell);
      return;
    }
    const lower = cell.toLowerCase();
    if (lower === 'team' && teamCol < 0) {
      teamCol = index;
      return;
    }
    if (lower === 'player' && playerCol < 0) {
      playerCol = index;
      return;
    }
    const spec = section ? known.get(specKey(section, cell)) : undefined;
    if (!spec) {
      ignoredColumns.push(section ? `${section}: ${cell}` : cell);
      return;
    }
    columns.set(index, spec);
    seen.add(specKey(spec.sectionTitle!, spec.header));
  });

  if (teamCol < 0 || playerCol < 0) {
    throw new Error('Statistics CSV needs a Team and a Player column');
  }

  const missing = getLegacyStatisticsColumnSpecs({ deflectionDodge: false }).filter(
    (spec) => spec.kind === 'enumValue' && !seen.has(specKey(spec.sectionTitle!, spec.header)),
  );

  const rows: StatsCsvRow[] = [];
  let skipped = 0;
  for (const cells of body) {
    const teamName = (cells[teamCol] ?? '').trim();
    const playerName = (cells[playerCol] ?? '').trim();
    if (!teamName || !playerName) {
      skipped += 1;
      continue;
    }
    const aggregates = emptyPayload();
    for (const [index, spec] of columns) {
      const count = parseCount(
        cells[index] ?? '',
        () => `${playerName} (${spec.sectionTitle} ${spec.header})`,
      );
      applySectionValue(aggregates, spec, count);
    }
    rows.push(finalizeRow(teamName, playerName, aggregates));
  }

  return {
    format: 'sectioned',
    rows,
    missingStats: describeMissing(missing),
    ignoredColumns,
    notes: skipped
      ? [`Skipped ${skipped} row${skipped === 1 ? '' : 's'} without a team or player name`]
      : [],
  };
}
