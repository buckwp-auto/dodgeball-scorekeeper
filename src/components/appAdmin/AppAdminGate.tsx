import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { PageHeader } from '../Ui';
import { useAuth } from '../../state/AuthContext';
import { useAppRole } from '../../state/AppRoleContext';

export function AppAdminGate({
  children,
  requireSuper = false,
  title,
}: {
  children: ReactNode;
  requireSuper?: boolean;
  title: string;
}) {
  const { configured, user, loading: authLoading, signInWithGoogle } = useAuth();
  const { isAppAdmin, isSuperAdmin, loading: roleLoading } = useAppRole();
  const allowed = requireSuper ? isSuperAdmin : isAppAdmin;

  if (authLoading || (user && roleLoading)) {
    return (
      <Stack spacing={2} className="sk-app-admin">
        <PageHeader>{title}</PageHeader>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">
            Checking operator access…
          </Typography>
        </Stack>
      </Stack>
    );
  }

  if (!configured) {
    return (
      <Stack spacing={2} className="sk-app-admin">
        <PageHeader>{title}</PageHeader>
        <Alert severity="info" className="sk-app-admin-unauthorized">
          Firebase is not configured. App admin tools are only available for shared
          cloud leagues.
        </Alert>
      </Stack>
    );
  }

  if (!user) {
    return (
      <Stack spacing={2} className="sk-app-admin">
        <PageHeader>{title}</PageHeader>
        <Alert severity="info" className="sk-app-admin-unauthorized">
          Sign in with Google to use app admin tools.
        </Alert>
        <Button
          variant="contained"
          onClick={() => void signInWithGoogle()}
          sx={{ alignSelf: 'flex-start' }}
        >
          Sign in with Google
        </Button>
      </Stack>
    );
  }

  if (!allowed) {
    return (
      <Stack spacing={2} className="sk-app-admin">
        <PageHeader>{title}</PageHeader>
        <Alert severity="warning" className="sk-app-admin-unauthorized">
          {requireSuper
            ? 'Only a super admin can manage app admins. Super admin is granted from the Firebase console.'
            : 'You need to be signed in as an app admin to view this page.'}
        </Alert>
      </Stack>
    );
  }

  return <>{children}</>;
}
