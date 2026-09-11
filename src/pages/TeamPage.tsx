import {
  Autocomplete,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { EntityAvatar } from '../components/EntityAvatar';
import { ImageUrlField } from '../components/ImageUrlField';
import { PageHeader, TextButton } from '../components/Ui';
import {
  addPlayer as addPlayerOp,
  getPlayer,
  getPlayersForTeam,
  getTeam,
  playerIsUsedInMatches,
  setPlayerImage as setPlayerImageOp,
  teamIsUsedInMatches,
} from '../domain/database';
import { imageSrc } from '../domain/imageRef';
import { linkedPlayerLabel } from '../domain/playerMatch';
import { playerHref } from '../domain/playerProfile';
import {
  suggestUniversePlayers,
  universePlayerLabel,
  type UniversePlayerCandidate,
} from '../domain/playerUniverse';
import { MAX_PLAYER_NAME, MAX_TEAM_NAME } from '../domain/limits';
import { usePlayerUniverse } from '../hooks/usePlayerUniverse';
import { useDatabase } from '../state/DatabaseContext';

export function TeamPage() {
  const { teamId = '' } = useParams();
  const navigate = useNavigate();
  const {
    data,
    renamePlayer,
    deletePlayer,
    renameTeam,
    deleteTeam,
    setTeamImage,
    setPlayerImage,
    mutate,
  } = useDatabase();
  const { universe, error: universeError } = usePlayerUniverse();
  const [playerName, setPlayerName] = useState('');
  const [editingTeam, setEditingTeam] = useState(false);
  const [teamEditName, setTeamEditName] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [playerEditName, setPlayerEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const team = getTeam(data, teamId);
  const players = team ? getPlayersForTeam(data, teamId) : [];
  const suggestions = useMemo(
    () =>
      suggestUniversePlayers(universe, {
        query: playerName,
        excludeNames: players.map((player) => player.Name),
      }),
    [universe, playerName, players],
  );

  if (!team) {
    return <PageHeader>Team</PageHeader>;
  }

  const submit = (candidate?: UniversePlayerCandidate) => {
    const name = (candidate?.playerName ?? playerName).trim();
    if (!name) return;
    const photoUrl = candidate ? imageSrc(candidate.image) : null;
    mutate(
      (draft) => {
        const player = addPlayerOp(draft, teamId, name);
        if (photoUrl) setPlayerImageOp(draft, player.Id, photoUrl);
        return {
          playerName: player.Name,
          teamName: team.Name,
        };
      },
      ({ playerName: addedName, teamName }) =>
        `Added player (${addedName}) to team (${teamName}).`,
    );
    setPlayerName('');
    setError(null);
  };

  const saveTeamName = () => {
    if (!teamEditName.trim()) return;
    renameTeam(teamId, teamEditName);
    setEditingTeam(false);
  };

  const onDeleteTeam = () => {
    if (teamIsUsedInMatches(data, teamId)) {
      setError('Cannot delete this team — it is used in a match.');
      return;
    }
    if (!window.confirm(`Delete team “${team.Name}” and its players?`)) return;
    try {
      deleteTeam(teamId);
      navigate('/teams');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const savePlayerName = () => {
    if (!editingPlayerId || !playerEditName.trim()) return;
    renamePlayer(editingPlayerId, playerEditName);
    setEditingPlayerId(null);
    setPlayerEditName('');
  };

  const onDeletePlayer = (playerId: string, name: string) => {
    if (playerIsUsedInMatches(data, playerId)) {
      setError(`Cannot delete “${name}” — they are on a match roster.`);
      return;
    }
    if (!window.confirm(`Delete player “${name}”?`)) return;
    try {
      deletePlayer(playerId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const displayError = error ?? universeError;

  return (
    <>
      <PageHeader>Team</PageHeader>
      {editingTeam ? (
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap' }}
        >
          <TextField
            size="small"
            label="Team name"
            value={teamEditName}
            slotProps={{ htmlInput: { maxLength: MAX_TEAM_NAME } }}
            onChange={(event) => setTeamEditName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                saveTeamName();
              }
              if (event.key === 'Escape') setEditingTeam(false);
            }}
          />
          <Button size="small" variant="contained" onClick={saveTeamName}>
            Save
          </Button>
          <Button size="small" onClick={() => setEditingTeam(false)}>
            Cancel
          </Button>
        </Stack>
      ) : (
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap' }}
        >
          <EntityAvatar name={team.Name} image={team.Image} size={40} />
          <Typography variant="h6">{team.Name}</Typography>
          <Button
            size="small"
            onClick={() => {
              setTeamEditName(team.Name);
              setEditingTeam(true);
              setError(null);
            }}
          >
            Rename
          </Button>
          <Button size="small" color="error" onClick={onDeleteTeam}>
            Delete team
          </Button>
        </Stack>
      )}
      <Stack sx={{ mb: 2, maxWidth: 720 }}>
        <ImageUrlField
          label="Team logo URL"
          name={team.Name}
          image={team.Image}
          showAvatar={false}
          onSave={(url) => {
            try {
              setTeamImage(teamId, url);
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Image update failed');
            }
          }}
        />
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'flex-start', mb: 2, flexWrap: 'wrap' }}
        className="sk-add-team-player"
      >
        <Autocomplete
          freeSolo
          options={suggestions}
          filterOptions={(options) => options}
          inputValue={playerName}
          onInputChange={(_, value, reason) => {
            if (reason !== 'input' && reason !== 'clear') return;
            setPlayerName(value);
          }}
          getOptionLabel={(option) =>
            typeof option === 'string' ? option : universePlayerLabel(option)
          }
          isOptionEqualToValue={(option, value) =>
            typeof value !== 'string' && option.key === value.key
          }
          onChange={(_, value) => {
            if (!value) return;
            if (typeof value === 'string') {
              if (value.trim()) submit();
              return;
            }
            submit(value);
          }}
          renderOption={(props, option) => (
            <li {...props} key={option.key} className="sk-add-player-suggestion">
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <EntityAvatar
                  name={option.playerName}
                  image={option.image}
                  size={24}
                />
                <span>{universePlayerLabel(option)}</span>
              </Stack>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Player Name"
              slotProps={{
                ...params.slotProps,
                htmlInput: {
                  ...params.slotProps.htmlInput,
                  maxLength: MAX_PLAYER_NAME,
                },
              }}
              sx={{ minWidth: 260 }}
            />
          )}
          sx={{ flex: '1 1 260px', maxWidth: 480 }}
        />
        <Button
          size="small"
          variant="contained"
          disabled={!playerName.trim()}
          onClick={() => submit()}
          sx={{ mt: 0.5 }}
        >
          Add Player
        </Button>
      </Stack>
      {displayError ? (
        <p className="sk-error" style={{ color: '#c62828' }}>
          {displayError}
        </p>
      ) : null}
      <table className="sk-grid">
        <tbody>
          {players.map((player) => (
            <tr key={player.Id}>
              <td>
                {editingPlayerId === player.Id ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <TextField
                      size="small"
                      value={playerEditName}
                      slotProps={{ htmlInput: { maxLength: MAX_PLAYER_NAME } }}
                      onChange={(event) => setPlayerEditName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          savePlayerName();
                        }
                        if (event.key === 'Escape') setEditingPlayerId(null);
                      }}
                      sx={{ minWidth: 180 }}
                    />
                    <Button
                      size="small"
                      variant="contained"
                      onClick={savePlayerName}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setEditingPlayerId(null)}
                    >
                      Cancel
                    </Button>
                  </Stack>
                ) : (
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <EntityAvatar name={player.Name} image={player.Image} size={28} />
                      <TextButton
                        onClick={() =>
                          navigate(playerHref(player.LinkedPlayerId ?? player.Id))
                        }
                      >
                        {player.Name}
                      </TextButton>
                      {player.LinkedPlayerId ? (
                        <Chip
                          size="small"
                          color="secondary"
                          label={
                            linkedPlayerLabel(data, player) ??
                            `sub for ${getPlayer(data, player.LinkedPlayerId)?.Name ?? 'player'}`
                          }
                          className="sk-player-linked"
                        />
                      ) : null}
                      <Button
                        size="small"
                        onClick={() => {
                          setEditingPlayerId(player.Id);
                          setPlayerEditName(player.Name);
                          setError(null);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => onDeletePlayer(player.Id, player.Name)}
                      >
                        Delete
                      </Button>
                    </Stack>
                    <ImageUrlField
                      label="Player photo URL"
                      name={player.Name}
                      image={player.Image}
                      size={28}
                      showAvatar={false}
                      onSave={(url) => {
                        try {
                          setPlayerImage(player.Id, url);
                          setError(null);
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : 'Image update failed',
                          );
                        }
                      }}
                    />
                  </Stack>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
