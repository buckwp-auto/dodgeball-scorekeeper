import { useCallback, useRef, useState } from 'react';
import type { YoutubePlayerHandle } from '../components/trackGame/YoutubePlayer';
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
import { useDocumentHotkeys } from './useDocumentHotkeys';

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
  const playerRef = useRef<YoutubePlayerHandle | null>(null);
  const [mode, setMode] = useState<YoutubePlayerMode>(() =>
    loadYoutubePlayerMode(),
  );
  const hasYoutube = Boolean(parseYoutubeVideoId(youtubeUrl));

  const setModeAndPersist = useCallback((next: YoutubePlayerMode) => {
    setMode(next);
    saveYoutubePlayerMode(next);
  }, []);

  const readVideoOffset = useCallback(
    () => playerRef.current?.getCurrentTime() ?? null,
    [],
  );

  const seekToVideoOffset = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds);
  }, []);

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
        playerRef.current?.togglePlayPause();
      } else if (key === YOUTUBE_SEEK_BACK_HOTKEY) {
        event.preventDefault();
        playerRef.current?.seekBy(-YOUTUBE_SEEK_SECONDS);
      } else if (key === YOUTUBE_SEEK_FORWARD_HOTKEY) {
        event.preventDefault();
        playerRef.current?.seekBy(YOUTUBE_SEEK_SECONDS);
      } else if (
        key === YOUTUBE_FRAME_BACK_HOTKEY ||
        key === YOUTUBE_FRAME_FORWARD_HOTKEY
      ) {
        event.preventDefault();
        if (playerRef.current?.isPaused()) {
          playerRef.current.stepFrame(
            key === YOUTUBE_FRAME_BACK_HOTKEY ? -1 : 1,
          );
        }
      }
    },
    [hasYoutube, mode, setModeAndPersist],
  );

  useDocumentHotkeys(handleHotkey, hasYoutube, { capture: true });

  return {
    hasYoutube,
    mode,
    playerRef,
    readVideoOffset,
    seekToVideoOffset,
    setModeAndPersist,
  };
}
