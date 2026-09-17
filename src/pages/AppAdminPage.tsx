import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AppAdminGate } from '../components/appAdmin/AppAdminGate';
import { AppAdminTabs } from '../components/appAdmin/AppAdminTabs';
import { PageHeader } from '../components/Ui';
import { canOpenLeagueAsOperator } from '../domain/appRoles';
import { useAppRole } from '../state/AppRoleContext';
import { useLeague } from '../state/LeagueContext';

function formatCreatedAt(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function AppAdminPage() {
  const navigate = useNavigate();
  const { isAppAdmin } = useAppRole();
  const {
    leagues,
    memberships,
    activeLeagueId,
    refreshing,
    syncError,
    openLeague,
  } = useLeague();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      [...leagues].sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      ),
    [leagues],
  );

  return (
    <AppAdminGate title="App admin">
      <Stack spacing={2} className="sk-app-admin sk-app-admin-leagues">
        <PageHeader>App admin</PageHeader>
        <AppAdminTabs />
        <Typography variant="body2" color="text.secondary">
          Every shared league and its owner. Open a league to operate as a league
          admin, or manage who has access.
        </Typography>
        {syncError ? <Alert severity="error">{syncError}</Alert> : null}
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {refreshing && rows.length === 0 ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress size={28} />
            <Typography variant="body2">Loading leagues…</Typography>
          </Stack>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>League</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((league) => {
                const canOpen = canOpenLeagueAsOperator({
                  membershipStatus: memberships[league.id]?.status,
                  isAppAdmin,
                });
                const isOpen = activeLeagueId === league.id;
                return (
                  <TableRow key={league.id} selected={isOpen}>
                    <TableCell>{league.name}</TableCell>
                    <TableCell>
                      <Stack spacing={0}>
                        <span>{league.adminDisplayName || '—'}</span>
                        <Typography variant="caption" color="text.secondary">
                          {league.adminEmail || league.adminUid}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{formatCreatedAt(league.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        className="button-row"
                        sx={{
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                          rowGap: 1,
                        }}
                      >
                        {canOpen ? (
                          <Button
                            size="small"
                            variant={isOpen ? 'outlined' : 'contained'}
                            disabled={busyId !== null || isOpen}
                            onClick={() => {
                              setErrorMessage(null);
                              setBusyId(league.id);
                              void openLeague(league.id)
                                .then(() => navigate('/'))
                                .catch((error) => {
                                  setErrorMessage(
                                    error instanceof Error
                                      ? error.message
                                      : 'Failed to open league',
                                  );
                                })
                                .finally(() => setBusyId(null));
                            }}
                          >
                            {isOpen ? 'Opened' : 'Open'}
                          </Button>
                        ) : null}
                        <Button
                          size="small"
                          variant="outlined"
                          component={Link}
                          to={`/admin/leagues/${league.id}`}
                        >
                          Members
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>No cloud leagues yet.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </Stack>
    </AppAdminGate>
  );
}
