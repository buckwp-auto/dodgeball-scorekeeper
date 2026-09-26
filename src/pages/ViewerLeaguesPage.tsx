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
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { EntityAvatar } from '../components/EntityAvatar';
import { PageHeader } from '../components/Ui';
import { viewerStatsHref } from '../domain/viewerRoutes';
import { useAuth } from '../state/AuthContext';
import {
  getStoredViewLeagueId,
  useLeague,
} from '../state/LeagueContext';
import { useViewerOnboarding } from '../state/ViewerOnboardingContext';

export function ViewerLeaguesPage() {
  const navigate = useNavigate();
  const { startTour } = useViewerOnboarding();
  const {
    configured,
    user,
    loading: authLoading,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const {
    leagues,
    activeLeagueId,
    accessMode,
    syncError,
    refreshing,
    refreshDirectory,
    openLeagueForView,
    leaveLeague,
  } = useLeague();

  const [leagueBusy, setLeagueBusy] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoViewTried, setAutoViewTried] = useState(false);

  useEffect(() => {
    if (!user || activeLeagueId || autoViewTried || refreshing) return;
    const stored = getStoredViewLeagueId();
    setAutoViewTried(true);
    if (!stored) return;
    setLeagueBusy(stored);
    void openLeagueForView(stored)
      .catch((error) => {
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to reopen league',
        );
      })
      .finally(() => setLeagueBusy(null));
  }, [
    user,
    activeLeagueId,
    autoViewTried,
    refreshing,
    openLeagueForView,
  ]);

  const run = async (leagueId: string, action: () => Promise<unknown>) => {
    setLeagueBusy(leagueId);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Something went wrong',
      );
    } finally {
      setLeagueBusy(null);
    }
  };

  if (!configured) {
    return (
      <Stack
        spacing={2}
        className="sk-viewer-leagues"
        data-onboarding="viewer-leagues-main"
      >
        <PageHeader>League stats</PageHeader>
        <Alert severity="info">
          Cloud leagues are not configured in this build. Sign-in and stats
          viewing require Firebase.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack
      spacing={2}
      className="sk-viewer-leagues"
      data-onboarding="viewer-leagues-main"
    >
      <PageHeader>League stats</PageHeader>
      <Typography variant="body2" color="text.secondary">
        Sign in with Google to browse league standings, leaderboards, and player
        pages. Viewing is read-only — scorekeeping stays in the main app.
      </Typography>
      <Button
        size="small"
        variant="text"
        onClick={startTour}
        className="sk-viewer-start-tour"
        sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
      >
        Restart tour
      </Button>

      {authLoading ? (
        <CircularProgress size={24} />
      ) : user ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2">
            Signed in as {user.displayName || user.email}
          </Typography>
          <Button
            size="small"
            onClick={() => void signOut()}
            className="sk-viewer-sign-out"
          >
            Sign out
          </Button>
          <Button
            size="small"
            onClick={() => void refreshDirectory()}
            disabled={refreshing || Boolean(leagueBusy)}
            className="sk-viewer-refresh"
          >
            Refresh
          </Button>
        </Stack>
      ) : (
        <Button
          variant="contained"
          onClick={() => void signInWithGoogle()}
          className="sk-viewer-sign-in"
        >
          Sign in with Google
        </Button>
      )}

      {syncError ? <Alert severity="error">{syncError}</Alert> : null}
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      {user ? (
        <Table size="small" className="sk-viewer-league-table">
          <TableHead>
            <TableRow>
              <TableCell>League</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leagues.map((league) => {
              const isActive =
                activeLeagueId === league.id && accessMode === 'view';
              const busy = leagueBusy === league.id;
              return (
                <TableRow key={league.id} selected={isActive}>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <EntityAvatar
                        name={league.name}
                        image={league.logo}
                        size={32}
                      />
                      <Typography>{league.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}
                    >
                      {isActive ? (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => navigate(viewerStatsHref())}
                            className="sk-viewer-open-stats"
                          >
                            View stats
                          </Button>
                          <Button
                            size="small"
                            onClick={() =>
                              void run(league.id, () => leaveLeague())
                            }
                            disabled={busy}
                            className="sk-viewer-close-league"
                          >
                            Close
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={busy || Boolean(leagueBusy)}
                          onClick={() =>
                            void run(league.id, async () => {
                              await openLeagueForView(league.id);
                              navigate(viewerStatsHref());
                            })
                          }
                          className="sk-viewer-view-league"
                        >
                          {busy ? 'Opening…' : 'View'}
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {leagues.length === 0 && !refreshing ? (
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography color="text.secondary">
                    No leagues yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      ) : null}
    </Stack>
  );
}
