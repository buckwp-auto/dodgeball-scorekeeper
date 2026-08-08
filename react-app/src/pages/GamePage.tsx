import { Button, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { rememberLastGame } from '../domain/lastScoring';
import { PlayerRoster } from '../components/MatchRoster';
import { PageHeader } from '../components/Ui';
import { useDocumentHotkeys } from '../hooks/useDocumentHotkeys';
import { getTeam } from '../domain/database';
import {
  buildPermanentRosterHotkeys,
  findPlayerByHotkey,
} from '../domain/hotkeys';
import { autoSelectGameRoster } from '../domain/rosterAutoSelect';
import {
  computeGameLiveState,
  eliminatedPlayerIdsFromLive,
  sortRosterWithEliminations,
} from '../domain/gameElimination';
import {
  canNavigateToGameEvents,
  getGameSidePlayersWithSelection,
  getMatchById,
} from '../domain/matchGame';
import { useDatabase } from '../state/DatabaseContext';

export function GamePage() {
  const { matchId = '', gameId = '' } = useParams();
  const navigate = useNavigate();
  const { data, toggleGamePlayer, mutate } = useDatabase();
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

  const rosterHotkeys = useMemo(
    () =>
      buildPermanentRosterHotkeys(
        homeRosterRaw.map((row) => row.player),
        awayRosterRaw.map((row) => row.player),
      ),
    [homeRosterRaw, awayRosterRaw],
  );

  const homeRoster = useMemo(
    () => sortRosterWithEliminations(homeRosterRaw, eliminatedIds),
    [homeRosterRaw, eliminatedIds],
  );

  const awayRoster = useMemo(
    () => sortRosterWithEliminations(awayRosterRaw, eliminatedIds),
    [awayRosterRaw, eliminatedIds],
  );

  const onPlayerHotkey = useCallback(
    (key: string) => {
      const hit = findPlayerByHotkey(
        homeRosterRaw.map((row) => row.player),
        awayRosterRaw.map((row) => row.player),
        key,
        rosterHotkeys,
      );
      if (!hit) return;
      toggleGamePlayer(matchId, gameId, hit.player.Id);
    },
    [homeRosterRaw, awayRosterRaw, matchId, gameId, toggleGamePlayer, rosterHotkeys],
  );

  useDocumentHotkeys((key) => onPlayerHotkey(key), Boolean(match));

  if (!match || !live) {
    return <PageHeader>Game</PageHeader>;
  }

  const homeTeam = getTeam(data, match.TeamIdHome);
  const awayTeam = getTeam(data, match.TeamIdAway);
  const canTrack = canNavigateToGameEvents(data, matchId, gameId);

  return (
    <>
      <PageHeader>Game</PageHeader>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        On court — Home: {live.activeHomeCount} active · Away: {live.activeAwayCount} active
        {live.isGameOver
          ? ` · Game over (${live.winningTeamHome ? homeTeam?.Name : awayTeam?.Name} win)`
          : ''}
      </Typography>
      <Stack direction="row" className="button-row" sx={{ mb: 2 }}>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="contained"
          disabled={!canTrack}
          onClick={() => navigate(`/matches/${matchId}/games/${gameId}/events`)}
        >
          Track Game
        </Button>
      </Stack>
      <div className="sk-game">
        <PlayerRoster
          side="Home Team"
          teamName={homeTeam?.Name ?? 'Home'}
          players={homeRoster}
          onToggle={(playerId) => toggleGamePlayer(matchId, gameId, playerId)}
          hotkeyForPlayerId={(playerId) => rosterHotkeys.get(playerId) ?? null}
          eliminatedPlayerIds={eliminatedIds}
        />
        <PlayerRoster
          side="Away Team"
          teamName={awayTeam?.Name ?? 'Away'}
          players={awayRoster}
          onToggle={(playerId) => toggleGamePlayer(matchId, gameId, playerId)}
          hotkeyForPlayerId={(playerId) => rosterHotkeys.get(playerId) ?? null}
          eliminatedPlayerIds={eliminatedIds}
        />
      </div>
    </>
  );
}
