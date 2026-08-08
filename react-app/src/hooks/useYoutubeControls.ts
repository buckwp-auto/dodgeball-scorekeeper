import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useDocumentHotkeys } from './useDocumentHotkeys';
import { useYoutubePopoutController } from './useYoutubePopout';

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

export function useYoutubeControls(youtubeUrl: string) {
  const localPlayerRef = useRef<YoutubePlayerHandle | null>(null);
  const [mode, setMode] = useState<YoutubePlayerMode>(() =>
    loadYoutubePlayerMode(),
  );
  const [cueSeconds, setCueSeconds] = useState<number | null>(null);
  const hasYoutube = Boolean(parseYoutubeVideoId(youtubeUrl));
  const dockBackModeRef = useRef<YoutubeInPageMode>(loadYoutubePlayerMode());
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const {
    blocked: popoutBlocked,
    ready: popoutReady,
    playing: popoutPlaying,
    displayTime: popoutDisplayTime,
    handle: popoutHandle,
    open: openPopout,
    disconnect: disconnectPopout,
    setOnGone,
  } = useYoutubePopoutController();

  const activePlayer = useCallback((): YoutubePlayerHandle | null => {
    if (modeRef.current === 'popout') return popoutHandle;
    return localPlayerRef.current;
  }, [popoutHandle]);

  const persistInPageMode = useCallback((next: YoutubeInPageMode) => {
    dockBackModeRef.current = next;
    saveYoutubePlayerMode(next);
  }, []);

  const dockBack = useCallback(
    (nextMode?: YoutubeInPageMode) => {
      if (modeRef.current !== 'popout') return;
      const time = popoutHandle.getCurrentTime();
      disconnectPopout();
      if (time != null && Number.isFinite(time)) setCueSeconds(time);
      const resolved = nextMode ?? dockBackModeRef.current;
      modeRef.current = resolved;
      setMode(resolved);
      persistInPageMode(resolved);
    },
    [disconnectPopout, persistInPageMode, popoutHandle],
  );

  useEffect(() => {
    setOnGone(() => {
      if (modeRef.current === 'popout') dockBack();
    });
    return () => setOnGone(null);
  }, [dockBack, setOnGone]);

  const popOut = useCallback(() => {
    const videoId = parseYoutubeVideoId(youtubeUrl);
    if (!videoId) return;
    const current = localPlayerRef.current?.getCurrentTime();
    const startSeconds =
      current != null && Number.isFinite(current) ? current : (cueSeconds ?? 0);
    if (isYoutubeInPageMode(modeRef.current)) {
      persistInPageMode(modeRef.current);
    }
    const opened = openPopout(videoId, startSeconds);
    if (!opened) return;
    modeRef.current = 'popout';
    setMode('popout');
  }, [cueSeconds, openPopout, persistInPageMode, youtubeUrl]);

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
      modeRef.current = next;
      setMode(next);
      persistInPageMode(next);
    },
    [dockBack, persistInPageMode, popOut],
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
        event.preventDefault();
        setModeAndPersist('docked');
      } else if (key === YOUTUBE_LAYOUT_TALL_HOTKEY) {
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
    [activePlayer, hasYoutube, mode, setModeAndPersist],
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
      blocked: popoutBlocked,
      handle: popoutHandle,
    },
  };
}
