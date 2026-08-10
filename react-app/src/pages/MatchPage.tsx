import { Button, Stack, TextField } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PlayerRoster } from '../components/MatchRoster';
import { RosterYoutubePlayer } from '../components/RosterYoutubePlayer';
import { SeeStatsButton } from '../components/stats/SeeStatsButton';
import { MatchScoreLine } from '../components/MatchScoreLine';
import { PageHeader } from '../components/Ui';
import { useDocumentHotkeys } from '../hooks/useDocumentHotkeys';
import { buildStatisticsCsvBytes } from '../domain/statisticsCsv';
import { getMatchName, getTeam } from '../domain/database';
import {
  previewRemovePlayerFromMatch,
  removeMatchSidePlayerConfirmMessage,
  removePlayerFromMatchSide,
} from '../domain/gameEvents';
import {
  buildPermanentRosterHotkeys,
  findPlayerByHotkey,
} from '../domain/hotkeys';
import { parseYoutubeVideoId } from '../domain/youtube';
import { autoSelectMatchRoster } from '../domain/rosterAutoSelect';
import {
  addPlayerToMatchSide,
  canNavigateToMatchPage,
  getMatchById,
  getMatchSidePlayersWithSelection,
  setMatchPlayerSubstitute,
} from '../domain/matchGame';
import { useDatabase } from '../state/DatabaseContext';
import { useLeague } from '../state/LeagueContext';

