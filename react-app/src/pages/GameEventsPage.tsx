import { Box, Button, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { HotkeyBadge } from '../components/HotkeyBadge';
import { PageHeader } from '../components/Ui';
import {
  addDeflectionToDrafts,
  applyPlayerHotkeyToThrowDrafts,
  ThrowEditor,
} from '../components/trackGame/ThrowEditor';
import { ErrorEditor } from '../components/trackGame/ErrorEditor';
import { FinishEditor } from '../components/trackGame/FinishEditor';
import { GameEventsTimeline } from '../components/trackGame/GameEventsTimeline';
import { useDocumentHotkeys } from '../hooks/useDocumentHotkeys';
import { getTeam } from '../domain/database';
import {
  areThrowDraftsComplete,
  buildTimelineEntries,
  deleteGameEvent,
  draftsEqual,
  emptyErrorDraft,
  emptyFinishDraft,
  emptyThrowDraft,
  gameHasFinishEvent,
  getGameEventType,
  getGameEvents,
  getGameEventsNewestFirst,
  getGamePlayerInfos,
  getInsertBelowTargetEventId,
  isErrorDraftComplete,
  isFinishDraftComplete,
  loadErrorDraftFromEvent,
  loadFinishDraftFromEvent,
  loadThrowDraftsFromEvent,
  persistErrorGameEvent,
  persistFinishGameEvent,
  persistThrowGameEvent,
  type ErrorDraft,
  type FinishDraft,
  type GameEventType,
  type ThrowDraft,
} from '../domain/gameEvents';
import { getGameName, getMatchById } from '../domain/matchGame';
import {
  computeGameLiveState,
  finishResultForLiveWinner,
} from '../domain/gameElimination';
import {
  buildPermanentPlayerHotkeys,
  findGamePlayerIdByHotkey,
  GAME_ACTION_HOTKEYS,
  getTrackGameActionForKey,
} from '../domain/hotkeys';
import { useDatabase } from '../state/DatabaseContext';

type TabKey = GameEventType;

const emptyThrowSnapshot = () => JSON.stringify([emptyThrowDraft()]);

export function GameEventsPage() {
  const { matchId = '', gameId = '' } = useParams();
  const { data, mutate } = useDatabase();

  const match = getMatchById(data, matchId);
  const homeTeam = match ? getTeam(data, match.TeamIdHome) : undefined;
  const awayTeam = match ? getTeam(data, match.TeamIdAway) : undefined;
  const players = useMemo(
    () => getGamePlayerInfos(data, matchId, gameId),
    [data, matchId, gameId],
  );
  const live = useMemo(
    () => computeGameLiveState(data, matchId, gameId),
    [data, matchId, gameId],
  );
  const isGameOver = live.isGameOver;

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [insertBeforeEventId, setInsertBeforeEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('throw');
  /** Team-wipe finish prompt: winner pre-selected, Enter confirms (no auto-commit). */
  const [pendingWipeFinish, setPendingWipeFinish] = useState(false);

  const [throwDrafts, setThrowDrafts] = useState<ThrowDraft[]>(() => [emptyThrowDraft()]);
  const [errorDraft, setErrorDraft] = useState<ErrorDraft>(() => emptyErrorDraft());
  const [finishDraft, setFinishDraft] = useState<FinishDraft>(() => emptyFinishDraft());
  const [savedSnapshot, setSavedSnapshot] = useState(emptyThrowSnapshot);

  const autoCommittingRef = useRef(false);
  const autoFinishPromptedRef = useRef(false);

  const timeline = useMemo(
    () => buildTimelineEntries(data, gameId, matchId),
    [data, gameId, matchId],
  );
  const eventsNewestFirst = useMemo(
    () => getGameEventsNewestFirst(data, gameId),
    [data, gameId],
  );
  const gameFinished = gameHasFinishEvent(data, gameId);
  const gameTitle = getGameName(data, matchId, gameId);

  // Ignore selections that belong to another game after route changes
  const eventIdsInGame = useMemo(
    () => new Set(getGameEvents(data, gameId).map((row) => row.Id)),
    [data, gameId],
  );
  const effectiveSelectedId =
    selectedEventId && eventIdsInGame.has(selectedEventId) ? selectedEventId : null;

  const lockedTab = effectiveSelectedId
    ? getGameEventType(data, effectiveSelectedId)
    : null;
  const visibleTab = lockedTab ?? activeTab;

  const currentDraftPayload = useMemo(() => {
    if (visibleTab === 'throw') return throwDrafts;
    if (visibleTab === 'error') return errorDraft;
    return finishDraft;
  }, [visibleTab, throwDrafts, errorDraft, finishDraft]);

  const isComplete =
    visibleTab === 'throw'
      ? areThrowDraftsComplete(throwDrafts)
      : visibleTab === 'error'
        ? isErrorDraftComplete(errorDraft)
        : isFinishDraftComplete(finishDraft);

  const isDirty = !draftsEqual(
    currentDraftPayload,
    JSON.parse(savedSnapshot) as typeof currentDraftPayload,
  );

  const loadDraftsForSelection = useCallback(
    (eventId: string | null) => {
      if (!eventId) {
        const freshThrows = [emptyThrowDraft()];
        setThrowDrafts(freshThrows);
        setErrorDraft(emptyErrorDraft());
        setFinishDraft(emptyFinishDraft());
        setSavedSnapshot(JSON.stringify(freshThrows));
        return;
      }
      const type = getGameEventType(data, eventId);
      if (type === 'throw') {
        const drafts = loadThrowDraftsFromEvent(data, eventId);
        setThrowDrafts(drafts);
        setSavedSnapshot(JSON.stringify(drafts));
      } else if (type === 'error') {
        const draft = loadErrorDraftFromEvent(data, eventId);
        setErrorDraft(draft);
        setSavedSnapshot(JSON.stringify(draft));
      } else if (type === 'finish') {
        const draft = loadFinishDraftFromEvent(data, eventId);
        setFinishDraft(draft);
        setSavedSnapshot(JSON.stringify(draft));
      } else {
        const freshThrows = [emptyThrowDraft()];
        setThrowDrafts(freshThrows);
        setErrorDraft(emptyErrorDraft());
        setFinishDraft(emptyFinishDraft());
        setSavedSnapshot(JSON.stringify(freshThrows));
      }
    },
    [data],
  );

  const resetNewEventMode = useCallback(() => {
    setSelectedEventId(null);
    setInsertBeforeEventId(null);
    setActiveTab('throw');
    setPendingWipeFinish(false);
    loadDraftsForSelection(null);
  }, [loadDraftsForSelection]);

  const confirmFinishEvent = useCallback(() => {
    if (!isFinishDraftComplete(finishDraft) || gameFinished) return;
    mutate(
      (draft) => persistFinishGameEvent(draft, gameId, finishDraft, {}),
      (id) => `Saved finish event (${id}).`,
    );
    autoFinishPromptedRef.current = false;
    setPendingWipeFinish(false);
    setSelectedEventId(null);
    setInsertBeforeEventId(null);
    setActiveTab('throw');
    loadDraftsForSelection(null);
  }, [finishDraft, gameFinished, mutate, gameId, loadDraftsForSelection]);

  const awaitingFinishConfirm =
    pendingWipeFinish &&
    !gameFinished &&
    visibleTab === 'finish' &&
    !effectiveSelectedId &&
    isFinishDraftComplete(finishDraft);

  const handleDone = useCallback(() => {
    if (awaitingFinishConfirm) {
      confirmFinishEvent();
      return;
    }
    resetNewEventMode();
  }, [awaitingFinishConfirm, confirmFinishEvent, resetNewEventMode]);

  // Full UI reset when switching games (route params change without remount)
  useEffect(() => {
    autoFinishPromptedRef.current = false;
    autoCommittingRef.current = false;
    setSelectedEventId(null);
    setInsertBeforeEventId(null);
    setActiveTab('throw');
    setPendingWipeFinish(false);
    const freshThrows = [emptyThrowDraft()];
    setThrowDrafts(freshThrows);
    setErrorDraft(emptyErrorDraft());
    setFinishDraft(emptyFinishDraft());
    setSavedSnapshot(JSON.stringify(freshThrows));
  }, [gameId]);

  useEffect(() => {
    if (!isGameOver || gameFinished) {
      autoFinishPromptedRef.current = false;
      setPendingWipeFinish(false);
      return;
    }
    if (autoFinishPromptedRef.current) return;
    const resultId = finishResultForLiveWinner(live.winningTeamHome);
    if (resultId === null) return;

    autoFinishPromptedRef.current = true;
    const nextDraft: FinishDraft = { resultId };
    setSelectedEventId(null);
    setInsertBeforeEventId(null);
    setActiveTab('finish');
    setPendingWipeFinish(true);
    setThrowDrafts([emptyThrowDraft()]);
    setErrorDraft(emptyErrorDraft());
    setFinishDraft(nextDraft);
    setSavedSnapshot(JSON.stringify(nextDraft));
  }, [isGameOver, live.winningTeamHome, gameFinished]);

  const handleRestore = useCallback(() => {
    loadDraftsForSelection(effectiveSelectedId);
  }, [loadDraftsForSelection, effectiveSelectedId]);

  const handleDelete = useCallback(() => {
    if (!effectiveSelectedId) return;
    mutate(
      (draft) => {
        deleteGameEvent(draft, effectiveSelectedId);
        return null;
      },
      'Deleted game event.',
    );
    resetNewEventMode();
  }, [effectiveSelectedId, mutate, resetNewEventMode]);

  const handleInsertBelow = useCallback(() => {
    if (!effectiveSelectedId) return;
    const target = getInsertBelowTargetEventId(eventsNewestFirst, effectiveSelectedId);
    setInsertBeforeEventId(target);
    setSelectedEventId(null);
    const type = lockedTab ?? activeTab;
    setActiveTab(type ?? 'throw');
    setPendingWipeFinish(false);
    loadDraftsForSelection(null);
  }, [
    effectiveSelectedId,
    eventsNewestFirst,
    lockedTab,
    activeTab,
    loadDraftsForSelection,
  ]);

  const handleSelectEvent = (eventId: string) => {
    setInsertBeforeEventId(null);
    setPendingWipeFinish(false);
    setSelectedEventId(eventId);
    const type = getGameEventType(data, eventId);
    if (type) setActiveTab(type);
    loadDraftsForSelection(eventId);
  };

  useEffect(() => {
    if (!isComplete || !isDirty || autoCommittingRef.current) return;
    if (gameFinished && !effectiveSelectedId && visibleTab !== 'finish') return;
    // Team wipe prompt: require Enter / Done — never auto-commit
    if (pendingWipeFinish && !effectiveSelectedId) return;

    autoCommittingRef.current = true;
    try {
      const eventId = mutate(
        (draft) => {
          const options = {
            gameEventId: effectiveSelectedId ?? undefined,
            insertBeforeEventId,
          };
          if (visibleTab === 'throw') {
            return persistThrowGameEvent(draft, gameId, matchId, throwDrafts, options);
          }
          if (visibleTab === 'error') {
            return persistErrorGameEvent(draft, gameId, matchId, errorDraft, options);
          }
          return persistFinishGameEvent(draft, gameId, finishDraft, options);
        },
        (id) =>
          effectiveSelectedId
            ? 'Updated game event.'
            : `Saved ${visibleTab} event (${id}).`,
      );

      setSelectedEventId(eventId);
      setInsertBeforeEventId(null);
      setPendingWipeFinish(false);
      setSavedSnapshot(JSON.stringify(currentDraftPayload));
    } finally {
      autoCommittingRef.current = false;
    }
  }, [
    isComplete,
    isDirty,
    visibleTab,
    throwDrafts,
    errorDraft,
    finishDraft,
    effectiveSelectedId,
    insertBeforeEventId,
    gameFinished,
    pendingWipeFinish,
    mutate,
    gameId,
    matchId,
    currentDraftPayload,
  ]);

  const gameCompleteIdle =
    gameFinished &&
    !effectiveSelectedId &&
    !insertBeforeEventId &&
    !isDirty &&
    !pendingWipeFinish &&
    visibleTab === 'throw';

  const showEndInsertMarker = !gameFinished && !insertBeforeEventId;

  const handleTrackGameHotkey = useCallback(
    (key: string, event: KeyboardEvent) => {
      if (key === 'Enter') {
        if (
          (awaitingFinishConfirm ||
            (visibleTab === 'finish' &&
              isFinishDraftComplete(finishDraft) &&
              !gameFinished &&
              !effectiveSelectedId))
        ) {
          event.preventDefault();
          confirmFinishEvent();
        }
        return;
      }

      const action = getTrackGameActionForKey(key);
      if (action === 'done') {
        handleDone();
        return;
      }
      if (action === 'restore') {
        handleRestore();
        return;
      }
      if (action === 'insertBelow') {
        handleInsertBelow();
        return;
      }
      if (action === 'delete') {
        handleDelete();
        return;
      }
      if (action === 'addThrow') {
        setThrowDrafts((prev) => [...prev, emptyThrowDraft()]);
        return;
      }
      if (action === 'addDeflection' && visibleTab === 'throw') {
        setThrowDrafts((prev) => addDeflectionToDrafts(prev));
        return;
      }

      if (visibleTab === 'throw') {
        const next = applyPlayerHotkeyToThrowDrafts(
          throwDrafts,
          players,
          key,
          live.eliminatedGamePlayerIds,
        );
        if (next) setThrowDrafts(next);
        return;
      }
      if (visibleTab === 'error') {
        const hotkeys = buildPermanentPlayerHotkeys(players);
        const gamePlayerId = findGamePlayerIdByHotkey(hotkeys, key);
        if (!gamePlayerId || live.eliminatedGamePlayerIds.has(gamePlayerId)) return;
        setErrorDraft((prev) => ({
          ...prev,
          offenderGamePlayerId:
            prev.offenderGamePlayerId === gamePlayerId ? '' : gamePlayerId,
        }));
      }
    },
    [
      awaitingFinishConfirm,
      confirmFinishEvent,
      finishDraft,
      gameFinished,
      effectiveSelectedId,
      handleDelete,
      handleDone,
      handleInsertBelow,
      handleRestore,
      players,
      throwDrafts,
      visibleTab,
      live.eliminatedGamePlayerIds,
    ],
  );

  useDocumentHotkeys(handleTrackGameHotkey, !gameCompleteIdle);

  return (
    <Box
      className="sk-track-game"
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: 0,
        mx: -3,
        mt: -3,
        mb: -3,
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 3, overflow: 'auto', minHeight: 0, minWidth: 0 }}>
        <PageHeader>Track Game</PageHeader>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          {gameTitle}
          {' · '}
          Home {live.activeHomeCount} / Away {live.activeAwayCount} active
          {isGameOver
            ? ` · Eliminated! (${live.winningTeamHome ? homeTeam?.Name ?? 'Home' : awayTeam?.Name ?? 'Away'} win)`
            : ''}
        </Typography>

        {awaitingFinishConfirm ? (
          <Typography color="warning.main" sx={{ mb: 2 }}>
            All players on one team are out — confirm the winner with Enter.
          </Typography>
        ) : null}

        {gameCompleteIdle ? (
          <Typography variant="h5" sx={{ mt: 4 }}>
            Game Complete!
          </Typography>
        ) : (
          <>
            <Stack
              direction="row"
              spacing={1}
              className="button-row"
              sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2 }}
            >
              {!lockedTab ? (
                <>
                  {(['throw', 'error', 'finish'] as const).map((tab) => (
                    <Box key={tab} className="tab tab--attached">
                      <Button
                        type="button"
                        className="bw-button bw-button--text"
                        variant={visibleTab === tab ? 'contained' : 'text'}
                        onClick={() => {
                          setPendingWipeFinish(false);
                          setActiveTab(tab);
                        }}
                        disabled={gameFinished && tab !== 'finish'}
                      >
                        {tab === 'throw' ? 'Throw' : tab === 'error' ? 'Error' : 'Finish'}
                      </Button>
                    </Box>
                  ))}
                </>
              ) : (
                <Typography variant="subtitle1" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                  {lockedTab}
                </Typography>
              )}

              {lockedTab ? (
                <>
                  <Button size="small" onClick={handleDone}>
                    Done
                  </Button>
                  {isDirty ? (
                    <Button size="small" onClick={handleRestore}>
                      Restore
                    </Button>
                  ) : null}
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: isDirty ? 'warning.light' : 'success.light',
                    }}
                  >
                    {isDirty ? 'Not Saved' : 'Saved'}
                  </Typography>
                  {!gameFinished ? (
                    <Button size="small" onClick={handleInsertBelow}>
                      Insert below
                    </Button>
                  ) : null}
                  <Button size="small" color="error" onClick={handleDelete}>
                    Delete
                  </Button>
                </>
              ) : null}

              {insertBeforeEventId ? (
                <Button size="small" onClick={() => setInsertBeforeEventId(null)}>
                  Insert above
                </Button>
              ) : null}
            </Stack>

            {visibleTab === 'throw' ? (
              <ThrowEditor
                drafts={throwDrafts}
                players={players}
                homeTeamName={homeTeam?.Name ?? 'Home'}
                awayTeamName={awayTeam?.Name ?? 'Away'}
                eliminatedGamePlayerIds={live.eliminatedGamePlayerIds}
                onChange={setThrowDrafts}
              />
            ) : null}
            {visibleTab === 'error' ? (
              <ErrorEditor
                draft={errorDraft}
                players={players}
                homeTeamName={homeTeam?.Name ?? 'Home'}
                awayTeamName={awayTeam?.Name ?? 'Away'}
                eliminatedGamePlayerIds={live.eliminatedGamePlayerIds}
                onChange={setErrorDraft}
              />
            ) : null}
            {visibleTab === 'finish' ? (
              <FinishEditor
                draft={finishDraft}
                homeTeamName={homeTeam?.Name ?? 'Home'}
                awayTeamName={awayTeam?.Name ?? 'Away'}
                onChange={(next) => {
                  setPendingWipeFinish(false);
                  setFinishDraft(next);
                }}
                confirmHint={awaitingFinishConfirm}
              />
            ) : null}

            {!gameCompleteIdle ? (
              <Stack
                direction="row"
                spacing={1}
                className="sk-action-hotkeys"
                sx={{ flexWrap: 'wrap', mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}
              >
                {GAME_ACTION_HOTKEYS.map((row) => (
                  <Stack key={row.key} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <HotkeyBadge hotkey={row.key} />
                    <Typography variant="caption">{row.label}</Typography>
                  </Stack>
                ))}
              </Stack>
            ) : null}
          </>
        )}
      </Box>

      <GameEventsTimeline
        entries={timeline}
        selectedEventId={effectiveSelectedId}
        insertBeforeEventId={insertBeforeEventId}
        showEndInsertMarker={showEndInsertMarker}
        onSelectEvent={handleSelectEvent}
        onDeselectEvent={handleDone}
      />
    </Box>
  );
}
