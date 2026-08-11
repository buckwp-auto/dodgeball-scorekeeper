import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { YoutubePlayerHandle } from '../domain/youtube';
import {
  applyYoutubePopoutCommand,
  buildYoutubePopoutHref,
  createRemoteYoutubePlayerHandle,
  dispatchYoutubePopoutKeydown,
  envelopeYoutubePopoutMessage,
  isYoutubePopoutControllerMessage,
  isYoutubePopoutHostMessage,
  YOUTUBE_POPOUT_SEEK_TIMEOUT_MS,
  youtubePopoutChannelName,
  youtubePopoutSeekSettled,
  type YoutubePopoutControllerEnvelope,
  type YoutubePopoutSnapshot,
} from '../domain/youtubePopout';

const POPUP_FEATURES = 'popup=yes,width=1280,height=720';

function newPopoutSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `yt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useYoutubePopoutController() {
  const [active, setActive] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [seekingTo, setSeekingTo] = useState<number | null>(null);

  const snapshotRef = useRef<YoutubePopoutSnapshot>({
    currentTime: 0,
    playing: false,
    ready: false,
  });
  const channelRef = useRef<BroadcastChannel | null>(null);
  const popupRef = useRef<Window | null>(null);
  const activeRef = useRef(false);
  const onGoneRef = useRef<(() => void) | null>(null);
  const seekingToRef = useRef<number | null>(null);
  const seekTimeoutRef = useRef<number | null>(null);

  const clearSeekTimeout = useCallback(() => {
    if (seekTimeoutRef.current != null) {
      window.clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
  }, []);

  const clearSeeking = useCallback(() => {
    clearSeekTimeout();
    seekingToRef.current = null;
    setSeekingTo(null);
  }, [clearSeekTimeout]);

  const beginSeeking = useCallback(
    (seconds: number) => {
      clearSeekTimeout();
      seekingToRef.current = seconds;
      setSeekingTo(seconds);
      seekTimeoutRef.current = window.setTimeout(() => {
        seekingToRef.current = null;
        setSeekingTo(null);
        seekTimeoutRef.current = null;
      }, YOUTUBE_POPOUT_SEEK_TIMEOUT_MS);
    },
    [clearSeekTimeout],
  );

  const notePlayerTime = useCallback(
    (currentTime: number) => {
      const target = seekingToRef.current;
      if (target != null && youtubePopoutSeekSettled(currentTime, target)) {
        clearSeeking();
      }
    },
    [clearSeeking],
  );

  const syncUiFromSnapshot = useCallback(() => {
    const snap = snapshotRef.current;
    setReady(snap.ready);
    setPlaying(snap.playing);
    setDisplayTime(snap.currentTime);
  }, []);

  const teardown = useCallback(
    (notifyHost: boolean) => {
      clearSeeking();
      if (notifyHost) {
        try {
          channelRef.current?.postMessage(
            envelopeYoutubePopoutMessage({ type: 'shutdown' }),
          );
        } catch {
          /* ignore */
        }
        try {
          popupRef.current?.close();
        } catch {
          /* ignore */
        }
      }
      try {
        channelRef.current?.close();
      } catch {
        /* ignore */
      }
      channelRef.current = null;
      popupRef.current = null;
      activeRef.current = false;
      setActive(false);
      setReady(false);
      setPlaying(false);
    },
    [clearSeeking],
  );

  const postRef = useRef<(message: YoutubePopoutControllerEnvelope) => void>(() => {});
  postRef.current = (message) => {
    if (message.type === 'command' && message.op === 'seekTo') {
      beginSeeking(message.seconds);
    }
    try {
      channelRef.current?.postMessage(message);
    } catch {
      /* ignore */
    }
  };

  const handle = useMemo(
    () =>
      createRemoteYoutubePlayerHandle({
        post: (message) => postRef.current(message),
        getSnapshot: () => snapshotRef.current,
        onOptimisticChange: syncUiFromSnapshot,
      }),
    [syncUiFromSnapshot],
  );

  const open = useCallback(
    (videoId: string, startSeconds: number) => {
      if (typeof BroadcastChannel === 'undefined') {
        setBlocked(true);
        return false;
      }
      teardown(true);
      const sessionId = newPopoutSessionId();
      const channel = new BroadcastChannel(youtubePopoutChannelName(sessionId));
      channel.onmessage = (event: MessageEvent) => {
        if (!isYoutubePopoutHostMessage(event.data)) return;
        if (event.data.type === 'goodbye') {
          const gone = onGoneRef.current;
          teardown(false);
          gone?.();
          return;
        }
        if (event.data.type === 'keydown') {
          dispatchYoutubePopoutKeydown(event.data);
          return;
        }
        snapshotRef.current.currentTime = event.data.currentTime;
        snapshotRef.current.playing = event.data.playing;
        snapshotRef.current.ready = true;
        notePlayerTime(event.data.currentTime);
        syncUiFromSnapshot();
      };
      channelRef.current = channel;
      snapshotRef.current = {
        currentTime: Math.max(0, startSeconds),
        playing: false,
        ready: false,
      };
      syncUiFromSnapshot();

      const href = buildYoutubePopoutHref({ videoId, startSeconds, sessionId });
      const popup = window.open(href, `sk-yt-${sessionId}`, POPUP_FEATURES);
      if (!popup) {
        try {
          channel.close();
        } catch {
          /* ignore */
        }
        channelRef.current = null;
        setBlocked(true);
        return false;
      }
      popupRef.current = popup;
      activeRef.current = true;
      setBlocked(false);
      setActive(true);
      try {
        popup.focus();
      } catch {
        /* ignore */
      }
      return true;
    },
    [notePlayerTime, syncUiFromSnapshot, teardown],
  );

  const disconnect = useCallback(() => {
    if (!activeRef.current) return;
    teardown(true);
  }, [teardown]);

  const setOnGone = useCallback((callback: (() => void) | null) => {
    onGoneRef.current = callback;
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      try {
        if (popupRef.current?.closed) {
          const gone = onGoneRef.current;
          teardown(false);
          gone?.();
        }
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearInterval(id);
  }, [active, teardown]);

  useEffect(() => {
    const onUnload = () => teardown(true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      teardown(true);
    };
  }, [teardown]);

  return {
    active,
    blocked,
    ready,
    playing,
    displayTime,
    seekingTo,
    handle,
    open,
    disconnect,
    setOnGone,
  };
}

export function useYoutubePopoutHost(options: {
  sessionId: string;
  playerRef: RefObject<YoutubePlayerHandle | null>;
  enabled?: boolean;
}) {
  const { sessionId, playerRef, enabled = true } = options;
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [seekingTo, setSeekingTo] = useState<number | null>(null);
  const seekingToRef = useRef<number | null>(null);
  const seekTimeoutRef = useRef<number | null>(null);

  const clearSeekTimeout = useCallback(() => {
    if (seekTimeoutRef.current != null) {
      window.clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
  }, []);

  const clearSeeking = useCallback(() => {
    clearSeekTimeout();
    seekingToRef.current = null;
    setSeekingTo(null);
  }, [clearSeekTimeout]);

  const beginSeeking = useCallback(
    (seconds: number) => {
      clearSeekTimeout();
      seekingToRef.current = seconds;
      setSeekingTo(seconds);
      seekTimeoutRef.current = window.setTimeout(() => {
        seekingToRef.current = null;
        setSeekingTo(null);
        seekTimeoutRef.current = null;
      }, YOUTUBE_POPOUT_SEEK_TIMEOUT_MS);
    },
    [clearSeekTimeout],
  );

  const postGoodbye = useCallback(() => {
    try {
      channelRef.current?.postMessage(
        envelopeYoutubePopoutMessage({ type: 'goodbye' }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const requestClose = useCallback(() => {
    postGoodbye();
    window.close();
  }, [postGoodbye]);

  useEffect(() => {
    if (!enabled || !sessionId || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(youtubePopoutChannelName(sessionId));
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      if (!isYoutubePopoutControllerMessage(event.data)) return;
      if (event.data.type === 'shutdown') {
        postGoodbye();
        window.close();
        return;
      }
      if (event.data.op === 'seekTo') {
        beginSeeking(event.data.seconds);
      }
      applyYoutubePopoutCommand(playerRef.current, event.data);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'F11' || event.key === 'Escape') return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (target?.isContentEditable) return;
      event.preventDefault();
      try {
        channel.postMessage(
          envelopeYoutubePopoutMessage({
            type: 'keydown',
            key: event.key,
            code: event.code,
            repeat: event.repeat,
            shiftKey: event.shiftKey,
          }),
        );
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('keydown', onKeyDown, true);

    const pollId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const currentTime = player.getCurrentTime();
      if (currentTime == null) return;
      const target = seekingToRef.current;
      if (target != null && youtubePopoutSeekSettled(currentTime, target)) {
        clearSeeking();
      }
      try {
        channel.postMessage(
          envelopeYoutubePopoutMessage({
            type: 'state',
            currentTime,
            playing: !player.isPaused(),
          }),
        );
      } catch {
        /* ignore */
      }
    }, 100);

    const onUnload = () => postGoodbye();
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('beforeunload', onUnload);
      window.clearInterval(pollId);
      clearSeeking();
      try {
        channel.close();
      } catch {
        /* ignore */
      }
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [
    beginSeeking,
    clearSeeking,
    enabled,
    playerRef,
    postGoodbye,
    sessionId,
  ]);

  return { requestClose, seekingTo };
}
