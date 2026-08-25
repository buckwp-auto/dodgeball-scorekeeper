import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useMatchGameNavigation } from '../hooks/useMatchGameNavigation';
import { MatchScoreLine, useMatchSeriesScore } from '../components/MatchScoreLine';
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
import { TrackGameHotkeyHints } from '../components/trackGame/TrackGameHotkeyHints';
import {
  YoutubePlayer,
  YoutubePopoutBar,
} from '../components/trackGame/YoutubePlayer';
import { logDeleteItem, logVideoTimelineSeek } from '../cloud/logAnalytics';
import { useDocumentHotkeys } from '../hooks/useDocumentHotkeys';
import {
  isYoutubeControlHotkey,
  useYoutubeControls,
} from '../hooks/useYoutubeControls';
import { getTeam } from '../domain/database';
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
  getGameStartEvent,
  isErrorDraftComplete,
  isFinishDraftComplete,
  loadOtherDraftFromEvent,
  loadFinishDraftFromEvent,
  loadThrowDraftsFromEvent,
  persistOtherGameEvent,
  persistFinishGameEvent,
  persistThrowGameEvent,
  restoreGameEventSnapshot,
  setGameEventHighlight,
  setGameEventVideoOffset,
  inPageOpenSeekSeconds,
  trackGameOpenSeekSeconds,
  undoLastGameEvent,
  type ErrorDraft,
  type FinishDraft,
  type GameEventSnapshot,
  type GameEventType,
  type ThrowDraft,
} from '../domain/gameEvents';
import { buildTimelineEntries } from '../domain/gameEventTimeline';
import { rememberLastGame, rememberLastMatch } from '../domain/lastScoring';
import { getGameName, getMatchById } from '../domain/matchGame';
import {
  computeGameLiveState,
  findStaleEliminatedSelections,
  finishResultForLiveWinner,
} from '../domain/gameElimination';
import {
  applyOtherOffenseHotkey,
  buildPermanentPlayerHotkeys,
  findGamePlayerIdByHotkey,
  getOtherOffenseChoiceForKey,
  getTrackGameActionForKey,
} from '../domain/hotkeys';
import { releaseActiveIframeFocus } from '../domain/youtube';
import { shouldAutoSeekPopoutForGame } from '../domain/youtubePopout';
import { useDatabase } from '../state/DatabaseContext';
import { useYoutubePopout } from '../state/YoutubePopoutContext';

type TabKey = 'throw' | 'error' | 'finish';

function editorTabForEventType(type: GameEventType | null): TabKey | 'start' | null {
  if (type === 'noBlocking') return 'error';
  if (type === 'start') return 'start';
  return type;
}

const emptyThrowSnapshot = () => JSON.stringify([emptyThrowDraft()]);

