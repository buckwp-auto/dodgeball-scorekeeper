/** Who may delete a game inside a match (not the match itself). */
export function canDeleteMatchGame(options: {
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
