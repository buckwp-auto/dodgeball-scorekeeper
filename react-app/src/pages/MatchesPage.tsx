import { Button, Stack } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SeeStatsButton } from '../components/stats/SeeStatsButton';
import { PageHeader, TeamSearch, TextButton } from '../components/Ui';
import { getMatches, getTeams } from '../domain/database';
import { useDatabase } from '../state/DatabaseContext';
import { useLeague } from '../state/LeagueContext';

export function MatchesPage() {
  const { data, addMatch, deleteMatch } = useDatabase();
  const { canDeleteMatchesAndGames } = useLeague();
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

  const onDeleteMatch = (matchId: string, matchName: string) => {
    if (!window.confirm(`Delete match “${matchName}” and all of its games?`)) return;
    deleteMatch(matchId);
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
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <TextButton onClick={() => navigate(`/matches/${match.Id}`)}>
                    {matchName}
                  </TextButton>
                  <SeeStatsButton to={`/matches/${match.Id}/stats`} />
                  {canDeleteMatchesAndGames ? (
                    <Button
                      size="small"
                      color="error"
                      className="bw-button bw-button--text"
                      onClick={() => onDeleteMatch(match.Id, matchName)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </Stack>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
