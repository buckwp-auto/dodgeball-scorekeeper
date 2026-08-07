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
import { StartEventEditor } from '../components/trackGame/StartEventEditor';
import { GameEventsTimeline } from '../components/trackGame/GameEventsTimeline';
import { EditorDensityProvider } from '../components/trackGame/EditorGrid';
import {
  YoutubePlayer,
  type YoutubePlayerHandle,
} from '../components/trackGame/YoutubePlayer';
import { useDocumentHotkeys } from '../hooks/useDocumentHotkeys';
import { getTeam } from '../domain/database';
import {
  loadYoutubePlayerMode,
  parseYoutubeVideoId,
  saveYoutubePlayerMode,
  YOUTUBE_FRAME_BACK_HOTKEY,
  YOUTUBE_FRAME_FORWARD_HOTKEY,
  YOUTUBE_LAYOUT_SMALL_HOTKEY,
  YOUTUBE_LAYOUT_TALL_HOTKEY,
  YOUTUBE_PLAY_PAUSE_HOTKEY,
  YOUTUBE_SEEK_BACK_HOTKEY,
  YOUTUBE_SEEK_FORWARD_HOTKEY,
  YOUTUBE_SEEK_SECONDS,
  type YoutubePlayerMode,
} from '../domain/youtube';
import {
  areThrowDraftsComplete,
  deleteGameEvent,
  draftsEqual,
  emptyErrorDraft,
  emptyFinishDraft,
  emptyThrowDraft,
  ensureGameStartEvent,
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
  setGameEventVideoOffset,
  type ErrorDraft,
  type FinishDraft,
  type GameEventType,
  type ThrowDraft,
} from '../domain/gameEvents';
import { buildTimelineEntries } from '../domain/gameEventTimeline';
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

type TabKey = Exclude<GameEventType, 'start'>;

const emptyThrowSnapshot = () => JSON.stringify([emptyThrowDraft()]);

