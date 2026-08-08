import { Chip, Stack, Typography } from '@mui/material';
import type { MatchSeries } from '../../domain/statistics/teamStandings';

const resultLabel: Record<MatchSeries['games'][number]['result'], string> = {
  home: 'Home',
  away: 'Away',
  tie: 'Tie',
  unfinished: 'In progress',
};

export function MatchSeriesScoreboard({ series }: { series: MatchSeries }) {
  const score = `${series.homeGameWins}–${series.awayGameWins}`;
  return (
    <Stack spacing={1} className="sk-stats-series" sx={{ mb: 2 }}>
      <Typography variant="subtitle1">
        {series.homeTeam.Name} vs. {series.awayTeam.Name}
        {series.games.some((game) => game.result !== 'unfinished') ? ` · ${score}` : ''}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {series.games.map((game) => (
          <Chip
            key={game.gameId}
            size="small"
            variant={game.result === 'unfinished' ? 'outlined' : 'filled'}
            color={
              game.result === 'home'
                ? 'primary'
                : game.result === 'away'
                  ? 'secondary'
                  : 'default'
            }
            label={`${game.label} · ${resultLabel[game.result]}`}
          />
        ))}
      </Stack>
    </Stack>
  );
}
