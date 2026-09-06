import { MAX_MATCH_LABEL, MAX_MATCH_LABELS, clampName } from './limits';
import type { DatabaseDto, Guid, MatchRow, TeamRow } from './types';

/** Anticipated weekly-league / playoff labels; freeform values are still allowed. */
export const SUGGESTED_MATCH_LABELS: readonly string[] = [
  ...Array.from({ length: 16 }, (_, index) => `Week ${index + 1}`),
  'Playoffs',
  'Semis',
  'Finals',
  'Game of the Week',
];

function tableMatch(data: DatabaseDto): MatchRow[] {
  const rows = data.Tables.Match;
  return Array.isArray(rows) ? (rows as MatchRow[]) : [];
}

function tableTeam(data: DatabaseDto): TeamRow[] {
  const rows = data.Tables.Team;
  return Array.isArray(rows) ? (rows as TeamRow[]) : [];
}

function teamName(data: DatabaseDto, teamId: Guid): string {
  return tableTeam(data).find((team) => team.Id === teamId)?.Name ?? '';
}

/** Trim, clamp length, drop empties, dedupe case-insensitively, cap count. */
export function normalizeMatchLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const label = clampName(entry, MAX_MATCH_LABEL);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= MAX_MATCH_LABELS) break;
  }
  return out;
}

export function getMatchLabels(match: MatchRow): string[] {
  return normalizeMatchLabels(match.Labels);
}

/** Labels already used on any match in the league (sorted). */
export function listLeagueMatchLabels(data: DatabaseDto): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of tableMatch(data)) {
    for (const label of getMatchLabels(match)) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Autocomplete options: presets first (Week / Playoffs / …), then any other
 * labels already used in the league. Freeform entry remains allowed in the UI.
 */
export function listMatchLabelSuggestions(data: DatabaseDto): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of [...SUGGESTED_MATCH_LABELS, ...listLeagueMatchLabels(data)]) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function setMatchLabels(
  data: DatabaseDto,
  matchId: Guid,
  labels: string[],
): string[] {
  const match = tableMatch(data).find((row) => row.Id === matchId);
  if (!match) throw new Error('Match not found');
  const next = normalizeMatchLabels(labels);
  if (next.length === 0) delete match.Labels;
  else match.Labels = next;
  return next;
}

export function formatMatchDisplayName(
  pairingName: string,
  labels: string[] | undefined | null,
): string {
  const normalized = normalizeMatchLabels(labels ?? []);
  if (normalized.length === 0) return pairingName;
  return `${pairingName} · ${normalized.join(' · ')}`;
}

/** Case-insensitive substring match on team names or labels. Empty query = all. */
export function matchPassesListSearch(
  data: DatabaseDto,
  match: MatchRow,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const home = teamName(data, match.TeamIdHome);
  const away = teamName(data, match.TeamIdAway);
  if (home.toLowerCase().includes(needle)) return true;
  if (away.toLowerCase().includes(needle)) return true;
  if (`${home} vs. ${away}`.toLowerCase().includes(needle)) return true;
  return getMatchLabels(match).some((label) => label.toLowerCase().includes(needle));
}
