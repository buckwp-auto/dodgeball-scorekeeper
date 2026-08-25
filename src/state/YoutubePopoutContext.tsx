import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router';
import type { YoutubePlayerHandle } from '../domain/youtube';
import {
  attachedGameIdAfterPopoutOpen,
  matchIdFromPath,
} from '../domain/youtubePopout';
import { useYoutubePopoutController } from '../hooks/useYoutubePopout';

type YoutubePopoutContextValue = {
  active: boolean;
  blocked: boolean;
  ready: boolean;
  playing: boolean;
  displayTime: number;
  seekingTo: number | null;
  handle: YoutubePlayerHandle;
  matchId: string | null;
  videoId: string | null;
  /**
   * Last Track Game id this tab attached to. Set while scoring (even before
   * pop-out) so popping out on the same game does not look like a fresh attach.
   * Cleared when the pop-out switches match/video or fully disconnects.
   */
  attachedGameId: string | null;
  setAttachedGameId: (gameId: string | null) => void;
  open: (matchId: string, videoId: string, startSeconds: number) => boolean;
  disconnect: () => void;
};

const YoutubePopoutContext = createContext<YoutubePopoutContextValue | null>(null);

export function YoutubePopoutProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const routeMatchId = matchIdFromPath(location.pathname);
  const [boundMatchId, setBoundMatchId] = useState<string | null>(null);
  const [boundVideoId, setBoundVideoId] = useState<string | null>(null);
  const [attachedGameId, setAttachedGameId] = useState<string | null>(null);

  const {
    active,
    blocked,
    ready,
    playing,
    displayTime,
    seekingTo,
    handle,
    open: openSession,
    disconnect,
  } = useYoutubePopoutController();

  const clearMatchVideoBinding = useCallback(() => {
    setBoundMatchId(null);
    setBoundVideoId(null);
  }, []);

  const clearAllBindings = useCallback(() => {
    clearMatchVideoBinding();
    setAttachedGameId(null);
  }, [clearMatchVideoBinding]);

  const disconnectAndClear = useCallback(() => {
    disconnect();
    clearAllBindings();
  }, [clearAllBindings, disconnect]);

  useEffect(() => {
    if (!active) {
      // Keep attachedGameId so Track Game's in-page mark survives until the next
      // pop-out open; only drop match/video binding with the closed session.
      clearMatchVideoBinding();
      return;
    }
    if (boundMatchId && routeMatchId !== boundMatchId) {
      disconnectAndClear();
    }
  }, [
    active,
    boundMatchId,
    clearMatchVideoBinding,
    disconnectAndClear,
    routeMatchId,
  ]);

  const open = useCallback(
    (matchId: string, videoId: string, startSeconds: number) => {
      if (active && boundMatchId === matchId && boundVideoId === videoId) {
        return true;
      }
      const nextAttached = attachedGameIdAfterPopoutOpen({
        previousBoundMatchId: boundMatchId,
        previousBoundVideoId: boundVideoId,
        previousAttachedGameId: attachedGameId,
        matchId,
        videoId,
      });
      const opened = openSession(videoId, startSeconds);
      if (!opened) {
        clearAllBindings();
        return false;
      }
      setBoundMatchId(matchId);
      setBoundVideoId(videoId);
      setAttachedGameId(nextAttached);
      return true;
    },
    [
      active,
      attachedGameId,
      boundMatchId,
      boundVideoId,
      clearAllBindings,
      openSession,
    ],
  );

  const value = useMemo<YoutubePopoutContextValue>(
    () => ({
      active,
      blocked,
      ready,
      playing,
      displayTime,
      seekingTo,
      handle,
      matchId: boundMatchId,
      videoId: boundVideoId,
      attachedGameId,
      setAttachedGameId,
      open,
      disconnect: disconnectAndClear,
    }),
    [
      active,
      blocked,
      ready,
      playing,
      displayTime,
      seekingTo,
      handle,
      boundMatchId,
      boundVideoId,
      attachedGameId,
      open,
      disconnectAndClear,
    ],
  );

  return (
    <YoutubePopoutContext.Provider value={value}>{children}</YoutubePopoutContext.Provider>
  );
}

export function useYoutubePopout(): YoutubePopoutContextValue {
  const value = useContext(YoutubePopoutContext);
  if (!value) {
    throw new Error('useYoutubePopout must be used within YoutubePopoutProvider');
  }
  return value;
}
