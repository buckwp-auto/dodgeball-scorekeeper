import { useState } from 'react';
import { useParams } from 'react-router';
import { FormOneLine, PageHeader, TextButton } from '../components/Ui';
import { getPlayersForTeam, getTeam } from '../domain/database';
import { useDatabase } from '../state/DatabaseContext';

export function TeamPage() {
  const { teamId = '' } = useParams();
  const { data, addPlayer } = useDatabase();
  const [playerName, setPlayerName] = useState('');

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

  return (
    <>
      <PageHeader>Team</PageHeader>
      <FormOneLine
        label="Player Name"
        buttonText="Add Player"
        value={playerName}
        onValueChange={setPlayerName}
        onSubmit={submit}
        canSubmit={playerName.trim().length > 0}
      />
      <table className="sk-grid">
        <tbody>
          {players.map((player) => (
            <tr key={player.Id}>
              <td>
                <TextButton>{player.Name}</TextButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
