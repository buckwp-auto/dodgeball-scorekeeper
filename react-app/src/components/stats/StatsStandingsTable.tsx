import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { formatPct, formatRecord } from '../../domain/statistics/displayStats';
import type { TeamStanding } from '../../domain/statistics/teamStandings';

export function StatsStandingsTable({ rows }: { rows: TeamStanding[] }) {
  if (rows.length === 0) {
    return <p>No team standings yet.</p>;
  }

  return (
    <Table size="small" className="sk-grid sk-stats-standings">
      <TableHead>
        <TableRow>
          <TableCell>Team</TableCell>
          <TableCell align="center">Games</TableCell>
          <TableCell align="center">Win%</TableCell>
          <TableCell align="center">Matches</TableCell>
          <TableCell align="center">Match win%</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.teamId}>
            <TableCell>{row.teamName}</TableCell>
            <TableCell align="center">
              {formatRecord(row.gamesWon, row.gamesLost, row.gamesTied)}
            </TableCell>
            <TableCell align="center">{formatPct(row.gameWinPct)}</TableCell>
            <TableCell align="center">
              {formatRecord(row.matchesWon, row.matchesLost, row.matchesTied)}
            </TableCell>
            <TableCell align="center">{formatPct(row.matchWinPct)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
