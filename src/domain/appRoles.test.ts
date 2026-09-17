import { describe, expect, it } from 'vitest';
import {
  canGrantAppAdmin,
  canOpenLeagueAsOperator,
  isAppAdminRole,
  isOperatingAsAppAdmin,
  isSuperAdminRole,
} from './appRoles';

describe('isAppAdminRole', () => {
  it('treats super admin as an app admin', () => {
    expect(isAppAdminRole('superAdmin')).toBe(true);
    expect(isAppAdminRole('appAdmin')).toBe(true);
    expect(isAppAdminRole(null)).toBe(false);
  });
});

describe('isSuperAdminRole', () => {
  it('is only the console-seeded super admin', () => {
    expect(isSuperAdminRole('superAdmin')).toBe(true);
    expect(isSuperAdminRole('appAdmin')).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
  });
});

describe('canGrantAppAdmin', () => {
  it('allows only super admins to promote or kick app admins', () => {
    expect(canGrantAppAdmin('superAdmin')).toBe(true);
    expect(canGrantAppAdmin('appAdmin')).toBe(false);
    expect(canGrantAppAdmin(null)).toBe(false);
  });
});

describe('canOpenLeagueAsOperator', () => {
  it('allows approved members and app admins', () => {
    expect(
      canOpenLeagueAsOperator({ membershipStatus: 'active', isAppAdmin: false }),
    ).toBe(true);
    expect(
      canOpenLeagueAsOperator({ membershipStatus: 'pending', isAppAdmin: true }),
    ).toBe(true);
    expect(
      canOpenLeagueAsOperator({ membershipStatus: null, isAppAdmin: true }),
    ).toBe(true);
    expect(
      canOpenLeagueAsOperator({ membershipStatus: 'pending', isAppAdmin: false }),
    ).toBe(false);
  });
});

describe('isOperatingAsAppAdmin', () => {
  it('is true only when an app admin opens a league they have not joined', () => {
    expect(
      isOperatingAsAppAdmin({ isAppAdmin: true, membershipStatus: null }),
    ).toBe(true);
    expect(
      isOperatingAsAppAdmin({ isAppAdmin: true, membershipStatus: 'pending' }),
    ).toBe(true);
    expect(
      isOperatingAsAppAdmin({ isAppAdmin: true, membershipStatus: 'active' }),
    ).toBe(false);
    expect(
      isOperatingAsAppAdmin({ isAppAdmin: false, membershipStatus: null }),
    ).toBe(false);
  });
});
