import { Button, Stack } from '@mui/material';
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PlayerRoster } from '../components/MatchRoster';
import { PageHeader } from '../components/Ui';
import { useDocumentHotkeys } from '../hooks/useDocumentHotkeys';
import { buildStatisticsCsvBytes } from '../domain/statisticsCsv';
import { getMatchName, getTeam } from '../domain/database';
import {
  buildPermanentRosterHotkeys,
  findPlayerByHotkey,
} from '../domain/hotkeys';
import { autoSelectMatchRoster } from '../domain/rosterAutoSelect';
import {
  canNavigateToMatchPage,
  getMatchById,
  getMatchSidePlayersWithSelection,
} from '../domain/matchGame';
import { useDatabase } from '../state/DatabaseContext';

export function MatchPage() {
  const { matchId = '' } = useParams();
  const navigate = useNavigate();
  const { data, toggleMatchPlayer, mutate } = useDatabase();
  const match = getMatchById(data, matchId);

  useEffect(() => {
    if (!matchId) return;
    mutate((draft) => {
      autoSelectMatchRoster(draft, matchId);
      return null;
    }, '');
  }, [matchId, mutate]);

  const homeRoster = match ? getMatchSidePlayersWithSelection(data, match, true) : [];
  const awayRoster = match ? getMatchSidePlayersWithSelection(data, match, false) : [];
  const rosterHotkeys = useMemo(
    () =>
      buildPermanentRosterHotkeys(
        homeRoster.map((row) => row.player),
        awayRoster.map((row) => row.player),
      ),
    [homeRoster, awayRoster],
  );

  const onPlayerHotkey = useCallback(
    (key: string) => {
      if (!match) return;
      const hit = findPlayerByHotkey(
        homeRoster.map((row) => row.player),
        awayRoster.map((row) => row.player),
        key,
        rosterHotkeys,
      );
      if (!hit) return;
      toggleMatchPlayer(matchId, hit.player.Id, hit.teamHome);
    },
    [match, homeRoster, awayRoster, matchId, toggleMatchPlayer, rosterHotkeys],
  );

  useDocumentHotkeys((key) => onPlayerHotkey(key), Boolean(match));

  if (!match) {
    return <PageHeader>Match</PageHeader>;
  }

  const homeTeam = getTeam(data, match.TeamIdHome);
  const awayTeam = getTeam(data, match.TeamIdAway);
  const canTrack = canNavigateToMatchPage(data, matchId);

  const statisticsBytes = () => buildStatisticsCsvBytes(data, matchId);

  const downloadStatistics = () => {
    const matchName = getMatchName(data, match);
    const bytes = statisticsBytes();
    const blob = new Blob([bytes], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Dodgeball Match (${matchName}) Statistics.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyStatistics = async () => {
    const text = new TextDecoder().decode(statisticsBytes());
    const tsv = text
      .split('\n')
      .map((line) =>
        line
          .replace(/^"|"$/g, '')
          .split('","')
          .join('\t'),
      )
      .join('\n');
    await navigator.clipboard.writeText(tsv);
  };

  return (
    <>
      <PageHeader>Match</PageHeader>
      <Stack direction="row" spacing={1} className="button-row" sx={{ flexWrap: 'wrap', mb: 2 }}>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="contained"
          disabled={!canTrack}
          onClick={() => navigate(`/matches/${matchId}/events`)}
        >
          Track Match
        </Button>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="outlined"
          onClick={downloadStatistics}
        >
          Download Match Statistics
        </Button>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="outlined"
          onClick={() => void copyStatistics()}
        >
          Copy Match Statistics
        </Button>
      </Stack>
      <div className="sk-match">
        <PlayerRoster
          side="Home Team"
          teamName={homeTeam?.Name ?? 'Home'}
          players={homeRoster}
          onToggle={(playerId) => toggleMatchPlayer(matchId, playerId, true)}
          hotkeyForPlayerId={(playerId) => rosterHotkeys.get(playerId) ?? null}
        />
        <PlayerRoster
          side="Away Team"
          teamName={awayTeam?.Name ?? 'Away'}
          players={awayRoster}
          onToggle={(playerId) => toggleMatchPlayer(matchId, playerId, false)}
          hotkeyForPlayerId={(playerId) => rosterHotkeys.get(playerId) ?? null}
        />
      </div>
    </>
  );
}
