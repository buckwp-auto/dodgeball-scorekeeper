import { Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { EntityAvatar } from '../components/EntityAvatar';
import { ImageUrlField } from '../components/ImageUrlField';
import { FormOneLine, PageHeader, TextButton } from '../components/Ui';
import {
  getPlayersForTeam,
  getTeam,
  playerIsUsedInMatches,
  teamIsUsedInMatches,
} from '../domain/database';
import { MAX_PLAYER_NAME, MAX_TEAM_NAME } from '../domain/limits';
import { useDatabase } from '../state/DatabaseContext';

export function TeamPage() {
  const { teamId = '' } = useParams();
  const navigate = useNavigate();
  const {
    data,
    addPlayer,
    renamePlayer,
    deletePlayer,
    renameTeam,
    deleteTeam,
    setTeamImage,
    setPlayerImage,
  } = useDatabase();
  const [playerName, setPlayerName] = useState('');
  const [editingTeam, setEditingTeam] = useState(false);
  const [teamEditName, setTeamEditName] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [playerEditName, setPlayerEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const team = getTeam(data, teamId);
  const players = team ? getPlayersForTeam(data, teamId) : [];

  if (!team) {
    return <PageHeader>Team</PageHeader>;
  }

  const submit = () => {
    if (!playerName.trim()) return;
    addPlayer(teamId, playerName);
    setPlayerName('');
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

      <FormOneLine
        label="Player Name"
        buttonText="Add Player"
        value={playerName}
        onValueChange={setPlayerName}
        onSubmit={submit}
        canSubmit={playerName.trim().length > 0}
        maxLength={MAX_PLAYER_NAME}
      />
      {error ? (
        <p className="sk-error" style={{ color: '#c62828' }}>
          {error}
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
                      <TextButton onClick={() => navigate(`/players/${player.Id}`)}>
                        {player.Name}
                      </TextButton>
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
