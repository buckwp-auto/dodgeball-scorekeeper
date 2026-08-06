import { Button } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader, TeamSearch, TextButton } from '../components/Ui';
import { getMatches, getTeams } from '../domain/database';
import { useDatabase } from '../state/DatabaseContext';

export function MatchesPage() {
  const { data, addMatch } = useDatabase();
  const navigate = useNavigate();
  const teams = getTeams(data);
  const matches = getMatches(data);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [awayId, setAwayId] = useState<string | null>(null);

  const canAdd = homeId !== null && awayId !== null;

  const onAddMatch = () => {
    if (!homeId || !awayId) return;
    const matchId = addMatch(homeId, awayId);
    navigate(`/matches/${matchId}`);
  };

  return (
    <>
      <PageHeader>Matches</PageHeader>
      <div className="row form-create">
        <div className="col">
          <TeamSearch
            label="Home Team"
            teams={teams}
            selectedTeamId={homeId}
            onSelect={(id) => {
              setHomeId(id);
              if (awayId === id) setAwayId(null);
            }}
            onClear={() => setHomeId(null)}
          />
        </div>
        <div className="col">
          <TeamSearch
            label="Away Team"
            teams={teams}
            selectedTeamId={awayId}
            onSelect={(id) => {
              setAwayId(id);
              if (homeId === id) setHomeId(null);
            }}
            onClear={() => setAwayId(null)}
          />
        </div>
        <div className="col-auto">
          <Button
            type="button"
            className="bw-button bw-button--text"
            variant="contained"
            disabled={!canAdd}
            onClick={onAddMatch}
          >
            Add Match
          </Button>
        </div>
      </div>
      <table className="sk-grid">
        <tbody>
          {matches.map(({ match, matchName }) => (
            <tr key={match.Id}>
              <td>
                <TextButton onClick={() => navigate(`/matches/${match.Id}`)}>
                  {matchName}
                </TextButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
