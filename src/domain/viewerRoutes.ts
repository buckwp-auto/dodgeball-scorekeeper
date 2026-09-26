/** Route prefix for the read-only league stats viewer shell. */
export const VIEWER_BASE = '/view-stats';

export function isViewerPath(pathname: string): boolean {
  return pathname === VIEWER_BASE || pathname.startsWith(`${VIEWER_BASE}/`);
}

export function withRouteBase(base: string, path: string): string {
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}` || normalizedPath;
}

export function viewerLeaguesHref(): string {
  return VIEWER_BASE;
}

export function viewerStatsHref(): string {
  return `${VIEWER_BASE}/stats`;
}

export function viewerPlayersHref(): string {
  return `${VIEWER_BASE}/players`;
}

export function viewerPlayerHref(playerId: string): string {
  return `${VIEWER_BASE}/players/${encodeURIComponent(playerId)}`;
}

export function viewerMatchStatsHref(matchId: string): string {
  return `${VIEWER_BASE}/matches/${encodeURIComponent(matchId)}/stats`;
}

export function viewerGameStatsHref(matchId: string, gameId: string): string {
  return `${VIEWER_BASE}/matches/${encodeURIComponent(matchId)}/games/${encodeURIComponent(gameId)}/stats`;
}
