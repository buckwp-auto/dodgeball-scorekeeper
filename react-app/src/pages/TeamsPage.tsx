import { Button, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FormOneLine, PageHeader, TextButton } from '../components/Ui';
import {
  getTeams,
  teamIsUsedInMatches,
} from '../domain/database';
import { MAX_TEAM_NAME } from '../domain/limits';
import { useDatabase } from '../state/DatabaseContext';

export function TeamsPage() {
  const { data, addTeam, renameTeam, deleteTeam } = useDatabase();
  const [teamName, setTeamName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const teams = getTeams(data);

  const submit = () => {
    if (!teamName.trim()) return;
    addTeam(teamName);
    setTeamName('');
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
    setError(null);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    renameTeam(editingId, editName);
    setEditingId(null);
    setEditName('');
  };

  const onDelete = (teamId: string, name: string) => {
    if (teamIsUsedInMatches(data, teamId)) {
      setError(`Cannot delete “${name}” — it is used in a match.`);
      return;
    }
    if (!window.confirm(`Delete team “${name}” and its players?`)) return;
    try {
      deleteTeam(teamId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <>
      <PageHeader>Teams</PageHeader>
      <FormOneLine
        label="Team Name"
        buttonText="Add Team"
        value={teamName}
        onValueChange={setTeamName}
        onSubmit={submit}
        canSubmit={teamName.trim().length > 0}
        maxLength={MAX_TEAM_NAME}
      />
      {error ? (
        <p className="sk-error" style={{ color: '#c62828' }}>
          {error}
        </p>
      ) : null}
      <table className="sk-grid">
        <tbody>
          {teams.map((team) => (
            <tr key={team.Id}>
              <td>
                {editingId === team.Id ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <TextField
                      size="small"
                      value={editName}
                      slotProps={{ htmlInput: { maxLength: MAX_TEAM_NAME } }}
                      onChange={(event) => setEditName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          saveEdit();
                        }
                        if (event.key === 'Escape') setEditingId(null);
                      }}
                      sx={{ minWidth: 180 }}
                    />
                    <Button size="small" variant="contained" onClick={saveEdit}>
                      Save
                    </Button>
                    <Button size="small" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </Stack>
                ) : (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <TextButton onClick={() => navigate(`/teams/${team.Id}`)}>
                      {team.Name}
                    </TextButton>
                    <Button
                      size="small"
                      className="bw-button bw-button--text"
                      onClick={() => startEdit(team.Id, team.Name)}
                    >
                      Rename
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      className="bw-button bw-button--text"
                      onClick={() => onDelete(team.Id, team.Name)}
                    >
                      Delete
                    </Button>
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
