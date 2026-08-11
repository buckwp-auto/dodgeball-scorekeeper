import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { YoutubePlayerHandle } from '../domain/youtube';
import {
  isYoutubeInPageMode,
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
  type YoutubeInPageMode,
  type YoutubePlayerMode,
} from '../domain/youtube';
import { matchIdFromPath } from '../domain/youtubePopout';
import { logVideoPlayerMode } from '../cloud/logAnalytics';
import { useDocumentHotkeys } from './useDocumentHotkeys';
import { useYoutubePopout } from '../state/YoutubePopoutContext';

const YOUTUBE_CONTROL_HOTKEYS = new Set([
  YOUTUBE_LAYOUT_SMALL_HOTKEY,
  YOUTUBE_LAYOUT_TALL_HOTKEY,
  YOUTUBE_PLAY_PAUSE_HOTKEY,
  YOUTUBE_SEEK_BACK_HOTKEY,
  YOUTUBE_SEEK_FORWARD_HOTKEY,
  YOUTUBE_FRAME_BACK_HOTKEY,
  YOUTUBE_FRAME_FORWARD_HOTKEY,
]);

export function isYoutubeControlHotkey(key: string): boolean {
  return YOUTUBE_CONTROL_HOTKEYS.has(key);
}

function popoutAppliesTo(
  popout: { active: boolean; matchId: string | null; videoId: string | null },
  matchId: string | null,
  videoId: string | null,
): boolean {
  return (
    popout.active &&
    Boolean(matchId) &&
    Boolean(videoId) &&
    popout.matchId === matchId &&
    popout.videoId === videoId
  );
}

