import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { TargetHeatmap } from '../../domain/statistics/targetHeatmap';
import { heatmapCellKey } from '../../domain/statistics/targetHeatmap';

function cellBackground(throws: number, maxThrows: number): string {
  if (!throws || maxThrows <= 0) return 'transparent';
  const t = throws / maxThrows;
  return `rgba(21, 101, 192, ${0.12 + t * 0.72})`;
}

export function StatsHeatmap({ heatmap }: { heatmap: TargetHeatmap }) {
  if (heatmap.throwers.length === 0 || heatmap.targets.length === 0) {
    return null;
  }

  let maxThrows = 0;
  for (const cell of heatmap.cells.values()) {
    if (cell.throws > maxThrows) maxThrows = cell.throws;
  }

  return (
    <Box className="sk-stats-heatmap" sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Thrower → target
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" className="sk-grid sk-stats-heatmap-table">
          <TableHead>
            <TableRow>
              <TableCell>Thrower \ Target</TableCell>
              {heatmap.targets.map((target) => (
                <TableCell key={target.playerId} align="center">
                  {target.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {heatmap.throwers.map((thrower) => (
              <TableRow key={thrower.playerId}>
                <TableCell>{thrower.name}</TableCell>
                {heatmap.targets.map((target) => {
                  const cell = heatmap.cells.get(
                    heatmapCellKey(thrower.playerId, target.playerId),
                  );
                  const throws = cell?.throws ?? 0;
                  const hits = cell?.hits ?? 0;
                  return (
                    <TableCell
                      key={target.playerId}
                      align="center"
                      title={throws ? `${throws} throws, ${hits} hits` : undefined}
                      sx={{ bgcolor: cellBackground(throws, maxThrows) }}
                    >
                      {throws || '·'}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
