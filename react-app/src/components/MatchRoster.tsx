import { Box, Paper, Stack, Typography } from '@mui/material';
import { HotkeyBadge } from './HotkeyBadge';
import { TextButton } from './Ui';

export function PlayerRoster({
  side,
  teamName,
  players,
  onToggle,
  hotkeyForPlayerId,
  eliminatedPlayerIds,
}: {
  side: 'Home Team' | 'Away Team';
  teamName: string;
  players: { player: { Id: string; Name: string }; selected: boolean }[];
  onToggle: (playerId: string) => void;
  hotkeyForPlayerId?: (playerId: string) => string | null;
  eliminatedPlayerIds?: ReadonlySet<string>;
}) {
  return (
    <Paper variant="outlined" className="sk-team" sx={{ p: 2 }}>
      <Box className="sk-team-header">
        <Typography component="h2" variant="h6">
          {side}
        </Typography>
      </Box>
      <Typography className="sk-banner" variant="subtitle1" color="primary" gutterBottom>
        {teamName}
      </Typography>
      {players.map(({ player, selected }) => {
        const eliminated = eliminatedPlayerIds?.has(player.Id) ?? false;
        return (
          <Stack
            key={player.Id}
            direction="row"
            spacing={1}
            className="sk-player"
            sx={{
              alignItems: 'center',
              opacity: eliminated ? 0.5 : 1,
              order: eliminated ? 2 : 1,
            }}
          >
            <Typography aria-hidden>{selected ? '■' : '□'}</Typography>
            <HotkeyBadge hotkey={hotkeyForPlayerId?.(player.Id) ?? null} />
            <Box sx={{ flex: 1 }}>
              <TextButton expand onClick={() => onToggle(player.Id)}>
                {eliminated ? `${player.Name} (out)` : player.Name}
              </TextButton>
            </Box>
          </Stack>
        );
      })}
    </Paper>
  );
}

export function MatchPageHeader({ title }: { title: string }) {
  return <Typography component="h1" variant="h4">{title}</Typography>;
}
