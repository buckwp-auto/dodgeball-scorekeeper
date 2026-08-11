/** Session label for a local (file/sample) league shown in the sync bar. */
export const LOCAL_LEAGUE_LABEL_KEY = 'SCOREKEEPER_LOCAL_LEAGUE_LABEL';

export const SAMPLE_LEAGUE_LABEL = 'Sample league (demo)';

export function localLeagueLabelFromFilename(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return 'Local league';
  const withoutExt = trimmed.replace(/\.scrkpr$/i, '').trim();
  return withoutExt || trimmed;
}

export function loadLocalLeagueLabel(): string | null {
  const raw = sessionStorage.getItem(LOCAL_LEAGUE_LABEL_KEY);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

export function saveLocalLeagueLabel(label: string | null): void {
  const trimmed = label?.trim() || '';
  if (!trimmed) {
    sessionStorage.removeItem(LOCAL_LEAGUE_LABEL_KEY);
    return;
  }
  sessionStorage.setItem(LOCAL_LEAGUE_LABEL_KEY, trimmed);
}
