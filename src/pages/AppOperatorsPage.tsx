import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppAdminGate } from '../components/appAdmin/AppAdminGate';
import { AppAdminTabs } from '../components/appAdmin/AppAdminTabs';
import { PageHeader } from '../components/Ui';
import type { AppAdminRecord, AppUserProfile } from '../cloud/appRoleTypes';
import { useAppRole } from '../state/AppRoleContext';

export function AppOperatorsPage() {
  const {
    listAppAdmins,
    listUsers,
    grantAppAdmin,
    revokeAppAdmin,
  } = useAppRole();
  const [admins, setAdmins] = useState<AppAdminRecord[]>([]);
  const [users, setUsers] = useState<AppUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [promoteUid, setPromoteUid] = useState('');
  const [kickTarget, setKickTarget] = useState<AppAdminRecord | null>(null);

  const reload = useCallback(async () => {
    const [nextAdmins, nextUsers] = await Promise.all([
      listAppAdmins(),
      listUsers(),
    ]);
    setAdmins(nextAdmins);
    setUsers(nextUsers);
  }, [listAppAdmins, listUsers]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void reload()
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to load operators',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const adminUids = useMemo(() => new Set(admins.map((row) => row.uid)), [admins]);
  const promoteCandidates = useMemo(
    () => users.filter((row) => !adminUids.has(row.uid)),
    [users, adminUids],
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await action();
      await reload();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Action failed',
      );
    } finally {
      setBusy(false);
      setKickTarget(null);
    }
  };

  const selected = promoteCandidates.find((row) => row.uid === promoteUid);

  return (
    <AppAdminGate title="Operators" requireSuper>
      <Stack spacing={2} className="sk-app-admin sk-app-admin-operators">
        <PageHeader>Operators</PageHeader>
        <AppAdminTabs />
        <Typography variant="body2" color="text.secondary">
          Super admin can promote people who have signed in to app admin, or kick an
          app admin. Super admin itself is only granted from the Firebase console.
        </Typography>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

        <Stack
          direction="row"
          spacing={1}
          className="button-row"
          sx={{ flexWrap: 'wrap', alignItems: 'center', rowGap: 1 }}
        >
          <TextField
            select
            size="small"
            label="Promote signed-in user"
            value={promoteUid}
            onChange={(event) => setPromoteUid(event.target.value)}
            sx={{ minWidth: 280 }}
            disabled={busy || promoteCandidates.length === 0}
          >
            <MenuItem value="" disabled>
              Choose a user
            </MenuItem>
            {promoteCandidates.map((row) => (
              <MenuItem key={row.uid} value={row.uid}>
                {row.displayName || row.email || row.uid}
                {row.email ? ` (${row.email})` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            disabled={busy || !selected}
            onClick={() => {
              if (!selected) return;
              void run(async () => {
                await grantAppAdmin(selected);
                setPromoteUid('');
              });
            }}
          >
            Make app admin
          </Button>
        </Stack>
        {promoteCandidates.length === 0 && !loading ? (
          <Typography variant="body2" color="text.secondary">
            No other signed-in users to promote. They need to sign in once so a user
            profile exists.
          </Typography>
        ) : null}

        {loading ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress size={28} />
            <Typography variant="body2">Loading operators…</Typography>
          </Stack>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Operator</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.uid}>
                  <TableCell>
                    <Stack spacing={0}>
                      <span>{admin.displayName || admin.email || admin.uid}</span>
                      <Typography variant="caption" color="text.secondary">
                        {admin.email || admin.uid}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={admin.role === 'superAdmin' ? 'primary' : 'default'}
                      label={admin.role === 'superAdmin' ? 'Super admin' : 'App admin'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {admin.role === 'appAdmin' ? (
                      <Button
                        size="small"
                        color="error"
                        disabled={busy}
                        onClick={() => setKickTarget(admin)}
                      >
                        Kick
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Console only
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {admins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>No operators yet.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </Stack>

      <Dialog
        open={kickTarget !== null}
        onClose={() => (busy ? undefined : setKickTarget(null))}
      >
        <DialogTitle>Remove app admin?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {kickTarget?.displayName || kickTarget?.email} will lose operator access
            to other people’s leagues. They keep any leagues they already belong to.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setKickTarget(null)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy || !kickTarget}
            onClick={() => {
              if (!kickTarget) return;
              void run(() => revokeAppAdmin(kickTarget.uid));
            }}
          >
            Kick
          </Button>
        </DialogActions>
      </Dialog>
    </AppAdminGate>
  );
}
