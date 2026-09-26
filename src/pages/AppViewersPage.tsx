import {
  Alert,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppAdminGate } from '../components/appAdmin/AppAdminGate';
import { AppAdminTabs } from '../components/appAdmin/AppAdminTabs';
import { PageHeader } from '../components/Ui';
import type { AppUserProfile } from '../cloud/appRoleTypes';
import type { ViewerRestriction } from '../cloud/viewerRestrictionTypes';
import { useAppRole } from '../state/AppRoleContext';
import { useLeague } from '../state/LeagueContext';

export function AppViewersPage() {
  const {
    listUsers,
    listViewerRestrictions,
    setViewerBanned,
    setViewerAllowedLeagueIds,
    clearViewerRestriction,
  } = useAppRole();
  const { leagues, refreshDirectory } = useLeague();
  const [users, setUsers] = useState<AppUserProfile[]>([]);
  const [restrictions, setRestrictions] = useState<ViewerRestriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [allowlistUid, setAllowlistUid] = useState<string | null>(null);
  const [allowlistDraft, setAllowlistDraft] = useState<string[]>([]);
  const [clearTarget, setClearTarget] = useState<AppUserProfile | null>(null);

  const reload = useCallback(async () => {
    const [nextUsers, nextRestrictions] = await Promise.all([
      listUsers(),
      listViewerRestrictions(),
    ]);
    setUsers(nextUsers);
    setRestrictions(nextRestrictions);
    await refreshDirectory().catch(() => undefined);
  }, [listUsers, listViewerRestrictions, refreshDirectory]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void reload()
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to load viewers',
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

  const restrictionByUid = useMemo(() => {
    const map = new Map<string, ViewerRestriction>();
    for (const row of restrictions) map.set(row.uid, row);
    return map;
  }, [restrictions]);

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
    }
  };

  const openAllowlist = (uid: string) => {
    const existing = restrictionByUid.get(uid);
    setAllowlistUid(uid);
    setAllowlistDraft(existing?.allowedLeagueIds ?? []);
  };

  return (
    <AppAdminGate title="Viewers">
      <Stack spacing={2} className="sk-app-admin sk-app-admin-viewers">
        <PageHeader>Viewers</PageHeader>
        <AppAdminTabs />
        <Typography variant="body2" color="text.secondary">
          Any signed-in Google user can open leagues in the read-only stats
          viewer. Ban bad actors outright, or allowlist specific leagues for a
          user. Clearing a restriction restores full directory access.
        </Typography>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {loading ? <CircularProgress size={28} /> : null}

        {!loading ? (
          <Table size="small" className="sk-app-admin-viewers-table">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Access</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => {
                const restriction = restrictionByUid.get(user.uid);
                const banned = Boolean(restriction?.banned);
                const allowlist = restriction?.allowedLeagueIds ?? [];
                return (
                  <TableRow key={user.uid}>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2">
                          {user.displayName || 'User'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email || user.uid}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }} useFlexGap>
                        {banned ? (
                          <Chip size="small" color="error" label="Banned" />
                        ) : allowlist.length > 0 ? (
                          <Chip
                            size="small"
                            color="warning"
                            label={`${allowlist.length} league${allowlist.length === 1 ? '' : 's'} only`}
                          />
                        ) : (
                          <Chip size="small" label="All leagues" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}
                      >
                        <Button
                          size="small"
                          disabled={busy}
                          className="sk-viewer-ban-toggle"
                          onClick={() =>
                            void run(() => setViewerBanned(user.uid, !banned))
                          }
                        >
                          {banned ? 'Unban' : 'Ban'}
                        </Button>
                        <Button
                          size="small"
                          disabled={busy}
                          className="sk-viewer-allowlist"
                          onClick={() => openAllowlist(user.uid)}
                        >
                          Allowlist
                        </Button>
                        {restriction ? (
                          <Button
                            size="small"
                            disabled={busy}
                            className="sk-viewer-clear-restriction"
                            onClick={() => setClearTarget(user)}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">
                      No signed-in users yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        ) : null}

        <Dialog
          open={Boolean(allowlistUid)}
          onClose={() => setAllowlistUid(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>League allowlist</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Leave empty to allow every league. Selecting leagues restricts
              this user to only those leagues (unless banned).
            </DialogContentText>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allowlistDraft.length === 0}
                  onChange={(event) => {
                    if (event.target.checked) setAllowlistDraft([]);
                  }}
                />
              }
              label="All leagues"
            />
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel id="sk-viewer-allowlist-label">Leagues</InputLabel>
              <Select
                labelId="sk-viewer-allowlist-label"
                multiple
                value={allowlistDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  setAllowlistDraft(
                    typeof value === 'string' ? value.split(',') : value,
                  );
                }}
                input={<OutlinedInput label="Leagues" />}
                renderValue={(selected) =>
                  selected
                    .map(
                      (id) =>
                        leagues.find((league) => league.id === id)?.name ?? id,
                    )
                    .join(', ')
                }
              >
                {leagues.map((league) => (
                  <MenuItem key={league.id} value={league.id}>
                    <Checkbox checked={allowlistDraft.includes(league.id)} />
                    <ListItemText primary={league.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAllowlistUid(null)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={busy || !allowlistUid}
              onClick={() => {
                if (!allowlistUid) return;
                void run(async () => {
                  await setViewerAllowedLeagueIds(allowlistUid, allowlistDraft);
                  setAllowlistUid(null);
                });
              }}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(clearTarget)}
          onClose={() => setClearTarget(null)}
        >
          <DialogTitle>Clear viewer restriction?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Remove ban and allowlist for{' '}
              {clearTarget?.displayName || clearTarget?.email || 'this user'}?
              They will be able to view any league again.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setClearTarget(null)}>Cancel</Button>
            <Button
              color="warning"
              variant="contained"
              disabled={busy || !clearTarget}
              onClick={() => {
                if (!clearTarget) return;
                void run(async () => {
                  await clearViewerRestriction(clearTarget.uid);
                  setClearTarget(null);
                });
              }}
            >
              Clear
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </AppAdminGate>
  );
}
