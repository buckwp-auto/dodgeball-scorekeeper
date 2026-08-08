import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { ResumeScoringCta } from '../components/ResumeScoringButton';
import { PageHeader } from '../components/Ui';
import { MAX_LEAGUE_NAME } from '../domain/limits';
import { useAuth } from '../state/AuthContext';
import { useDatabase } from '../state/DatabaseContext';
import {
  getStoredActiveLeagueId,
  useLeague,
} from '../state/LeagueContext';

const SAMPLE_LEAGUE_URL = `${import.meta.env.BASE_URL}samples/league-six-teams.scrkpr`;

type PendingImport = {
  raw: unknown;
  successLabel: string;
  source: 'file' | 'sample';
};

export function OverviewPage() {
  const { exportBytes, replaceDatabase } = useDatabase();
  const { configured, user, loading: authLoading, signInWithGoogle, signOut } =
    useAuth();
  const {
    leagues,
    memberships,
    membersByLeague,
    activeLeagueId,
    canOverrideActiveLeague,
    syncError,
    refreshing,
    refreshDirectory,
    createNewLeague,
    requestJoin,
    approveMember,
    rejectMember,
    openLeague,
    leaveLeague,
  } = useLeague();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<'file' | 'sample' | null>(null);
  const [leagueBusy, setLeagueBusy] = useState<string | null>(null);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const busy = loading !== null || leagueBusy !== null;
  const storedLeagueId = useMemo(() => getStoredActiveLeagueId(), [activeLeagueId]);
  const activeLeague = leagues.find((row) => row.id === activeLeagueId);
  const importBlockedForMember = Boolean(activeLeagueId && !canOverrideActiveLeague);

  const downloadDatabase = () => {
    const bytes = exportBytes();
    const blob = new Blob([bytes], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Dodgeball Database.scrkpr';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const applyImport = async (pending: PendingImport, overrideCloud: boolean) => {
    setErrorMessage(null);
    setSuccessOpen(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    replaceDatabase(pending.raw, {
      overrideCloudLeague: overrideCloud,
    });
    setSuccessMessage(
      overrideCloud
        ? `${pending.successLabel} Shared league data was replaced and is saving to the cloud.`
        : pending.successLabel,
    );
    setSuccessOpen(true);
  };

  const beginImport = async (raw: unknown, successLabel: string, source: 'file' | 'sample') => {
    if (importBlockedForMember) {
      throw new Error(
        'Only the league admin can replace shared data while a cloud league is open. Leave the league to edit a local copy, or ask the admin to import.',
      );
    }
    if (activeLeagueId && canOverrideActiveLeague) {
      setPendingImport({ raw, successLabel, source });
      return;
    }
    await applyImport({ raw, successLabel, source }, false);
  };

  const confirmOverride = async () => {
    if (!pendingImport) return;
    setLoading(pendingImport.source);
    try {
      await applyImport(pendingImport, true);
      setPendingImport(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Could not load database: ${detail}`);
    } finally {
      setLoading(null);
    }
  };

  const onFile = async (file: File) => {
    setLoading('file');
    try {
      const text = await file.text();
      await beginImport(
        JSON.parse(text),
        `Loaded “${file.name}” successfully.`,
        'file',
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Could not load database: ${detail}`);
    } finally {
      setLoading(null);
    }
  };

  const onLoadSampleLeague = async () => {
    setLoading('sample');
    try {
      const response = await fetch(SAMPLE_LEAGUE_URL);
      if (!response.ok) {
        throw new Error(`Could not fetch sample (${response.status})`);
      }
      const raw: unknown = await response.json();
      await beginImport(
        raw,
        'Loaded sample league (demo) — six teams with matches and games.',
        'sample',
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Could not load sample league: ${detail}`);
    } finally {
      setLoading(null);
    }
  };

  const runLeagueAction = async (key: string, action: () => Promise<void>) => {
    setLeagueBusy(key);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setLeagueBusy(null);
    }
  };

  return (
    <>
      <PageHeader>Overview</PageHeader>

      <Stack spacing={3}>
        <ResumeScoringCta />

        <Box>
          <Typography variant="h6" gutterBottom>
            Account
          </Typography>
          {!configured ? (
            <Alert severity="info">
              Firebase is not configured. Local import/export still works. Add{' '}
              <code>VITE_FIREBASE_*</code> env vars to enable shared leagues.
            </Alert>
          ) : authLoading ? (
            <CircularProgress size={24} />
          ) : user ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="body2">
                Signed in as {user.displayName || user.email}
              </Typography>
              <Button size="small" variant="outlined" onClick={() => void signOut()}>
                Sign out
              </Button>
              {activeLeagueId ? (
                <Button
                  size="small"
                  variant="outlined"
                  disabled={busy}
                  onClick={() =>
                    void runLeagueAction('leave', async () => {
                      await leaveLeague();
                      setSuccessMessage('Left cloud league (local data kept).');
                      setSuccessOpen(true);
                    })
                  }
                >
                  Leave cloud league
                </Button>
              ) : null}
            </Stack>
          ) : (
            <Button
              variant="contained"
              onClick={() =>
                void runLeagueAction('signin', async () => {
                  await signInWithGoogle();
                })
              }
            >
              Sign in with Google
            </Button>
          )}
          {activeLeague ? (
            <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
              Connected to “{activeLeague.name}”
            </Typography>
          ) : null}
          {syncError ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {syncError}
            </Alert>
          ) : null}
        </Box>

        {configured && user ? (
          <Box>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap' }}
            >
              <Typography variant="h6">Leagues</Typography>
              <Button
                size="small"
                disabled={refreshing || busy}
                onClick={() => void refreshDirectory()}
              >
                Refresh
              </Button>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'flex-end', mb: 2, flexWrap: 'wrap' }}
            >
              <TextField
                size="small"
                label="New league name"
                value={newLeagueName}
                slotProps={{ htmlInput: { maxLength: MAX_LEAGUE_NAME } }}
                onChange={(event) => setNewLeagueName(event.target.value)}
                sx={{ minWidth: 240 }}
              />
              <Button
                variant="contained"
                disabled={busy || !newLeagueName.trim()}
                onClick={() =>
                  void runLeagueAction('create', async () => {
                    const id = await createNewLeague(newLeagueName);
                    setNewLeagueName('');
                    await openLeague(id);
                    setSuccessMessage('League created and opened.');
                    setSuccessOpen(true);
                  })
                }
              >
                Create league
              </Button>
            </Stack>

            {refreshing && leagues.length === 0 ? (
              <CircularProgress size={24} />
            ) : (
              <Table size="small" className="sk-grid">
                <TableHead>
                  <TableRow>
                    <TableCell>League</TableCell>
                    <TableCell>Admin</TableCell>
                    <TableCell>Your status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leagues.map((league) => {
                    const membership = memberships[league.id];
                    const status = membership?.status;
                    const isActive = activeLeagueId === league.id;
                    const canOpen = status === 'active';
                    return (
                      <TableRow key={league.id} selected={isActive}>
                        <TableCell>{league.name}</TableCell>
                        <TableCell>{league.adminDisplayName || league.adminEmail}</TableCell>
                        <TableCell>
                          {status ?? (storedLeagueId === league.id ? '—' : 'none')}
                          {isActive ? ' (open)' : ''}
                        </TableCell>
                        <TableCell align="right">
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ justifyContent: 'flex-end' }}
                          >
                            {canOpen ? (
                              <Button
                                size="small"
                                variant={isActive ? 'outlined' : 'contained'}
                                disabled={busy || isActive}
                                onClick={() =>
                                  void runLeagueAction(`open-${league.id}`, async () => {
                                    await openLeague(league.id);
                                    setSuccessMessage(`Opened “${league.name}”.`);
                                    setSuccessOpen(true);
                                  })
                                }
                              >
                                {isActive ? 'Opened' : 'Open'}
                              </Button>
                            ) : null}
                            {!membership || status === 'rejected' ? (
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={busy}
                                onClick={() =>
                                  void runLeagueAction(`join-${league.id}`, async () => {
                                    await requestJoin(league.id);
                                    setSuccessMessage('Join request sent.');
                                    setSuccessOpen(true);
                                  })
                                }
                              >
                                Request to join
                              </Button>
                            ) : null}
                            {status === 'pending' ? (
                              <Chip size="small" label="Pending" />
                            ) : null}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {leagues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        No leagues yet. Create one to get started.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}

            {leagues.map((league) => {
              const pending =
                membersByLeague[league.id]?.filter((m) => m.status === 'pending') ??
                [];
              if (pending.length === 0) return null;
              return (
                <Box key={`pending-${league.id}`} sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Pending requests — {league.name}
                  </Typography>
                  <Stack spacing={1}>
                    {pending.map((member) => (
                      <Stack
                        key={member.uid}
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center' }}
                      >
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {member.displayName || member.email}
                        </Typography>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={busy}
                          onClick={() =>
                            void runLeagueAction(
                              `approve-${member.uid}`,
                              async () => {
                                await approveMember(league.id, member.uid);
                              },
                            )
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          disabled={busy}
                          onClick={() =>
                            void runLeagueAction(
                              `reject-${member.uid}`,
                              async () => {
                                await rejectMember(league.id, member.uid);
                              },
                            )
                          }
                        >
                          Reject
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        ) : null}

        <Divider />

        <Box>
          <Typography variant="h6" gutterBottom>
            {activeLeagueId ? 'Import / export' : 'Local database'}
          </Typography>
          {activeLeagueId ? (
            <Alert severity={importBlockedForMember ? 'warning' : 'info'} sx={{ mb: 2 }}>
              {importBlockedForMember
                ? 'A cloud league is open. Only the league admin can replace shared data from a file. You can still download a copy, or leave the league to work locally.'
                : `Connected to “${activeLeague?.name ?? 'league'}”. Loading a file will ask for confirmation, then replace the shared cloud data for all members.`}
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Load a .scrkpr file locally, then open (or create) a cloud league as admin and
              import again to publish it — or open the league first and import with override.
            </Typography>
          )}
          <Stack
            direction="row"
            spacing={1}
            className="button-row"
            sx={{ flexWrap: 'wrap', alignItems: 'center' }}
          >
            <Button
              type="button"
              className="bw-button bw-button--text"
              variant="contained"
              disabled={busy}
              onClick={downloadDatabase}
            >
              Download Database
            </Button>
            <Button
              type="button"
              className="bw-button bw-button--text"
              variant="outlined"
              disabled={busy || importBlockedForMember}
              onClick={() => fileInputRef.current?.click()}
              startIcon={
                loading === 'file' ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              {loading === 'file' ? 'Loading…' : 'Load from file'}
            </Button>
            <Button
              type="button"
              className="bw-button bw-button--text"
              variant="outlined"
              disabled={busy || importBlockedForMember}
              onClick={() => void onLoadSampleLeague()}
              startIcon={
                loading === 'sample' ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              {loading === 'sample' ? 'Loading…' : 'Load sample league (demo)'}
            </Button>
          </Stack>

          {loading ? (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 2 }}>
              <CircularProgress size={28} />
              <Alert severity="info" sx={{ flex: 1 }}>
                {loading === 'sample'
                  ? 'Importing sample league…'
                  : 'Importing database…'}
              </Alert>
            </Stack>
          ) : null}
        </Box>
      </Stack>

      <Dialog
        open={pendingImport !== null}
        onClose={() => (busy ? undefined : setPendingImport(null))}
      >
        <DialogTitle>Replace shared league data?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to overwrite the cloud league
            {activeLeague ? ` “${activeLeague.name}”` : ''} for every member. Teams,
            players, and matches on the server will be replaced by this import. This cannot
            be undone except by importing another backup.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setPendingImport(null)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            onClick={() => void confirmOverride()}
          >
            Yes, replace league data
          </Button>
        </DialogActions>
      </Dialog>

      {errorMessage ? (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      ) : null}

      <Snackbar
        open={successOpen}
        autoHideDuration={4000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSuccessOpen(false)}
        >
          {successMessage}
        </Alert>
      </Snackbar>

      <input
        ref={fileInputRef}
        type="file"
        accept=".scrkpr"
        style={{ display: 'none' }}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
          event.target.value = '';
        }}
      />
    </>
  );
}
