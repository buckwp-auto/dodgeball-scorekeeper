function isLocalAdminOrMatchScorer(options: {
  hasActiveLeague: boolean;
  isLeagueAdmin: boolean;
  userUid?: string | null;
  createdByUid?: string | null;
}): boolean {
  if (!options.hasActiveLeague) return true;
  if (options.isLeagueAdmin) return true;
  const uid = options.userUid?.trim();
  const creator = options.createdByUid?.trim();
  return Boolean(uid && creator && uid === creator);
}

/** Who may delete a game inside a match (not the match itself). */
export function canDeleteMatchGame(options: {
  hasActiveLeague: boolean;
  isLeagueAdmin: boolean;
  userUid?: string | null;
  createdByUid?: string | null;
}): boolean {
  return isLocalAdminOrMatchScorer(options);
}

/** Who may undo a recorded match-end (local, league admin, or match scorer). */
export function canUndoMatchEnd(options: {
  hasActiveLeague: boolean;
  isLeagueAdmin: boolean;
  userUid?: string | null;
  createdByUid?: string | null;
}): boolean {
  return isLocalAdminOrMatchScorer(options);
}
