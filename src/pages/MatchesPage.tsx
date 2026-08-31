import { Button, Stack } from '@mui/material';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { MatchStatsImportDialog } from '../components/MatchStatsImportDialog';
import { MatchScoreSpoiler } from '../components/MatchScoreSpoiler';
import { SeeStatsButton } from '../components/stats/SeeStatsButton';
import { PageHeader, TeamSearch, TextButton } from '../components/Ui';
import { getMatches, getTeam, getTeams } from '../domain/database';
import { isStatsImportedMatchId } from '../domain/importedMatch';
import { buildMatchListSpoiler } from '../domain/matchListSpoiler';
import {
  createMatchFromStatisticsCsv,
  type ImportMatchSeriesInput,
} from '../domain/statistics/importedMatchStats';
import { useDatabase } from '../state/DatabaseContext';
import { useAuth } from '../state/AuthContext';
import { useLeague } from '../state/LeagueContext';

export function MatchesPage() {
  const { data, addMatch, deleteMatch, mutate } = useDatabase();
  const { user } = useAuth();
  const { canDeleteMatchesAndGames } = useLeague();
  const navigate = useNavigate();
  const teams = getTeams(data);
  const matches = getMatches(data);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [awayId, setAwayId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importCsvText, setImportCsvText] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const canAdd = homeId !== null && awayId !== null;
  const homeTeam = homeId ? getTeam(data, homeId) : undefined;
  const awayTeam = awayId ? getTeam(data, awayId) : undefined;

  const onAddMatch = () => {
    if (!homeId || !awayId) return;
    const matchId = addMatch(homeId, awayId);
    navigate(`/matches/${matchId}`);
  };

  const onDeleteMatch = (matchId: string, matchName: string) => {
    if (!window.confirm(`Delete match “${matchName}” and all of its games?`)) return;
    deleteMatch(matchId);
  };

  const onImportFile = async (file: File) => {
    if (!canAdd) return;
    setImportError(null);
    try {
      const text = await file.text();
      setImportCsvText(text);
    } catch {
      setImportError('Could not read the CSV file');
    }
  };

  const onConfirmImport = (series: ImportMatchSeriesInput) => {
    if (!importCsvText || !homeId || !awayId) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const matchId = mutate(
        (draft) =>
          createMatchFromStatisticsCsv(
            draft,
            homeId,
            awayId,
            importCsvText,
            series,
            user?.uid ?? null,
          ),
        'Imported match from statistics CSV.',
      );
      setImportCsvText(null);
      navigate(`/matches/${matchId}/stats`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Import failed';
      setImportError(detail);
    } finally {
      setImportBusy(false);
    }
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
          <Stack direction="row" spacing={1}>
            <Button
              type="button"
              className="bw-button bw-button--text"
              variant="contained"
              disabled={!canAdd}
              onClick={onAddMatch}
            >
              Add Match
            </Button>
            <Button
              type="button"
              className="bw-button bw-button--text sk-import-match-from-csv"
              variant="outlined"
              disabled={!canAdd}
              onClick={() => importInputRef.current?.click()}
            >
              Import from statistics CSV
            </Button>
          </Stack>
        </div>
      </div>
      <table className="sk-grid" data-tour="matches-list">
        <tbody>
          {matches.map(({ match, matchName }) => {
            const spoiler = buildMatchListSpoiler(data, match.Id);
            const statsImported = isStatsImportedMatchId(data, match.Id);
            return (
              <tr key={match.Id} className="sk-match-row">
                <td>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
                  >
                    <TextButton
                      onClick={() =>
                        navigate(
                          statsImported
                            ? `/matches/${match.Id}/stats`
                            : `/matches/${match.Id}`,
                        )
                      }
                    >
                      {matchName}
                    </TextButton>
                    {spoiler ? (
                      <MatchScoreSpoiler matchName={matchName} spoiler={spoiler} />
                    ) : null}
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
            );
          })}
        </tbody>
      </table>
      <input
        ref={importInputRef}
        type="file"
        accept=".csv"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void onImportFile(file);
        }}
      />
      <MatchStatsImportDialog
        open={importCsvText != null}
        homeTeamName={homeTeam?.Name ?? 'Home'}
        awayTeamName={awayTeam?.Name ?? 'Away'}
        csvText={importCsvText ?? ''}
        busy={importBusy}
        error={importError}
        onClose={() => {
          if (importBusy) return;
          setImportCsvText(null);
          setImportError(null);
        }}
        onConfirm={onConfirmImport}
      />
    </>
  );
}
