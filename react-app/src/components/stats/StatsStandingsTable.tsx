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
          <TableCell align="right">Games</TableCell>
          <TableCell align="right">Win%</TableCell>
          <TableCell align="right">Matches</TableCell>
          <TableCell align="right">Match win%</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.teamId}>
            <TableCell>{row.teamName}</TableCell>
            <TableCell align="right">
              {formatRecord(row.gamesWon, row.gamesLost, row.gamesTied)}
            </TableCell>
            <TableCell align="right">{formatPct(row.gameWinPct)}</TableCell>
            <TableCell align="right">
              {formatRecord(row.matchesWon, row.matchesLost, row.matchesTied)}
            </TableCell>
            <TableCell align="right">{formatPct(row.matchWinPct)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
