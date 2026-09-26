import { Tab, Tabs } from '@mui/material';
import { Link, useLocation } from 'react-router';
import { useAppRole } from '../../state/AppRoleContext';

export function AppAdminTabs() {
  const location = useLocation();
  const { isSuperAdmin } = useAppRole();
  const value = location.pathname.startsWith('/admin/operators')
    ? 'operators'
    : location.pathname.startsWith('/admin/viewers')
      ? 'viewers'
      : 'leagues';

  return (
    <Tabs
      value={value}
      sx={{ mb: 2 }}
      className="sk-app-admin-tabs"
    >
      <Tab
        label="Leagues"
        value="leagues"
        component={Link}
        to="/admin"
        className="sk-app-admin-tab-leagues"
      />
      <Tab
        label="Viewers"
        value="viewers"
        component={Link}
        to="/admin/viewers"
        className="sk-app-admin-tab-viewers"
      />
      {isSuperAdmin ? (
        <Tab
          label="Operators"
          value="operators"
          component={Link}
          to="/admin/operators"
          className="sk-app-admin-tab-operators"
        />
      ) : null}
    </Tabs>
  );
}
