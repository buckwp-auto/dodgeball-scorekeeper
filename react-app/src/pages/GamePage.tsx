import { Alert, Button, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { rememberLastGame } from '../domain/lastScoring';
import { PlayerRoster } from '../components/MatchRoster';
import { RosterYoutubePlayer } from '../components/RosterYoutubePlayer';
import { MatchScoreLine } from '../components/MatchScoreLine';
import { PageHeader } from '../components/Ui';
import { useDocumentHotkeys } from '../hooks/useDocumentHotkeys';
import { getTeam } from '../domain/database';
import {
  previewRemoveGamePlayer,
  previewRemovePlayerFromMatch,
  removeGamePlayerFromRoster,
  removeMatchSidePlayerConfirmMessage,
  removePlayerFromMatchSide,
} from '../domain/gameEvents';
import {
  buildPermanentRosterHotkeys,
  findPlayerByHotkey,
} from '../domain/hotkeys';
import { resolvePlayersPerSide } from '../domain/leagueSettings';
import { autoSelectGameRoster } from '../domain/rosterAutoSelect';
import {
  computeGameLiveState,
  eliminatedPlayerIdsFromLive,
  sortRosterWithEliminations,
} from '../domain/gameElimination';
import {
  addPlayerToGameSide,
  canNavigateToGameEvents,
  countGameSidePlayers,
  getGameName,
  getGameSidePlayersWithSelection,
  getMatchById,
  isPlayerInGame,
  toggleGamePlayer as toggleGamePlayerOp,
} from '../domain/matchGame';
import { useMatchGameNavigation } from '../hooks/useMatchGameNavigation';
import { useDatabase } from '../state/DatabaseContext';

export function GamePage() {
  const { matchId = '', gameId = '' } = useParams();
  const navigate = useNavigate();
  const { data, mutate } = useDatabase();
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [homeAddName, setHomeAddName] = useState('');
  const [homeAddAsSub, setHomeAddAsSub] = useState(false);
  const [awayAddName, setAwayAddName] = useState('');
  const [awayAddAsSub, setAwayAddAsSub] = useState(false);
  const { previousGameId, goToPreviousGame, goToNextGame } = useMatchGameNavigation(
    matchId,
    gameId,
  );
  const match = getMatchById(data, matchId);

  useEffect(() => {
    if (!matchId || !gameId) return;
    mutate((draft) => {
      autoSelectGameRoster(draft, matchId, gameId);
      return null;
    }, '');
  }, [matchId, gameId, mutate]);

  useEffect(() => {
    if (!matchId || !gameId) return;
    rememberLastGame(matchId, gameId);
  }, [matchId, gameId]);

  const live = useMemo(
    () => (matchId && gameId ? computeGameLiveState(data, matchId, gameId) : null),
    [data, matchId, gameId],
  );
  const eliminatedIds = useMemo(
    () =>
      live
        ? eliminatedPlayerIdsFromLive(data, matchId, gameId, live)
        : new Set<string>(),
    [data, matchId, gameId, live],
  );

  const homeRosterRaw = useMemo(() => {
    if (!match) return [];
    return getGameSidePlayersWithSelection(data, match, gameId, true);
  }, [data, match, gameId]);

  const awayRosterRaw = useMemo(() => {
    if (!match) return [];
    return getGameSidePlayersWithSelection(data, match, gameId, false);
  }, [data, match, gameId]);

  const homeRoster = useMemo(
    () => sortRosterWithEliminations(homeRosterRaw, eliminatedIds),
    [homeRosterRaw, eliminatedIds],
  );

  const awayRoster = useMemo(
    () => sortRosterWithEliminations(awayRosterRaw, eliminatedIds),
    [awayRosterRaw, eliminatedIds],
  );

  const rosterHotkeys = useMemo(
    () =>
      buildPermanentRosterHotkeys(
        homeRoster.map((row) => row.player),
        awayRoster.map((row) => row.player),
      ),
    [homeRoster, awayRoster],
  );

  const handleTogglePlayer = useCallback(
    (playerId: string) => {
      setLimitMessage(null);
      const name =
        homeRosterRaw.find((row) => row.player.Id === playerId)?.player.Name ??
        awayRosterRaw.find((row) => row.player.Id === playerId)?.player.Name ??
        'This player';

      if (isPlayerInGame(data, gameId, playerId, matchId)) {
        const preview = previewRemoveGamePlayer(data, matchId, gameId, playerId);
        if (preview && preview.eventCount > 0) {
          const plural = preview.eventCount === 1 ? '' : 's';
          const ok = window.confirm(
            `${name} appears in recorded events. Removing them will delete ${preview.eventCount} event${plural} from this game, back to the earliest event they were in. Continue?`,
          );
          if (!ok) return;
          mutate((draft) => {
            removeGamePlayerFromRoster(draft, matchId, gameId, playerId, {
              rollbackEvents: true,
            });
          }, `Removed ${name} from the game roster.`);
          return;
        }
        mutate((draft) => {
          toggleGamePlayerOp(draft, matchId, gameId, playerId);
        }, '');
        return;
      }

      const teamHome = homeRosterRaw.some((row) => row.player.Id === playerId);
      const limit = resolvePlayersPerSide(data);
      if (countGameSidePlayers(data, matchId, gameId, teamHome) >= limit) {
        setLimitMessage(`Each team can have at most ${limit} players in a game.`);
        return;
      }
      mutate((draft) => {
        toggleGamePlayerOp(draft, matchId, gameId, playerId);
      }, '');
    },
    [awayRosterRaw, data, gameId, homeRosterRaw, matchId, mutate],
  );

  const onPlayerHotkey = useCallback(
    (key: string) => {
      const hit = findPlayerByHotkey(
        homeRoster.map((row) => row.player),
        awayRoster.map((row) => row.player),
        key,
        rosterHotkeys,
      );
      if (!hit) return;
      handleTogglePlayer(hit.player.Id);
    },
    [homeRoster, awayRoster, handleTogglePlayer, rosterHotkeys],
  );

  const addSidePlayer = (teamHome: boolean) => {
    const name = (teamHome ? homeAddName : awayAddName).trim();
    const asSub = teamHome ? homeAddAsSub : awayAddAsSub;
    if (!name || !match) return;
    const limit = resolvePlayersPerSide(data);
    const atLimit = countGameSidePlayers(data, matchId, gameId, teamHome) >= limit;
    mutate((draft) => {
      const player = addPlayerToGameSide(draft, matchId, gameId, teamHome, name, asSub);
      return player.Name;
    }, (playerName) => `Added player (${playerName}) to game.`);
    if (teamHome) {
      setHomeAddName('');
      setHomeAddAsSub(false);
    } else {
      setAwayAddName('');
      setAwayAddAsSub(false);
    }
    if (atLimit) {
      setLimitMessage(
        `Added to the match roster. Each team can have at most ${limit} players in a game.`,
      );
    }
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
    }, (commitMessage) => commitMessage);
  };

  useDocumentHotkeys((key) => onPlayerHotkey(key), Boolean(match));

  if (!match || !live) {
    return <PageHeader>Game</PageHeader>;
  }

  const homeTeam = getTeam(data, match.TeamIdHome);
  const awayTeam = getTeam(data, match.TeamIdAway);
  const canTrack = canNavigateToGameEvents(data, matchId, gameId);
  const gameTitle = getGameName(data, matchId, gameId);
  const playersPerSide = resolvePlayersPerSide(data);
  const homeSelected = homeRosterRaw.filter((row) => row.selected).length;
  const awaySelected = awayRosterRaw.filter((row) => row.selected).length;

  return (
    <>
      <PageHeader>{gameTitle}</PageHeader>
      <MatchScoreLine matchId={matchId} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        On court — Home {homeSelected}/{playersPerSide} · Away {awaySelected}/{playersPerSide}
        {live.isGameOver
          ? ` · Game over (${live.winningTeamHome ? homeTeam?.Name : awayTeam?.Name} win)`
          : live.activeHomeCount + live.activeAwayCount < homeSelected + awaySelected
            ? ` · Home ${live.activeHomeCount} / Away ${live.activeAwayCount} active`
            : ''}
      </Typography>
      {limitMessage ? (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setLimitMessage(null)}>
          {limitMessage}
        </Alert>
      ) : null}
      <Stack direction="row" spacing={1} className="button-row" sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="contained"
          disabled={!canTrack}
          onClick={() => navigate(`/matches/${matchId}/games/${gameId}/events`)}
        >
          Track Game
        </Button>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="outlined"
          disabled={!previousGameId}
          onClick={goToPreviousGame}
        >
          Previous game
        </Button>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="outlined"
          onClick={goToNextGame}
        >
          Next game
        </Button>
      </Stack>
      <RosterYoutubePlayer youtubeUrl={match.YoutubeUrl?.trim() || ''} />
      <div className="sk-game">
        <PlayerRoster
          side="Home Team"
          teamName={homeTeam?.Name ?? 'Home'}
          teamImage={homeTeam?.Image}
          players={homeRoster}
          onToggle={handleTogglePlayer}
          hotkeyForPlayerId={(playerId) => rosterHotkeys.get(playerId) ?? null}
          eliminatedPlayerIds={eliminatedIds}
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
          onToggle={handleTogglePlayer}
          hotkeyForPlayerId={(playerId) => rosterHotkeys.get(playerId) ?? null}
          eliminatedPlayerIds={eliminatedIds}
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
