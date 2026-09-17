export type AppRole = 'superAdmin' | 'appAdmin';

export type AppAdminRecord = {
  uid: string;
  role: AppRole;
  email: string;
  displayName: string;
  grantedAt: string;
  grantedBy: string;
};

export type AppUserProfile = {
  uid: string;
  email: string;
  displayName: string;
  lastSeenAt: string;
};
