import { Stack, Typography } from '@mui/material';
import {
  formatThrowTagMix,
  throwTagTallyTotal,
  type DisplayPlayerStats,
} from '../../domain/statistics/displayStats';

export function ThrowTagsSummary({
  stats,
}: {
  stats: DisplayPlayerStats;
}) {
  const thrown = formatThrowTagMix(stats.throwTagsThrown);
  const taken = formatThrowTagMix(stats.throwTagsTaken);
  if (thrown.length === 0 && taken.length === 0) return null;

  const line = (rows: { label: string; count: number }[]) =>
    rows.map((row) => `${row.label} ${row.count}`).join(' · ');

  return (
    <Stack spacing={0.5} className="sk-throw-tags-summary" sx={{ mt: 2 }}>
      <Typography variant="h6">Throw tags</Typography>
      {thrown.length > 0 ? (
        <Typography variant="body2">
          Thrown ({throwTagTallyTotal(stats.throwTagsThrown)}): {line(thrown)}
        </Typography>
      ) : null}
      {taken.length > 0 ? (
        <Typography variant="body2">
          Taken ({throwTagTallyTotal(stats.throwTagsTaken)}): {line(taken)}
        </Typography>
      ) : null}
    </Stack>
  );
}