export function MatchPage() {
  const { matchId = '' } = useParams();
  const navigate = useNavigate();
  const { data, toggleMatchPlayer, mutate, deleteMatch } = useDatabase();
  const { canDeleteMatchesAndGames } = useLeague();
  const match = getMatchById(data, matchId);
  const [youtubeDraft, setYoutubeDraft] = useState('');
  const [homeAddName, setHomeAddName] = useState('');
  const [homeAddAsSub, setHomeAddAsSub] = useState(false);
  const [awayAddName, setAwayAddName] = useState('');
  const [awayAddAsSub, setAwayAddAsSub] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    mutate((draft) => {
      autoSelectMatchRoster(draft, matchId);
      return null;
    }, '');
  }, [matchId, mutate]);

  useEffect(() => {
    setYoutubeDraft(match?.YoutubeUrl ?? '');
  }, [match?.Id, match?.YoutubeUrl]);

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

  const addSidePlayer = (teamHome: boolean) => {
    const name = (teamHome ? homeAddName : awayAddName).trim();
    const asSub = teamHome ? homeAddAsSub : awayAddAsSub;
    if (!name || !match) return;
    mutate((draft) => {
      const player = addPlayerToMatchSide(draft, matchId, teamHome, name, asSub);
      return player.Name;
    }, (playerName) => `Added player (${playerName}) to match.`);
    if (teamHome) {
      setHomeAddName('');
      setHomeAddAsSub(false);
    } else {
      setAwayAddName('');
      setAwayAddAsSub(false);
    }
  };

  const toggleSubstitute = (playerId: string, currentlySub: boolean) => {
    mutate((draft) => {
      setMatchPlayerSubstitute(draft, matchId, playerId, !currentlySub);
      return null;
    }, '');
  };

  const canRemovePlayer = (playerId: string) =>
    previewRemovePlayerFromMatch(data, matchId, playerId).canRemove;

  const removeSidePlayer = (playerId: string) => {
    const name =
      homeRoster.find((row) => row.player.Id === playerId)?.player.Name ??
      awayRoster.find((row) => row.player.Id === playerId)?.player.Name ??
      'This player';
    const preview = previewRemovePlayerFromMatch(data, matchId, playerId);
    const message = removeMatchSidePlayerConfirmMessage(name, preview);
    if (!message || !window.confirm(message)) return;
    mutate((draft) => {
      const result = removePlayerFromMatchSide(draft, matchId, playerId, {
        rollbackEvents: true,
      });
      return result.deletedPlayer
        ? `Removed ${name} from the match and team.`
        : `Removed ${name} from the match.`;
    }, (message) => message);
  };

  if (!match) {
    return <PageHeader>Match</PageHeader>;
  }

  const homeTeam = getTeam(data, match.TeamIdHome);
  const awayTeam = getTeam(data, match.TeamIdAway);
  const canTrack = canNavigateToMatchPage(data, matchId);
  const youtubeValid =
    !youtubeDraft.trim() || Boolean(parseYoutubeVideoId(youtubeDraft));

  const saveYoutubeUrl = () => {
    const next = youtubeDraft.trim() || null;
    if (next && !parseYoutubeVideoId(next)) return;
    mutate((draft) => {
      const row = draft.Tables.Match.find(
        (entry) => (entry as { Id: string }).Id === matchId,
      ) as { YoutubeUrl?: string | null } | undefined;
      if (row) row.YoutubeUrl = next;
      return null;
    }, next ? 'Updated match YouTube URL.' : 'Cleared match YouTube URL.');
  };

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

  const onDeleteMatch = () => {
    if (!match) return;
    const matchName = getMatchName(data, match);
    if (!window.confirm(`Delete match “${matchName}” and all of its games?`)) return;
    deleteMatch(matchId);
    navigate('/matches');
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
      <MatchScoreLine matchId={matchId} />
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
        <SeeStatsButton to={`/matches/${matchId}/stats`} size="medium" />
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
        {canDeleteMatchesAndGames ? (
          <Button
            type="button"
            className="bw-button bw-button--text"
            variant="outlined"
            color="error"
            onClick={onDeleteMatch}
          >
            Delete Match
          </Button>
        ) : null}
      </Stack>
      <Stack spacing={1} sx={{ mb: 2, maxWidth: 720 }}>
        <TextField
          label="YouTube URL"
          placeholder="https://www.youtube.com/watch?v=…"
          value={youtubeDraft}
          onChange={(event) => setYoutubeDraft(event.target.value)}
          onBlur={saveYoutubeUrl}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              saveYoutubeUrl();
              (event.target as HTMLInputElement).blur();
            }
          }}
          error={!youtubeValid}
          helperText={
            youtubeValid
              ? 'Used here and on Track Game to play the match VOD and stamp event times.'
              : 'Enter a valid YouTube watch, share, or embed URL.'
          }
          size="small"
          fullWidth
        />
      </Stack>
      <RosterYoutubePlayer youtubeUrl={match.YoutubeUrl?.trim() || ''} />
      <div className="sk-match">
        <PlayerRoster
          side="Home Team"
          teamName={homeTeam?.Name ?? 'Home'}
          teamImage={homeTeam?.Image}
          players={homeRoster}
          onToggle={(playerId) => toggleMatchPlayer(matchId, playerId, true)}
          hotkeyForPlayerId={(playerId) => rosterHotkeys.get(playerId) ?? null}
          onToggleSubstitute={(playerId) =>
            toggleSubstitute(
              playerId,
              Boolean(homeRoster.find((row) => row.player.Id === playerId)?.substitute),
            )
          }
          onRemove={removeSidePlayer}
          canRemovePlayer={canRemovePlayer}
          addPlayer={{
            name: homeAddName,
            asSub: homeAddAsSub,
            onNameChange: setHomeAddName,
            onAsSubChange: setHomeAddAsSub,
            onSubmit: () => addSidePlayer(true),
          }}
        />
        <PlayerRoster
          side="Away Team"
          teamName={awayTeam?.Name ?? 'Away'}
          teamImage={awayTeam?.Image}
          players={awayRoster}
          onToggle={(playerId) => toggleMatchPlayer(matchId, playerId, false)}
          hotkeyForPlayerId={(playerId) => rosterHotkeys.get(playerId) ?? null}
          onToggleSubstitute={(playerId) =>
            toggleSubstitute(
              playerId,
              Boolean(awayRoster.find((row) => row.player.Id === playerId)?.substitute),
            )
          }
          onRemove={removeSidePlayer}
          canRemovePlayer={canRemovePlayer}
          addPlayer={{
            name: awayAddName,
            asSub: awayAddAsSub,
            onNameChange: setAwayAddName,
            onAsSubChange: setAwayAddAsSub,
            onSubmit: () => addSidePlayer(false),
          }}
        />
      </div>
    </>
  );
}
