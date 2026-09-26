export type ViewerRestriction = {
  uid: string;
  banned: boolean;
  /** Empty / absent = all leagues. Non-empty = only these league ids. */
  allowedLeagueIds: string[];
  updatedAt: string;
  updatedBy: string;
};
