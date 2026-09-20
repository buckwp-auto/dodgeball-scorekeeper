import { Alert, Button, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
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
  departedPlayerIdsFromLive,
  departureKindByPlayerIdFromLive,
  eliminatedPlayerIdsFromLive,
  eliminationOrderByPlayerId,
  sortRosterWithEliminations,
} from '../domain/gameElimination';
import {
  countNonDepartedGameSidePlayers,
  getMatchIneligiblePlayerIds,
} from '../domain/gameLineup';
import {
  addPlayerToGameSide,
  canNavigateToGameEvents,
  getGameName,
  getGameSidePlayersWithSelection,
  getMatchById,
  isPlayerInGame,
  isPlayerInMatch,
  setMatchPlayerSubstitute,
  toggleGamePlayer as toggleGamePlayerOp,
  toggleMatchPlayer as toggleMatchPlayerOp,
} from '../domain/matchGame';
import {
  suggestLinkedPlayers,
  type PlayerMatchCandidate,
} from '../domain/playerMatch';
import { useMatchGameNavigation } from '../hooks/useMatchGameNavigation';
import { isStatsImportedMatch } from '../domain/importedMatch';
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
  const { previousGameId, canGoToNextGame, goToPreviousGame, goToNextGame } =
    useMatchGameNavigation(matchId, gameId);
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
  const departedIds = useMemo(
    () =>
      live
        ? departedPlayerIdsFromLive(data, matchId, gameId, live)
        : new Set<string>(),
    [data, matchId, gameId, live],
  );
  const departureKindByPlayerId = useMemo(
    () =>
      live
        ? departureKindByPlayerIdFromLive(data, matchId, gameId, live)
        : new Map(),
    [data, matchId, gameId, live],
  );
  const matchIneligibleIds = useMemo(
    () =>
      matchId && gameId
        ? getMatchIneligiblePlayerIds(data, matchId, gameId)
        : new Set<string>(),
    [data, matchId, gameId],
  );
  const eliminationOrder = useMemo(
    () =>
      live
        ? eliminationOrderByPlayerId(data, matchId, gameId, live)
        : new Map<string, number>(),
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
    () =>
      sortRosterWithEliminations(
        homeRosterRaw,
        eliminatedIds,
        eliminationOrder,
        departedIds,
      ),
    [homeRosterRaw, eliminatedIds, eliminationOrder, departedIds],
  );

  const awayRoster = useMemo(
    () =>
      sortRosterWithEliminations(
        awayRosterRaw,
        eliminatedIds,
        eliminationOrder,
        departedIds,
      ),
    [awayRosterRaw, eliminatedIds, eliminationOrder, departedIds],
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
        if (departedIds.has(playerId)) {
          setLimitMessage(
            `${name} already left this game — their events stay on the timeline. Optionally check a bench player (unchecked) as a replacement, or use Add player below.`,
          );
          return;
        }
        const preview = previewRemoveGamePlayer(data, matchId, gameId, playerId);
        if (preview && preview.eventCount > 0) {
          setLimitMessage(
            `Can't take ${name} off the roster after they've appeared in events — that erases the timeline. To bench them mid-game, record Injury / Yellow / Red / etc. on the Other tab, then optionally add a replacement here.`,
          );
          return;
        }
        mutate((draft) => {
          toggleGamePlayerOp(draft, matchId, gameId, playerId);
        }, '');
        return;
      }

      if (matchIneligibleIds.has(playerId)) {
        setLimitMessage(`${name} is out of this match and cannot join this game.`);
        return;
      }

      const teamHome = homeRosterRaw.some((row) => row.player.Id === playerId);
      const limit = resolvePlayersPerSide(data);
      const changed = mutate(
        (draft) => toggleGamePlayerOp(draft, matchId, gameId, playerId),
        '',
      );
      if (!changed) {
        const occupied = countNonDepartedGameSidePlayers(
          data,
          matchId,
          gameId,
          teamHome,
        );
        setLimitMessage(
          occupied >= limit
            ? `Each team can have at most ${limit} active players in a game.`
            : `${name} could not be added to this game.`,
        );
      }
    },
    [awayRosterRaw, data, departedIds, gameId, homeRosterRaw, matchId, matchIneligibleIds, mutate],
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

  const homeSuggestions = useMemo(
    () =>
      match
        ? suggestLinkedPlayers(data, {
            query: homeAddName,
            matchId,
            sideTeamId: match.TeamIdHome,
          })
        : [],
    [data, homeAddName, match, matchId],
  );
  const awaySuggestions = useMemo(
    () =>
      match
        ? suggestLinkedPlayers(data, {
            query: awayAddName,
            matchId,
            sideTeamId: match.TeamIdAway,
          })
        : [],
    [data, awayAddName, match, matchId],
  );

  const addSidePlayer = (teamHome: boolean, candidate?: PlayerMatchCandidate) => {
    const asSub =
      (teamHome ? homeAddAsSub : awayAddAsSub) || Boolean(candidate && !candidate.sameTeam);
    const name = (candidate?.playerName ?? (teamHome ? homeAddName : awayAddName)).trim();
    if (!name || !match) return;
    const limit = resolvePlayersPerSide(data);
    let addedToGame = false;
    mutate((draft) => {
      if (candidate?.sameTeam) {
        if (!isPlayerInMatch(draft, matchId, candidate.playerId)) {
          toggleMatchPlayerOp(draft, matchId, candidate.playerId, teamHome, {
            isSubstitute: asSub,
          });
        } else if (asSub) {
          setMatchPlayerSubstitute(draft, matchId, candidate.playerId, true);
        }
        addedToGame = toggleGamePlayerOp(draft, matchId, gameId, candidate.playerId);
        return candidate.playerName;
      }
      const player = addPlayerToGameSide(
        draft,
        matchId,
        gameId,
        teamHome,
        name,
        asSub,
        candidate?.playerId,
      );
      addedToGame = isPlayerInGame(draft, gameId, player.Id, matchId);
      return player.Name;
    }, (playerName) => `Added player (${playerName}) to game.`);
    if (teamHome) {
      setHomeAddName('');
      setHomeAddAsSub(false);
    } else {
      setAwayAddName('');
      setAwayAddAsSub(false);
    }
    if (!addedToGame) {
      setLimitMessage(
        `Added to the match roster, but this game already has ${limit} active players. Soft-exits free a slot — if someone just left, try checking them again.`,
      );
    }
  };

  const canRemovePlayer = (playerId: string) => {
    if (departedIds.has(playerId)) return false;
    return previewRemovePlayerFromMatch(data, matchId, playerId).canRemove;
  };

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

  if (isStatsImportedMatch(match)) {
    return <Navigate to={`/matches/${matchId}/stats`} replace />;
  }

  if (!match || !live) {
    return <PageHeader>Game</PageHeader>;
  }

  const homeTeam = getTeam(data, match.TeamIdHome);
  const awayTeam = getTeam(data, match.TeamIdAway);
  const canTrack = canNavigateToGameEvents(data, matchId, gameId);
  const gameTitle = getGameName(data, matchId, gameId);
  const playersPerSide = resolvePlayersPerSide(data);
  const homeSelected = homeRosterRaw.filter(
    (row) => row.selected && !departedIds.has(row.player.Id),
  ).length;
  const awaySelected = awayRosterRaw.filter(
    (row) => row.selected && !departedIds.has(row.player.Id),
  ).length;

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
      {departedIds.size > 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {departedIds.size === 1 ? 'A player has' : `${departedIds.size} players have`}{' '}
          left this game (still on the timeline/stats). Check an unchecked bench
          player as a replacement, or use Add player — left players do not count
          toward the {playersPerSide}-per-side limit.
        </Alert>
      ) : null}
      {limitMessage ? (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setLimitMessage(null)}>
          {limitMessage}
        </Alert>
      ) : null}
      <Stack direction="row" spacing={1} className="button-row" sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="contained"
          disabled={!canTrack}
          data-tour="track-game"
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
          disabled={!canGoToNextGame}
          onClick={goToNextGame}
        >
          Next game
        </Button>
      </Stack>
      <RosterYoutubePlayer youtubeUrl={match.YoutubeUrl?.trim() || ''} gameId={gameId} />
      <div className="sk-game" data-tour="game-roster">
        <PlayerRoster
          side="Home Team"
          teamName={homeTeam?.Name ?? 'Home'}
          teamImage={homeTeam?.Image}
          players={homeRoster}
          onToggle={handleTogglePlayer}
          hotkeyForPlayerId={(playerId) => rosterHotkeys.get(playerId) ?? null}
          eliminatedPlayerIds={eliminatedIds}
          eliminationOrder={eliminationOrder}
          departedPlayerIds={departedIds}
          departureKindByPlayerId={departureKindByPlayerId}
          matchIneligiblePlayerIds={matchIneligibleIds}
          onRemove={removeSidePlayer}
          canRemovePlayer={canRemovePlayer}
          addPlayer={{
            name: homeAddName,
            asSub: homeAddAsSub,
            suggestions: homeSuggestions,
            onNameChange: setHomeAddName,
            onAsSubChange: setHomeAddAsSub,
            onSubmit: (candidate) => addSidePlayer(true, candidate),
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
          eliminationOrder={eliminationOrder}
          departedPlayerIds={departedIds}
          departureKindByPlayerId={departureKindByPlayerId}
          matchIneligiblePlayerIds={matchIneligibleIds}
          onRemove={removeSidePlayer}
          canRemovePlayer={canRemovePlayer}
          addPlayer={{
            name: awayAddName,
            asSub: awayAddAsSub,
            suggestions: awaySuggestions,
            onNameChange: setAwayAddName,
            onAsSubChange: setAwayAddAsSub,
            onSubmit: (candidate) => addSidePlayer(false, candidate),
          }}
        />
      </div>
    </>
  );
}
