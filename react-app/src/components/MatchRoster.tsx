import { Box, Button, Checkbox, Chip, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { HotkeyBadge } from './HotkeyBadge';
import { TextButton } from './Ui';
import { MAX_PLAYER_NAME } from '../domain/limits';

export function PlayerRoster({
  side,
  teamName,
  players,
  onToggle,
  hotkeyForPlayerId,
  eliminatedPlayerIds,
  onToggleSubstitute,
  addPlayer,
}: {
  side: 'Home Team' | 'Away Team';
  teamName: string;
  players: { player: { Id: string; Name: string }; selected: boolean; substitute?: boolean }[];
  onToggle: (playerId: string) => void;
  hotkeyForPlayerId?: (playerId: string) => string | null;
  eliminatedPlayerIds?: ReadonlySet<string>;
  onToggleSubstitute?: (playerId: string) => void;
  addPlayer?: {
    name: string;
    asSub: boolean;
    onNameChange: (value: string) => void;
    onAsSubChange: (value: boolean) => void;
    onSubmit: () => void;
  };
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
      {players.map(({ player, selected, substitute }) => {
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
            {onToggleSubstitute && selected ? (
              <Chip
                size="small"
                label="Sub"
                color={substitute ? 'secondary' : 'default'}
                variant={substitute ? 'filled' : 'outlined'}
                onClick={() => onToggleSubstitute(player.Id)}
                className="sk-player-sub"
                aria-pressed={Boolean(substitute)}
              />
            ) : substitute ? (
              <Chip
                size="small"
                label="Sub"
                color="secondary"
                className="sk-player-sub"
              />
            ) : null}
          </Stack>
        );
      })}
      {addPlayer ? (
        <Stack spacing={1} sx={{ mt: 2 }} className="sk-add-match-player">
          <TextField
            size="small"
            label="Add player"
            value={addPlayer.name}
            onChange={(event) => addPlayer.onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (addPlayer.name.trim()) addPlayer.onSubmit();
              }
            }}
            slotProps={{ htmlInput: { maxLength: MAX_PLAYER_NAME } }}
            fullWidth
          />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={addPlayer.asSub}
                  onChange={(event) => addPlayer.onAsSubChange(event.target.checked)}
                />
              }
              label="Sub"
            />
            <Button
              size="small"
              variant="contained"
              className="bw-button bw-button--text"
              disabled={!addPlayer.name.trim()}
              onClick={addPlayer.onSubmit}
            >
              Add
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Paper>
  );
}

export function MatchPageHeader({ title }: { title: string }) {
  return <Typography component="h1" variant="h4">{title}</Typography>;
}