export function useYoutubeControls(
  youtubeUrl: string,
  options?: { enableLayoutHotkeys?: boolean },
) {
  const enableLayoutHotkeys = options?.enableLayoutHotkeys ?? true;
  const location = useLocation();
  const routeMatchId = matchIdFromPath(location.pathname);
  const videoId = parseYoutubeVideoId(youtubeUrl);
  const hasYoutube = Boolean(videoId);

  const popout = useYoutubePopout();
  const popoutForThisVideo = popoutAppliesTo(popout, routeMatchId, videoId);

  const localPlayerRef = useRef<YoutubePlayerHandle | null>(null);
  const [mode, setMode] = useState<YoutubePlayerMode>(() =>
    popoutForThisVideo ? 'popout' : loadYoutubePlayerMode(),
  );
  const [cueSeconds, setCueSeconds] = useState<number | null>(null);
  const dockBackModeRef = useRef<YoutubeInPageMode>(loadYoutubePlayerMode());
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const wasPopoutForThisRef = useRef(popoutForThisVideo);

  const {
    blocked: popoutBlocked,
    ready: popoutReady,
    playing: popoutPlaying,
    displayTime: popoutDisplayTime,
    seekingTo: popoutSeekingTo,
    handle: popoutHandle,
    open: openPopout,
    disconnect: disconnectPopout,
  } = popout;

  const activePlayer = useCallback((): YoutubePlayerHandle | null => {
    if (modeRef.current === 'popout') return popoutHandle;
    return localPlayerRef.current;
  }, [popoutHandle]);

  const persistInPageMode = useCallback((next: YoutubeInPageMode) => {
    dockBackModeRef.current = next;
    saveYoutubePlayerMode(next);
  }, []);

  const commitMode = useCallback((next: YoutubePlayerMode) => {
    const from = modeRef.current;
    if (from === next) return;
    modeRef.current = next;
    setMode(next);
    logVideoPlayerMode(from, next);
  }, []);

  const dockBack = useCallback(
    (nextMode?: YoutubeInPageMode) => {
      if (modeRef.current !== 'popout') return;
      const time = popoutHandle.getCurrentTime();
      disconnectPopout();
      if (time != null && Number.isFinite(time)) setCueSeconds(time);
      const resolved = nextMode ?? dockBackModeRef.current;
      commitMode(resolved);
      persistInPageMode(resolved);
    },
    [commitMode, disconnectPopout, persistInPageMode, popoutHandle],
  );

  useEffect(() => {
    const was = wasPopoutForThisRef.current;
    wasPopoutForThisRef.current = popoutForThisVideo;

    if (popoutForThisVideo) {
      if (modeRef.current !== 'popout') {
        if (isYoutubeInPageMode(modeRef.current)) {
          persistInPageMode(modeRef.current);
        }
        commitMode('popout');
      }
      return;
    }

    if (was && modeRef.current === 'popout') {
      if (Number.isFinite(popoutDisplayTime)) setCueSeconds(popoutDisplayTime);
      const resolved = dockBackModeRef.current;
      commitMode(resolved);
      persistInPageMode(resolved);
      // URL/match mismatch can leave an orphaned window; close it. Already-closed
      // sessions are inactive and this is a no-op.
      if (popout.active) disconnectPopout();
    }
  }, [
    commitMode,
    disconnectPopout,
    persistInPageMode,
    popout.active,
    popoutDisplayTime,
    popoutForThisVideo,
  ]);

  const popOut = useCallback(() => {
    if (!routeMatchId || !videoId) return;
    if (popoutAppliesTo(popout, routeMatchId, videoId)) {
      commitMode('popout');
      return;
    }
    const current = localPlayerRef.current?.getCurrentTime();
    const startSeconds =
      current != null && Number.isFinite(current) ? current : (cueSeconds ?? 0);
    if (isYoutubeInPageMode(modeRef.current)) {
      persistInPageMode(modeRef.current);
    }
    const opened = openPopout(routeMatchId, videoId, startSeconds);
    if (!opened) return;
    commitMode('popout');
  }, [commitMode, cueSeconds, openPopout, persistInPageMode, popout, routeMatchId, videoId]);

  const setModeAndPersist = useCallback(
    (next: YoutubePlayerMode) => {
      if (next === 'popout') {
        popOut();
        return;
      }
      if (modeRef.current === 'popout') {
        dockBack(next);
        return;
      }
      commitMode(next);
      persistInPageMode(next);
    },
    [commitMode, dockBack, persistInPageMode, popOut],
  );

  const readVideoOffset = useCallback(
    () => activePlayer()?.getCurrentTime() ?? null,
    [activePlayer],
  );

  const seekToVideoOffset = useCallback(
    (seconds: number) => {
      activePlayer()?.seekTo(seconds);
    },
    [activePlayer],
  );

  const handleHotkey = useCallback(
    (key: string, event: KeyboardEvent) => {
      if (!hasYoutube || mode === 'hidden') return;

      if (document.activeElement instanceof HTMLIFrameElement) {
        document.activeElement.blur();
      }

      if (key === YOUTUBE_LAYOUT_SMALL_HOTKEY) {
        if (!enableLayoutHotkeys) return;
        event.preventDefault();
        setModeAndPersist('docked');
      } else if (key === YOUTUBE_LAYOUT_TALL_HOTKEY) {
        if (!enableLayoutHotkeys) return;
        event.preventDefault();
        setModeAndPersist('tall');
      } else if (key === YOUTUBE_PLAY_PAUSE_HOTKEY) {
        event.preventDefault();
        activePlayer()?.togglePlayPause();
      } else if (key === YOUTUBE_SEEK_BACK_HOTKEY) {
        event.preventDefault();
        activePlayer()?.seekBy(-YOUTUBE_SEEK_SECONDS);
      } else if (key === YOUTUBE_SEEK_FORWARD_HOTKEY) {
        event.preventDefault();
        activePlayer()?.seekBy(YOUTUBE_SEEK_SECONDS);
      } else if (
        key === YOUTUBE_FRAME_BACK_HOTKEY ||
        key === YOUTUBE_FRAME_FORWARD_HOTKEY
      ) {
        event.preventDefault();
        if (activePlayer()?.isPaused()) {
          activePlayer()?.stepFrame(
            key === YOUTUBE_FRAME_BACK_HOTKEY ? -1 : 1,
          );
        }
      }
    },
    [activePlayer, enableLayoutHotkeys, hasYoutube, mode, setModeAndPersist],
  );

  useDocumentHotkeys(handleHotkey, hasYoutube, { capture: true });

  return {
    hasYoutube,
    mode,
    playerRef: localPlayerRef,
    readVideoOffset,
    seekToVideoOffset,
    setModeAndPersist,
    cueSeconds,
    popOut,
    dockBack,
    popoutPlayback: {
      ready: popoutReady,
      playing: popoutPlaying,
      displayTime: popoutDisplayTime,
      seekingTo: popoutSeekingTo,
      blocked: popoutBlocked,
      handle: popoutHandle,
    },
  };
}