export function GameEventsPage() {
  const { matchId = '', gameId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const focusEventFromUrl = searchParams.get('event');
  const { data, mutate } = useDatabase();
  const { goToNextGame, goToMatch, goToGameRoster, canGoToNextGame } =
    useMatchGameNavigation(matchId, gameId);

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
  /** Team wipe detected; stay on Throw until Done opens the finish prompt. */
  const [wipeAwaitingDone, setWipeAwaitingDone] = useState(false);
  /** Team-wipe finish prompt: winner pre-selected, Enter confirms (no auto-commit). */
  const [pendingWipeFinish, setPendingWipeFinish] = useState(false);

  const [throwDrafts, setThrowDrafts] = useState<ThrowDraft[]>(() => [emptyThrowDraft()]);
  const [errorDraft, setErrorDraft] = useState<ErrorDraft>(() => emptyErrorDraft());
  const [finishDraft, setFinishDraft] = useState<FinishDraft>(() => emptyFinishDraft());
  const [savedSnapshot, setSavedSnapshot] = useState(emptyThrowSnapshot);

  const [commitError, setCommitError] = useState<string | null>(null);
  /** Player position when the throw drafts were last touched, for out-player warnings. */
  const [editVideoOffsetSeconds, setEditVideoOffsetSeconds] = useState<number | null>(null);

  const autoCommittingRef = useRef(false);
  const redoStackRef = useRef<GameEventSnapshot[]>([]);
  const appliedFocusRef = useRef<string | null>(null);

  const youtubeUrl = match?.YoutubeUrl?.trim() || '';
  const {
    hasYoutube,
    mode: youtubeMode,
    playerRef: youtubePlayerRef,
    readVideoOffset,
    seekToVideoOffset,
    setModeAndPersist: setYoutubeModeAndPersist,
    cueSeconds,
    popOut,
    dockBack,
    popoutPlayback,
  } = useYoutubeControls(youtubeUrl);
  const { attachedGameId, setAttachedGameId } = useYoutubePopout();

  const updateThrowDrafts = useCallback(
    (next: ThrowDraft[] | ((prev: ThrowDraft[]) => ThrowDraft[])) => {
      setThrowDrafts(next);
      setEditVideoOffsetSeconds(readVideoOffset());
    },
    [readVideoOffset],
  );

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
  const matchScore = useMatchSeriesScore(matchId);

  useEffect(() => {
    if (!matchId || !gameId) return;
    rememberLastGame(matchId, gameId);
  }, [matchId, gameId]);

  const openSeekSeconds = useMemo(() => {
    if (gameId && focusEventFromUrl) {
      const focused = getGameEvents(data, gameId).find(
        (row) => row.Id === focusEventFromUrl,
      );
      if (focused?.VideoOffsetSeconds != null) return focused.VideoOffsetSeconds;
    }
    return gameId ? inPageOpenSeekSeconds(data, gameId) : null;
    // Snapshot once per game open — later edits should not recreate the player
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const gameStartOffsetSeconds = gameId
    ? (getGameStartEvent(data, gameId)?.VideoOffsetSeconds ?? null)
    : null;

  // Persisted pop-out: on attaching to a game, seek to game start (finished) or
  // the latest stamp (in progress). Stay put only when nothing is stamped yet.
  // Track Game pages mark attachedGameId even in-page so popping out on the same
  // game does not look like a fresh attach and re-seek.
  const popoutStartStampRef = useRef<number | null>(null);
  const popoutStartStampReadyRef = useRef(false);
  useEffect(() => {
    if (!gameId) return;

    if (youtubeMode !== 'popout') {
      if (attachedGameId !== gameId) setAttachedGameId(gameId);
      popoutStartStampRef.current = null;
      popoutStartStampReadyRef.current = false;
      return;
    }

    if (attachedGameId !== gameId) {
      const previousAttachedGameId = attachedGameId;
      setAttachedGameId(gameId);
      popoutStartStampRef.current = gameStartOffsetSeconds;
      popoutStartStampReadyRef.current = true;
      let seekTarget: number | null = null;
      if (focusEventFromUrl) {
        const focused = getGameEvents(data, gameId).find(
          (row) => row.Id === focusEventFromUrl,
        );
        if (focused?.VideoOffsetSeconds != null) {
          seekTarget = focused.VideoOffsetSeconds;
        }
      }
      if (seekTarget == null) {
        seekTarget = trackGameOpenSeekSeconds(data, gameId);
      }
      if (
        seekTarget != null &&
        shouldAutoSeekPopoutForGame({
          attachedGameId: previousAttachedGameId,
          gameId,
          seekTargetSeconds: seekTarget,
        })
      ) {
        seekToVideoOffset(seekTarget);
      }
      return;
    }

    // Remount onto the same attached game: seed the ref, don't seek
    if (!popoutStartStampReadyRef.current) {
      popoutStartStampRef.current = gameStartOffsetSeconds;
      popoutStartStampReadyRef.current = true;
      return;
    }

    if (popoutStartStampRef.current == null && gameStartOffsetSeconds != null) {
      popoutStartStampRef.current = gameStartOffsetSeconds;
      seekToVideoOffset(gameStartOffsetSeconds);
      return;
    }
    popoutStartStampRef.current = gameStartOffsetSeconds;
    // data / focusEventFromUrl intentionally omitted — game open snapshot + start stamp
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    youtubeMode,
    gameId,
    gameStartOffsetSeconds,
    attachedGameId,
    setAttachedGameId,
    seekToVideoOffset,
  ]);

  // Ignore selections that belong to another game after route changes
  const eventIdsInGame = useMemo(
    () => new Set(getGameEvents(data, gameId).map((row) => row.Id)),
    [data, gameId],
  );
  const effectiveSelectedId =
    selectedEventId && eventIdsInGame.has(selectedEventId) ? selectedEventId : null;

  const lockedEventType = effectiveSelectedId
    ? getGameEventType(data, effectiveSelectedId)
    : null;
  const lockedTab = editorTabForEventType(lockedEventType);
  const visibleTab: TabKey | 'start' = lockedTab ?? activeTab;

  // Editing an existing event judges outs against its stored time, not the player head
  const throwVideoOffsetSeconds = effectiveSelectedId
    ? timeline.find((row) => row.id === effectiveSelectedId)?.videoOffsetSeconds ?? null
    : editVideoOffsetSeconds;

  const staleEliminatedSelections = useMemo(
    () =>
      visibleTab === 'throw'
        ? findStaleEliminatedSelections(
            throwDrafts,
            players,
            live.eliminatedAtSeconds,
            throwVideoOffsetSeconds,
          )
        : [],
    [visibleTab, throwDrafts, players, live.eliminatedAtSeconds, throwVideoOffsetSeconds],
  );

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
      } else if (type === 'error' || type === 'noBlocking') {
        const draft = loadOtherDraftFromEvent(data, eventId);
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
    rememberLastMatch(matchId);
    redoStackRef.current = [];
    setWipeAwaitingDone(false);
    setPendingWipeFinish(false);
    setSelectedEventId(null);
    setInsertBeforeEventId(null);
    setActiveTab('throw');
    loadDraftsForSelection(null);
  }, [finishDraft, gameFinished, mutate, gameId, matchId, loadDraftsForSelection, readVideoOffset]);

  const awaitingFinishConfirm =
    pendingWipeFinish &&
    !gameFinished &&
    visibleTab === 'finish' &&
    !effectiveSelectedId &&
    isFinishDraftComplete(finishDraft);

  const openWipeFinishPrompt = useCallback(() => {
    const resultId = finishResultForLiveWinner(live.winningTeamHome);
    if (resultId === null) return;
    const nextDraft: FinishDraft = { resultId };
    setSelectedEventId(null);
    setInsertBeforeEventId(null);
    setActiveTab('finish');
    setWipeAwaitingDone(false);
    setPendingWipeFinish(true);
    setThrowDrafts([emptyThrowDraft()]);
    setErrorDraft(emptyErrorDraft());
    setFinishDraft(nextDraft);
    setSavedSnapshot(JSON.stringify(nextDraft));
  }, [live.winningTeamHome]);

  const handleDone = useCallback(() => {
    if (wipeAwaitingDone && !gameFinished) {
      openWipeFinishPrompt();
      return;
    }
    if (awaitingFinishConfirm) {
      confirmFinishEvent();
      return;
    }
    resetNewEventMode();
  }, [
    wipeAwaitingDone,
    gameFinished,
    openWipeFinishPrompt,
    awaitingFinishConfirm,
    confirmFinishEvent,
    resetNewEventMode,
  ]);

  // Full UI reset when switching games (route params change without remount)
  useEffect(() => {
    autoCommittingRef.current = false;
    redoStackRef.current = [];
    setSelectedEventId(null);
    setInsertBeforeEventId(null);
    setActiveTab('throw');
    setWipeAwaitingDone(false);
    setPendingWipeFinish(false);
    const freshThrows = [emptyThrowDraft()];
    setThrowDrafts(freshThrows);
    setErrorDraft(emptyErrorDraft());
    setFinishDraft(emptyFinishDraft());
    setSavedSnapshot(JSON.stringify(freshThrows));
  }, [gameId]);

  useEffect(() => {
    if (!isGameOver || gameFinished) {
      setWipeAwaitingDone(false);
      setPendingWipeFinish(false);
      return;
    }
    if (wipeAwaitingDone || pendingWipeFinish || visibleTab === 'finish') return;
    const resultId = finishResultForLiveWinner(live.winningTeamHome);
    if (resultId === null) return;
    setFinishDraft({ resultId });
    setWipeAwaitingDone(true);
  }, [
    isGameOver,
    live.winningTeamHome,
    gameFinished,
    wipeAwaitingDone,
    pendingWipeFinish,
    visibleTab,
  ]);

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
    logDeleteItem('game_event');
    resetNewEventMode();
  }, [effectiveSelectedId, mutate, resetNewEventMode, data]);

  const handleUndo = useCallback(() => {
    const snapshot = mutate(
      (draft) => undoLastGameEvent(draft, gameId),
      (removed) => (removed ? 'Undid last game event.' : ''),
    );
    if (!snapshot) return;
    redoStackRef.current = [...redoStackRef.current, snapshot];
    resetNewEventMode();
  }, [mutate, gameId, resetNewEventMode]);

  const handleRedo = useCallback(() => {
    const snapshot = redoStackRef.current[redoStackRef.current.length - 1];
    if (!snapshot) return;
    mutate(
      (draft) => {
        restoreGameEventSnapshot(draft, snapshot);
        return null;
      },
      'Redid game event.',
    );
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    resetNewEventMode();
  }, [mutate, resetNewEventMode]);

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

  const handleToggleHighlight = useCallback(
    (eventId: string) => {
      const currentlyHighlighted = Boolean(
        timeline.find((row) => row.id === eventId)?.isHighlight,
      );
      mutate(
        (draft) => {
          setGameEventHighlight(draft, eventId, !currentlyHighlighted);
          return null;
        },
        currentlyHighlighted ? 'Removed highlight.' : 'Starred highlight.',
      );
    },
    [mutate, timeline],
  );

  const handleInsertBelow = useCallback(() => {
    if (!effectiveSelectedId) return;
    const target = getInsertBelowTargetEventId(eventsNewestFirst, effectiveSelectedId);
    setInsertBeforeEventId(target);
    setSelectedEventId(null);
    const rawType =
      lockedEventType && lockedEventType !== 'start' ? lockedEventType : activeTab;
    const type = rawType === 'noBlocking' ? 'error' : rawType;
    setActiveTab(type);
    setPendingWipeFinish(false);
    loadDraftsForSelection(null);
  }, [
    effectiveSelectedId,
    eventsNewestFirst,
    lockedEventType,
    activeTab,
    loadDraftsForSelection,
  ]);

  const handleSelectEvent = (eventId: string) => {
    setInsertBeforeEventId(null);
    setPendingWipeFinish(false);
    setSelectedEventId(eventId);
    const type = getGameEventType(data, eventId);
    if (type && type !== 'start') {
      setActiveTab(type === 'noBlocking' ? 'error' : type);
    }
    loadDraftsForSelection(eventId);
    const entry = timeline.find((row) => row.id === eventId);
    if (
      entry?.videoOffsetSeconds !== null &&
      entry?.videoOffsetSeconds !== undefined
    ) {
      seekToVideoOffset(entry.videoOffsetSeconds);
      logVideoTimelineSeek({
        offsetSeconds: entry.videoOffsetSeconds,
        eventType: type ?? undefined,
      });
    }
  };

  useEffect(() => {
    if (!focusEventFromUrl || !eventIdsInGame.has(focusEventFromUrl)) return;
    const focusKey = `${gameId}:${focusEventFromUrl}`;
    if (appliedFocusRef.current === focusKey) return;
    appliedFocusRef.current = focusKey;
    handleSelectEvent(focusEventFromUrl);
    // Select once when opening via ?event=; starring/edits should not re-focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEventFromUrl, gameId, eventIdsInGame]);

  useEffect(() => {
    if (!isComplete || !isDirty || autoCommittingRef.current) return;
    if (gameFinished && !effectiveSelectedId && visibleTab !== 'finish') return;
    // Team wipe prompt: require Enter / Done — never auto-commit
    if (pendingWipeFinish && !effectiveSelectedId) return;

    autoCommittingRef.current = true;
    try {
      const videoOffsetSeconds = readVideoOffset();
      const existingOffset = effectiveSelectedId
        ? timeline.find((row) => row.id === effectiveSelectedId)?.videoOffsetSeconds
        : undefined;
      const stampFromPlayer =
        !effectiveSelectedId ||
        (visibleTab === 'throw' &&
          (existingOffset === null || existingOffset === undefined));
      const eventId = mutate(
        (draft) => {
          const options = {
            gameEventId: effectiveSelectedId ?? undefined,
            insertBeforeEventId,
            // Stamp on create, or when adding to an unstamped team throw
            ...(stampFromPlayer ? { videoOffsetSeconds } : {}),
          };
          if (visibleTab === 'throw') {
            return persistThrowGameEvent(draft, gameId, matchId, throwDrafts, options);
          }
          if (visibleTab === 'error') {
            return persistOtherGameEvent(draft, gameId, matchId, errorDraft, options);
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

      // New commits clear the redo stack (standard undo/redo)
      if (!effectiveSelectedId) {
        redoStackRef.current = [];
        if (visibleTab === 'finish') rememberLastMatch(matchId);
      }

      setSelectedEventId(eventId);
      setInsertBeforeEventId(null);
      setPendingWipeFinish(false);
      setSavedSnapshot(JSON.stringify(currentDraftPayload));
      setCommitError(null);
    } catch (error) {
      // Keep the draft on screen so the tracker can correct it instead of losing the event
      setCommitError(error instanceof Error ? error.message : String(error));
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
    timeline,
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
      releaseActiveIframeFocus();

      if (isYoutubeControlHotkey(key)) return;

      const undoRedoAction = getTrackGameActionForKey(key);
      if (undoRedoAction === 'undo') {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (undoRedoAction === 'redo') {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (gameCompleteIdle) return;

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

      const action = undoRedoAction;
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
        updateThrowDrafts((prev) => [...prev, emptyThrowDraft()]);
        return;
      }
      if (action === 'addDeflection' && visibleTab === 'throw') {
        updateThrowDrafts((prev) => addDeflectionToDrafts(prev));
        return;
      }

      if (visibleTab === 'throw') {
        const next = applyPlayerHotkeyToThrowDrafts(throwDrafts, players, key);
        if (next) updateThrowDrafts(next);
        return;
      }
      if (visibleTab === 'error') {
        const offenseChoice = getOtherOffenseChoiceForKey(key);
        if (offenseChoice) {
          event.preventDefault();
          setErrorDraft((prev) => applyOtherOffenseHotkey(prev, offenseChoice));
          return;
        }
        if (errorDraft.noBlockingStarted) return;
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
      gameCompleteIdle,
      effectiveSelectedId,
      handleDelete,
      handleUndo,
      handleRedo,
      handleDone,
      handleInsertBelow,
      handleRestore,
      players,
      throwDrafts,
      updateThrowDrafts,
      visibleTab,
      live.eliminatedGamePlayerIds,
      errorDraft.noBlockingStarted,
    ],
  );

  useDocumentHotkeys(handleTrackGameHotkey, true, { capture: true });

  const youtubePopout = hasYoutube && youtubeMode === 'popout';
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
          {youtubePopout ? (
            <YoutubePopoutBar
              ready={popoutPlayback.ready}
              playing={popoutPlayback.playing}
              displayTime={popoutPlayback.displayTime}
              seekingTo={popoutPlayback.seekingTo}
              blocked={popoutPlayback.blocked}
              handle={popoutPlayback.handle}
              onDockBack={() => dockBack()}
              onModeChange={(next) => setYoutubeModeAndPersist(next)}
            />
          ) : (
            <YoutubePlayer
              ref={youtubePlayerRef}
              youtubeUrl={youtubeUrl}
              mode={youtubeMode}
              onModeChange={setYoutubeModeAndPersist}
              startSeconds={cueSeconds ?? openSeekSeconds ?? undefined}
              onPopOut={popOut}
              popoutBlocked={popoutPlayback.blocked}
            />
          )}
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
            {matchScore ? ` · ${matchScore}` : ''}
            {' · '}
            Home {live.activeHomeCount} / Away {live.activeAwayCount}
            {isGameOver
              ? ` · Out (${live.winningTeamHome ? homeTeam?.Name ?? 'Home' : awayTeam?.Name ?? 'Away'})`
              : ''}
          </Typography>
        ) : (
          <>
            <PageHeader>Track Game</PageHeader>
            {matchId ? <MatchScoreLine matchId={matchId} /> : null}
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

        {wipeAwaitingDone && !gameFinished ? (
          <Typography color="warning.main" sx={{ mb: editorCompact ? 1 : 2 }}>
            All players on one team are out — press Done to finish.
          </Typography>
        ) : null}

        {awaitingFinishConfirm ? (
          <Typography color="warning.main" sx={{ mb: editorCompact ? 1 : 2 }}>
            All players on one team are out — confirm the winner with Enter.
          </Typography>
        ) : null}

        {gameCompleteIdle ? (
          <Stack spacing={2} sx={{ mt: 4 }}>
            <Typography variant="h5">Game Complete!</Typography>
            <Stack direction="row" spacing={1} className="button-row" sx={{ flexWrap: 'wrap' }}>
              <Button
                type="button"
                className="bw-button bw-button--text sk-edit-roster"
                variant="outlined"
                onClick={() => goToGameRoster(gameId)}
              >
                Edit active players
              </Button>
              <Button
                type="button"
                className="bw-button bw-button--text"
                variant="outlined"
                onClick={goToMatch}
              >
                Back to match
              </Button>
              <Button
                type="button"
                className="bw-button bw-button--text"
                variant="contained"
                disabled={!canGoToNextGame}
                onClick={goToNextGame}
              >
                Next game
              </Button>
            </Stack>
          </Stack>
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
                  <Button
                    type="button"
                    className="bw-button bw-button--text sk-edit-roster"
                    size={editorCompact ? 'small' : 'medium'}
                    variant="outlined"
                    onClick={() => goToGameRoster(gameId)}
                  >
                    Edit active players
                  </Button>
                  {(['throw', 'error', 'finish'] as const).map((tab) => (
                    <Box key={tab} className="tab tab--attached">
                      <Button
                        type="button"
                        className="bw-button bw-button--text"
                        size={editorCompact ? 'small' : 'medium'}
                        variant={visibleTab === tab ? 'contained' : 'text'}
                        onClick={() => {
                          if (tab === 'finish' && isGameOver && !gameFinished) {
                            openWipeFinishPrompt();
                            return;
                          }
                          setPendingWipeFinish(false);
                          setActiveTab(tab);
                        }}
                        disabled={gameFinished && tab !== 'finish'}
                      >
                        {tab === 'throw' ? 'Throw' : tab === 'error' ? 'Other' : 'Finish'}
                      </Button>
                    </Box>
                  ))}
                </>
              ) : (
                <Typography
                  variant={editorCompact ? 'body2' : 'subtitle1'}
                  sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                >
                  {lockedTab === 'start'
                    ? 'Game start'
                    : lockedTab === 'error'
                      ? 'Other'
                      : lockedTab}
                </Typography>
              )}

              {wipeAwaitingDone && !lockedTab ? (
                <Button size="small" onClick={handleDone}>
                  Done
                </Button>
              ) : null}

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
            {commitError ? (
              <Alert severity="error" sx={{ mb: 1 }}>
                {commitError}
              </Alert>
            ) : null}
            {staleEliminatedSelections.length > 0 ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {staleEliminatedSelections
                  .map(
                    (row) =>
                      `${row.playerName} went out ${Math.round(row.secondsSinceOut)}s earlier in the video`,
                  )
                  .join('; ')}
                . Recorded anyway — pick again if that is not who you meant.
              </Alert>
            ) : null}
            {visibleTab === 'throw' ? (
              <ThrowEditor
                drafts={throwDrafts}
                players={players}
                homeTeamName={homeTeam?.Name ?? 'Home'}
                awayTeamName={awayTeam?.Name ?? 'Away'}
                eliminatedGamePlayerIds={live.eliminatedGamePlayerIds}
                onChange={updateThrowDrafts}
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
              <TrackGameHotkeyHints hasYoutube={hasYoutube} />
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
          onToggleHighlight={handleToggleHighlight}
          onCommitVideoOffset={handleCommitVideoOffset}
          onSetVideoOffsetFromPlayer={handleSetVideoOffsetFromPlayer}
        />
      </Box>
    </Box>
  );
}
