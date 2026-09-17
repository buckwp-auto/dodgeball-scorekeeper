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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AppAdminGate } from '../components/appAdmin/AppAdminGate';
import { AppAdminTabs } from '../components/appAdmin/AppAdminTabs';
import { PageHeader } from '../components/Ui';
import type { LeagueMember } from '../cloud/leagueTypes';
import { useLeague } from '../state/LeagueContext';

type ConfirmAction =
  | { kind: 'remove'; member: LeagueMember }
  | { kind: 'transfer'; member: LeagueMember };

function statusColor(status: LeagueMember['status']): 'default' | 'success' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  return 'default';
}

export function AppAdminLeaguePage() {
  const { leagueId = '' } = useParams();
  const navigate = useNavigate();
  const {
    leagues,
    membersByLeague,
    activeLeagueId,
    loadLeagueMembers,
    openLeague,
    approveMember,
    rejectMember,
    setMemberRole,
    removeMember,
    transferLeagueOwner,
  } = useLeague();
  const league = leagues.find((row) => row.id === leagueId);
  const members = membersByLeague[leagueId] ?? [];
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    setLoading(true);
    void loadLeagueMembers(leagueId)
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to load members',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, loadLeagueMembers]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const ownerFirst =
          Number(b.uid === league?.adminUid) - Number(a.uid === league?.adminUid);
        if (ownerFirst !== 0) return ownerFirst;
        return (
          a.displayName.localeCompare(b.displayName) ||
          a.email.localeCompare(b.email)
        );
      }),
    [members, league?.adminUid],
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await action();
      await loadLeagueMembers(leagueId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Action failed',
      );
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <AppAdminGate title="League members">
      <Stack spacing={2} className="sk-app-admin sk-app-admin-league">
        <PageHeader>{league?.name ?? 'League members'}</PageHeader>
        <AppAdminTabs />
        <Stack
          direction="row"
          spacing={1}
          className="button-row"
          sx={{ flexWrap: 'wrap', rowGap: 1 }}
        >
          <Button size="small" component={Link} to="/admin">
            Back to leagues
          </Button>
          {league ? (
            <Button
              size="small"
              variant="contained"
              disabled={busy || activeLeagueId === league.id}
              onClick={() => {
                setBusy(true);
                setErrorMessage(null);
                void openLeague(league.id)
                  .then(() => navigate('/'))
                  .catch((error) => {
                    setErrorMessage(
                      error instanceof Error
                        ? error.message
                        : 'Failed to open league',
                    );
                  })
                  .finally(() => setBusy(false));
              }}
            >
              {activeLeagueId === league.id ? 'Opened' : 'Open league'}
            </Button>
          ) : null}
        </Stack>
        {league ? (
          <Typography variant="body2" color="text.secondary">
            Owner: {league.adminDisplayName || '—'}
            {league.adminEmail ? ` (${league.adminEmail})` : ''}
          </Typography>
        ) : (
          <Alert severity="info">League not found in the directory.</Alert>
        )}
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {loading ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress size={28} />
            <Typography variant="body2">Loading members…</Typography>
          </Stack>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Member</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedMembers.map((member) => {
                const isOwner = member.uid === league?.adminUid;
                return (
                  <TableRow key={member.uid}>
                    <TableCell>
                      <Stack spacing={0}>
                        <span>
                          {member.displayName || member.email || member.uid}
                          {isOwner ? ' (owner)' : ''}
                        </span>
                        <Typography variant="caption" color="text.secondary">
                          {member.email || member.uid}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={member.role === 'admin' ? 'League admin' : 'Member'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={statusColor(member.status)}
                        label={member.status}
                      />
                    </TableCell>
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
                        {member.status === 'pending' ? (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={busy}
                              onClick={() =>
                                void run(() => approveMember(leagueId, member.uid))
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              disabled={busy}
                              onClick={() =>
                                void run(() => rejectMember(leagueId, member.uid))
                              }
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {member.status === 'rejected' ? (
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={() =>
                              void run(() => approveMember(leagueId, member.uid))
                            }
                          >
                            Approve
                          </Button>
                        ) : null}
                        {member.role === 'member' ? (
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                setMemberRole(leagueId, member.uid, 'admin'),
                              )
                            }
                          >
                            Make league admin
                          </Button>
                        ) : !isOwner ? (
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                setMemberRole(leagueId, member.uid, 'member'),
                              )
                            }
                          >
                            Make member
                          </Button>
                        ) : null}
                        {!isOwner ? (
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={() => setConfirm({ kind: 'transfer', member })}
                          >
                            Transfer owner
                          </Button>
                        ) : null}
                        {!isOwner ? (
                          <Button
                            size="small"
                            color="error"
                            disabled={busy}
                            onClick={() => setConfirm({ kind: 'remove', member })}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>No members on this league.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </Stack>

      <Dialog
        open={confirm !== null}
        onClose={() => (busy ? undefined : setConfirm(null))}
      >
        <DialogTitle>
          {confirm?.kind === 'transfer'
            ? 'Transfer league ownership?'
            : 'Remove this member?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirm?.kind === 'transfer'
              ? `${confirm.member.displayName || confirm.member.email} will become the league owner. The current owner stays a league admin unless you demote them later.`
              : `${confirm?.member.displayName || confirm?.member.email} will lose access until they request to join again.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            color={confirm?.kind === 'remove' ? 'error' : 'primary'}
            variant="contained"
            disabled={busy || !confirm}
            onClick={() => {
              if (!confirm) return;
              if (confirm.kind === 'transfer') {
                void run(() => transferLeagueOwner(leagueId, confirm.member.uid));
              } else {
                void run(() => removeMember(leagueId, confirm.member.uid));
              }
            }}
          >
            {confirm?.kind === 'transfer' ? 'Transfer owner' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppAdminGate>
  );
}
