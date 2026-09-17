import type { AppRole } from '../cloud/appRoleTypes';

export type AppRoleOrNone = AppRole | null;

export function isAppAdminRole(role: AppRoleOrNone): boolean {
  return role === 'superAdmin' || role === 'appAdmin';
}

export function isSuperAdminRole(role: AppRoleOrNone): boolean {
  return role === 'superAdmin';
}

export function canGrantAppAdmin(actorRole: AppRoleOrNone): boolean {
  return actorRole === 'superAdmin';
}

export function canOpenLeagueAsOperator(options: {
  membershipStatus?: string | null;
  isAppAdmin: boolean;
}): boolean {
  return options.isAppAdmin || options.membershipStatus === 'active';
}

export function isOperatingAsAppAdmin(options: {
  isAppAdmin: boolean;
  membershipStatus?: string | null;
}): boolean {
  return options.isAppAdmin && options.membershipStatus !== 'active';
}