export function GameEventsPage() {
  const { matchId = '', gameId = '' } = useParams();
  const { data, mutate } = useDatabase();

  // Backfill Game Start for older saves that predate the event type
  useEffect(() => {
    if (!gameId) return;
    const hasStart = getGameEvents(data, gameId).some(
      (event) => getGameEventType(data, event.Id) === 'start',
    );
    if (hasStart) return;
    mutate((draft) => {
      ensureGameStartEvent(draft, gameId);
      return null;
    }, 'Ensured game start event.');
  }, [gameId, data, mutate]);

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
  const youtubePlayerRef = useRef<YoutubePlayerHandle | null>(null);
  const [youtubeMode, setYoutubeMode] = useState<YoutubePlayerMode>(() =>
    loadYoutubePlayerMode(),
  );

  const youtubeUrl = match?.YoutubeUrl?.trim() || '';
  const hasYoutube = Boolean(parseYoutubeVideoId(youtubeUrl));

  const setYoutubeModeAndPersist = useCallback((mode: YoutubePlayerMode) => {
    setYoutubeMode(mode);
    saveYoutubePlayerMode(mode);
  }, []);

  const readVideoOffset = useCallback((): number | null => {
    return youtubePlayerRef.current?.getCurrentTime() ?? null;
  }, []);

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
  const visibleTab: GameEventType = lockedTab ?? activeTab;

  const currentDraftPayload = useMemo(() => {
    if (visibleTab === 'throw') return throwDrafts;
    if (visibleTab === 'error') return errorDraft;
    if (visibleTab === 'finish') return finishDraft;
    return null;
  }, [visibleTab, throwDrafts, errorDraft, finishDraft]);

  const isComplete =
    visibleTab === 'start'
      ? false
      : visibleTab === 'throw'
        ? areThrowDraftsComplete(throwDrafts)
        : visibleTab === 'error'
          ? isErrorDraftComplete(errorDraft)
          : isFinishDraftComplete(finishDraft);

  const isDirty =
    visibleTab === 'start' || currentDraftPayload === null
      ? false
      : !draftsEqual(
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
      } else if (type === 'start') {
        setSavedSnapshot(JSON.stringify({ start: true }));
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
    const videoOffsetSeconds = readVideoOffset();
    mutate(
      (draft) =>
        persistFinishGameEvent(draft, gameId, finishDraft, { videoOffsetSeconds }),
      (id) => `Saved finish event (${id}).`,
    );
    autoFinishPromptedRef.current = false;
    setPendingWipeFinish(false);
    setSelectedEventId(null);
    setInsertBeforeEventId(null);
    setActiveTab('throw');
    loadDraftsForSelection(null);
  }, [finishDraft, gameFinished, mutate, gameId, loadDraftsForSelection, readVideoOffset]);

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
    if (getGameEventType(data, effectiveSelectedId) === 'start') return;
    mutate(
      (draft) => {
        deleteGameEvent(draft, effectiveSelectedId);
        return null;
      },
      'Deleted game event.',
    );
    resetNewEventMode();
  }, [effectiveSelectedId, mutate, resetNewEventMode, data]);

  const handleCommitVideoOffset = useCallback(
    (eventId: string, seconds: number | null) => {
      mutate(
        (draft) => {
          setGameEventVideoOffset(draft, eventId, seconds);
          return null;
        },
        'Updated event timestamp.',
      );
    },
    [mutate],
  );

  const handleSetVideoOffsetFromPlayer = useCallback(
    (eventId: string) => {
      const seconds = readVideoOffset();
      if (seconds === null) return;
      handleCommitVideoOffset(eventId, seconds);
    },
    [readVideoOffset, handleCommitVideoOffset],
  );

  const handleInsertBelow = useCallback(() => {
    if (!effectiveSelectedId) return;
    const target = getInsertBelowTargetEventId(eventsNewestFirst, effectiveSelectedId);
    setInsertBeforeEventId(target);
    setSelectedEventId(null);
    const type =
      lockedTab && lockedTab !== 'start' ? lockedTab : activeTab;
    setActiveTab(type);
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
    if (type && type !== 'start') setActiveTab(type);
    loadDraftsForSelection(eventId);
    const entry = timeline.find((row) => row.id === eventId);
    if (
      entry?.videoOffsetSeconds !== null &&
      entry?.videoOffsetSeconds !== undefined
    ) {
      youtubePlayerRef.current?.seekTo(entry.videoOffsetSeconds);
    }
  };

  useEffect(() => {
    if (!isComplete || !isDirty || autoCommittingRef.current) return;
    if (gameFinished && !effectiveSelectedId && visibleTab !== 'finish') return;
    // Team wipe prompt: require Enter / Done — never auto-commit
    if (pendingWipeFinish && !effectiveSelectedId) return;

    autoCommittingRef.current = true;
    try {
      const videoOffsetSeconds = readVideoOffset();
      const eventId = mutate(
        (draft) => {
          const options = {
            gameEventId: effectiveSelectedId ?? undefined,
            insertBeforeEventId,
            // Stamp player time only on create — edits keep existing timestamps
            ...(effectiveSelectedId ? {} : { videoOffsetSeconds }),
          };
          if (visibleTab === 'throw') {
            return persistThrowGameEvent(draft, gameId, matchId, throwDrafts, options);
          }
          if (visibleTab === 'error') {
            return persistErrorGameEvent(draft, gameId, matchId, errorDraft, options);
          }
          if (visibleTab === 'finish') {
            return persistFinishGameEvent(draft, gameId, finishDraft, options);
          }
          return effectiveSelectedId ?? null;
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
    readVideoOffset,
  ]);

  const gameCompleteIdle =
    gameFinished &&
    !effectiveSelectedId &&
    !insertBeforeEventId &&
    !isDirty &&
    !pendingWipeFinish &&
    visibleTab === 'throw';

  const showEndInsertMarker = !gameFinished && !insertBeforeEventId;

  const handleYoutubeHotkey = useCallback(
    (key: string, event: KeyboardEvent) => {
      if (!hasYoutube || youtubeMode === 'hidden') return;

      // If the embed somehow kept focus, pull it back so later keys stay on-page
      const active = document.activeElement;
      if (active instanceof HTMLIFrameElement) {
        active.blur();
      }

      if (key === YOUTUBE_LAYOUT_SMALL_HOTKEY) {
        event.preventDefault();
        setYoutubeModeAndPersist('docked');
        return;
      }
      if (key === YOUTUBE_LAYOUT_TALL_HOTKEY) {
        event.preventDefault();
        setYoutubeModeAndPersist('tall');
        return;
      }
      if (key === YOUTUBE_PLAY_PAUSE_HOTKEY) {
        event.preventDefault();
        youtubePlayerRef.current?.togglePlayPause();
        return;
      }
      if (key === YOUTUBE_SEEK_BACK_HOTKEY) {
        event.preventDefault();
        youtubePlayerRef.current?.seekBy(-YOUTUBE_SEEK_SECONDS);
        return;
      }
      if (key === YOUTUBE_SEEK_FORWARD_HOTKEY) {
        event.preventDefault();
        youtubePlayerRef.current?.seekBy(YOUTUBE_SEEK_SECONDS);
        return;
      }
      if (key === YOUTUBE_FRAME_BACK_HOTKEY || key === YOUTUBE_FRAME_FORWARD_HOTKEY) {
        event.preventDefault();
        if (youtubePlayerRef.current?.isPaused()) {
          youtubePlayerRef.current.stepFrame(
            key === YOUTUBE_FRAME_BACK_HOTKEY ? -1 : 1,
          );
        }
      }
    },
    [hasYoutube, youtubeMode, setYoutubeModeAndPersist],
  );

  const handleTrackGameHotkey = useCallback(
    (key: string, event: KeyboardEvent) => {
      // Media / layout keys are handled by handleYoutubeHotkey (always active).
      if (
        key === YOUTUBE_LAYOUT_SMALL_HOTKEY ||
        key === YOUTUBE_LAYOUT_TALL_HOTKEY ||
        key === YOUTUBE_PLAY_PAUSE_HOTKEY ||
        key === YOUTUBE_SEEK_BACK_HOTKEY ||
        key === YOUTUBE_SEEK_FORWARD_HOTKEY ||
        key === YOUTUBE_FRAME_BACK_HOTKEY ||
        key === YOUTUBE_FRAME_FORWARD_HOTKEY
      ) {
        return;
      }

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

  // Capture so keys work even when a button has focus; youtube always on while VOD present
  useDocumentHotkeys(handleYoutubeHotkey, hasYoutube, { capture: true });
  useDocumentHotkeys(handleTrackGameHotkey, !gameCompleteIdle, { capture: true });

  const youtubeDocked = hasYoutube && youtubeMode === 'docked';
  const youtubeTall = hasYoutube && youtubeMode === 'tall';
  const youtubeTopBand = hasYoutube && youtubeMode !== 'docked';
  const editorCompact = youtubeTall;

  return (
    <Box
      className="sk-track-game"
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        // Tall: player fills leftover height; compact editor band below
        gridTemplateRows: youtubeTall
          ? 'minmax(0, 1fr) auto'
          : hasYoutube
            ? 'auto 1fr'
            : '1fr',
        mx: -3,
        mt: -3,
        mb: -3,
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {hasYoutube ? (
        <Box
          sx={{
            gridColumn: youtubeDocked ? 1 : '1 / -1',
            gridRow: 1,
            minWidth: 0,
            minHeight: 0,
            height: youtubeTall ? '100%' : 'auto',
            overflow: 'hidden',
          }}
        >
          <YoutubePlayer
            ref={youtubePlayerRef}
            youtubeUrl={youtubeUrl}
            mode={youtubeMode}
            onModeChange={setYoutubeModeAndPersist}
          />
        </Box>
      ) : null}

      <Box
        sx={{
          gridColumn: 1,
          gridRow: hasYoutube ? 2 : 1,
          p: editorCompact ? 1 : 2,
          overflow: editorCompact ? 'auto' : 'auto',
          minHeight: 0,
          minWidth: 0,
          maxHeight: youtubeTall ? '42vh' : undefined,
        }}
      >
        {editorCompact ? (
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {gameTitle}
            {' · '}
            Home {live.activeHomeCount} / Away {live.activeAwayCount}
            {isGameOver
              ? ` · Out (${live.winningTeamHome ? homeTeam?.Name ?? 'Home' : awayTeam?.Name ?? 'Away'})`
              : ''}
          </Typography>
        ) : (
          <>
            <PageHeader>Track Game</PageHeader>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              {gameTitle}
              {' · '}
              Home {live.activeHomeCount} / Away {live.activeAwayCount} active
              {isGameOver
                ? ` · Eliminated! (${live.winningTeamHome ? homeTeam?.Name ?? 'Home' : awayTeam?.Name ?? 'Away'} win)`
                : ''}
            </Typography>
          </>
        )}

        {awaitingFinishConfirm ? (
          <Typography color="warning.main" sx={{ mb: editorCompact ? 1 : 2 }}>
            All players on one team are out — confirm the winner with Enter.
          </Typography>
        ) : null}

        {gameCompleteIdle ? (
          <Typography variant="h5" sx={{ mt: 4 }}>
            Game Complete!
          </Typography>
        ) : (
          <EditorDensityProvider density={editorCompact ? 'compact' : 'comfortable'}>
            <Stack
              direction="row"
              spacing={1}
              className="button-row"
              sx={{
                flexWrap: 'wrap',
                alignItems: 'center',
                mb: editorCompact ? 1 : 2,
              }}
            >
              {!lockedTab ? (
                <>
                  {(['throw', 'error', 'finish'] as const).map((tab) => (
                    <Box key={tab} className="tab tab--attached">
                      <Button
                        type="button"
                        className="bw-button bw-button--text"
                        size={editorCompact ? 'small' : 'medium'}
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
                <Typography
                  variant={editorCompact ? 'body2' : 'subtitle1'}
                  sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                >
                  {lockedTab === 'start' ? 'Game start' : lockedTab}
                </Typography>
              )}

              {lockedTab ? (
                <>
                  <Button size="small" onClick={handleDone}>
                    Done
                  </Button>
                  {lockedTab !== 'start' && isDirty ? (
                    <Button size="small" onClick={handleRestore}>
                      Restore
                    </Button>
                  ) : null}
                  {lockedTab !== 'start' ? (
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
                  ) : null}
                  {lockedTab !== 'start' && !gameFinished ? (
                    <Button size="small" onClick={handleInsertBelow}>
                      Insert below
                    </Button>
                  ) : null}
                  {lockedTab !== 'start' ? (
                    <Button size="small" color="error" onClick={handleDelete}>
                      Delete
                    </Button>
                  ) : null}
                </>
              ) : null}

              {insertBeforeEventId ? (
                <Button size="small" onClick={() => setInsertBeforeEventId(null)}>
                  Insert above
                </Button>
              ) : null}
            </Stack>

            {visibleTab === 'start' && effectiveSelectedId ? (
              <StartEventEditor
                videoOffsetSeconds={
                  timeline.find((row) => row.id === effectiveSelectedId)?.videoOffsetSeconds
                }
                onCommitOffset={(seconds) =>
                  handleCommitVideoOffset(effectiveSelectedId, seconds)
                }
                onSetFromPlayer={() =>
                  handleSetVideoOffsetFromPlayer(effectiveSelectedId)
                }
                canSetFromPlayer={hasYoutube && youtubeMode !== 'hidden'}
              />
            ) : null}
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

            {!editorCompact ? (
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
                {hasYoutube ? (
                  <>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <HotkeyBadge hotkey={YOUTUBE_LAYOUT_SMALL_HOTKEY} />
                      <Typography variant="caption">Video small</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <HotkeyBadge hotkey={YOUTUBE_LAYOUT_TALL_HOTKEY} />
                      <Typography variant="caption">Video tall</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <HotkeyBadge hotkey="Space" />
                      <Typography variant="caption">Play/pause</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <HotkeyBadge hotkey="←" />
                      <HotkeyBadge hotkey="→" />
                      <Typography variant="caption">Seek 5s</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <HotkeyBadge hotkey={YOUTUBE_FRAME_BACK_HOTKEY} />
                      <HotkeyBadge hotkey={YOUTUBE_FRAME_FORWARD_HOTKEY} />
                      <Typography variant="caption">Frame step (paused)</Typography>
                    </Stack>
                  </>
                ) : null}
              </Stack>
            ) : null}
          </EditorDensityProvider>
        )}
      </Box>

      <Box
        sx={{
          gridColumn: 2,
          gridRow: youtubeDocked ? '1 / -1' : youtubeTopBand || hasYoutube ? 2 : 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          maxHeight: youtubeTall ? '42vh' : undefined,
        }}
      >
        <GameEventsTimeline
          entries={timeline}
          selectedEventId={effectiveSelectedId}
          insertBeforeEventId={insertBeforeEventId}
          showEndInsertMarker={showEndInsertMarker}
          canSetFromPlayer={hasYoutube && youtubeMode !== 'hidden'}
          onSelectEvent={handleSelectEvent}
          onDeselectEvent={handleDone}
          onCommitVideoOffset={handleCommitVideoOffset}
          onSetVideoOffsetFromPlayer={handleSetVideoOffsetFromPlayer}
        />
      </Box>
    </Box>
  );
}
