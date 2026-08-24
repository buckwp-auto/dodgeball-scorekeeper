import CloseIcon from '@mui/icons-material/Close';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ImageRef } from '../domain/imageRef';
import type { PlayerMatchCandidate } from '../domain/playerMatch';
import { HotkeyBadge } from './HotkeyBadge';
import { EntityAvatar } from './EntityAvatar';
import { TextButton } from './Ui';

export function PlayerRoster({
  side,
  teamName,
  teamImage,
  players,
  onToggle,
  hotkeyForPlayerId,
  eliminatedPlayerIds,
  onToggleSubstitute,
  onRemove,
  canRemovePlayer,
  addPlayer,
}: {
  side: 'Home Team' | 'Away Team';
  teamName: string;
  teamImage?: ImageRef | null;
  players: {
    player: { Id: string; Name: string; Image?: ImageRef | null };
    selected: boolean;
    substitute?: boolean;
  }[];
  onToggle: (playerId: string) => void;
  hotkeyForPlayerId?: (playerId: string) => string | null;
  eliminatedPlayerIds?: ReadonlySet<string>;
  onToggleSubstitute?: (playerId: string) => void;
  onRemove?: (playerId: string) => void;
  canRemovePlayer?: (playerId: string) => boolean;
  addPlayer?: {
    name: string;
    asSub: boolean;
    suggestions?: PlayerMatchCandidate[];
    onNameChange: (value: string) => void;
    onAsSubChange: (value: boolean) => void;
    onSubmit: (candidate?: PlayerMatchCandidate) => void;
  };
}) {
  const suggestionLabel = (option: PlayerMatchCandidate) =>
    option.sameTeam
      ? `${option.playerName} (on this team)`
      : `${option.playerName} · ${option.teamName}`;

  return (
    <Paper variant="outlined" className="sk-team" sx={{ p: 2 }}>
      <Box className="sk-team-header">
        <Typography component="h2" variant="h6">
          {side}
        </Typography>
      </Box>
      <Stack
        direction="row"
        spacing={1}
        className="sk-banner"
        sx={{ alignItems: 'center', mb: 1 }}
      >
        <EntityAvatar name={teamName} image={teamImage} size={28} />
        <Typography variant="subtitle1" color="primary">
          {teamName}
        </Typography>
      </Stack>
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
            <EntityAvatar name={player.Name} image={player.Image} size={24} />
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
            {onRemove && (canRemovePlayer?.(player.Id) ?? true) ? (
              <IconButton
                size="small"
                aria-label={`Remove ${player.Name}`}
                className="sk-remove-player"
                onClick={() => onRemove(player.Id)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Stack>
        );
      })}
      {addPlayer ? (
        <Stack spacing={1} sx={{ mt: 2 }} className="sk-add-match-player">
          <Autocomplete
            freeSolo
            options={addPlayer.suggestions ?? []}
            filterOptions={(options) => options}
            inputValue={addPlayer.name}
            onInputChange={(_, value, reason) => {
              if (reason !== 'input' && reason !== 'clear') return;
              addPlayer.onNameChange(value);
            }}
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : suggestionLabel(option)
            }
            isOptionEqualToValue={(option, value) =>
              typeof value !== 'string' && option.playerId === value.playerId
            }
            onChange={(_, value) => {
              if (!value) return;
              if (typeof value === 'string') {
                if (value.trim()) addPlayer.onSubmit();
                return;
              }
              if (!value.sameTeam) addPlayer.onAsSubChange(true);
              addPlayer.onSubmit(value);
            }}
            renderOption={(props, option) => (
              <li {...props} key={option.playerId} className="sk-add-player-suggestion">
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <EntityAvatar name={option.playerName} image={option.image} size={24} />
                  <span>{suggestionLabel(option)}</span>
                </Stack>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} size="small" label="Add player" fullWidth />
            )}
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
              onClick={() => addPlayer.onSubmit()}
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
