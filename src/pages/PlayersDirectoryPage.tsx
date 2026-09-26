import {
  Alert,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../components/Ui';
import { listPlayersForDirectory } from '../domain/playerProfile';
import { viewerLeaguesHref } from '../domain/viewerRoutes';
import { useDatabase } from '../state/DatabaseContext';
import { useLeague } from '../state/LeagueContext';
import { useViewerMode } from '../state/ViewerModeContext';

export function PlayersDirectoryPage() {
  const { data } = useDatabase();
  const { activeLeagueId, accessMode, leagues } = useLeague();
  const { routeBase } = useViewerMode();
  const [query, setQuery] = useState('');

  const leagueName =
    leagues.find((row) => row.id === activeLeagueId)?.name ?? null;
  const rows = useMemo(() => listPlayersForDirectory(data), [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.playerName.toLowerCase().includes(q) ||
        row.teamName.toLowerCase().includes(q),
    );
  }, [rows, query]);

  if (!activeLeagueId || accessMode !== 'view') {
    return (
      <Stack spacing={2} className="sk-viewer-players">
        <PageHeader>Players</PageHeader>
        <Alert severity="info">
          Open a league from{' '}
          <MuiLink component={Link} to={viewerLeaguesHref()} underline="hover">
            Leagues
          </MuiLink>{' '}
          to browse players.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2} className="sk-viewer-players">
      <PageHeader>Players{leagueName ? ` · ${leagueName}` : ''}</PageHeader>
      <TextField
        size="small"
        label="Search players"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="sk-viewer-players-search"
        sx={{ maxWidth: 360 }}
      />
      <Table size="small" className="sk-viewer-players-table">
        <TableHead>
          <TableRow>
            <TableCell>Player</TableCell>
            <TableCell>Team</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.playerId} hover>
              <TableCell>
                <MuiLink
                  component={Link}
                  to={`${routeBase}/players/${row.playerId}`}
                  underline="hover"
                  className="sk-viewer-player-link"
                >
                  {row.playerName}
                </MuiLink>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {row.teamName}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2}>
                <Typography color="text.secondary">No players found.</Typography>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Stack>
  );
}
