import type { ViewerRestriction } from '../cloud/viewerRestrictionTypes';

export type ViewerRestrictionView = Pick<
  ViewerRestriction,
  'banned' | 'allowedLeagueIds'
> | null;

export function isViewerBanned(
  restriction: ViewerRestrictionView,
): boolean {
  return Boolean(restriction?.banned);
}

/**
 * Whether a signed-in viewer may open roster/matches for `leagueId`.
 * `null` restriction = unrestricted (all leagues). App admins bypass this
 * in Firestore; callers that already know app-admin status may skip the check.
 */
export function canViewLeague(
  leagueId: string,
  restriction: ViewerRestrictionView,
): boolean {
  if (!leagueId.trim()) return false;
  if (isViewerBanned(restriction)) return false;
  const allowed = restriction?.allowedLeagueIds ?? [];
  if (allowed.length === 0) return true;
  return allowed.includes(leagueId);
}
