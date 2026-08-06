import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FormOneLine, PageHeader, TextButton } from '../components/Ui';
import { getTeams } from '../domain/database';
import { useDatabase } from '../state/DatabaseContext';

export function TeamsPage() {
  const { data, addTeam } = useDatabase();
  const [teamName, setTeamName] = useState('');
  const navigate = useNavigate();
  const teams = getTeams(data);

  const submit = () => {
    if (!teamName.trim()) return;
    addTeam(teamName);
    setTeamName('');
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
      />
      <table className="sk-grid">
        <tbody>
          {teams.map((team) => (
            <tr key={team.Id}>
              <td>
                <TextButton onClick={() => navigate(`/teams/${team.Id}`)}>
                  {team.Name}
                </TextButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
