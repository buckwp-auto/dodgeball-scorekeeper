import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  formatVideoTime,
  parseYoutubeVideoId,
  YOUTUBE_FRAME_BACK_HOTKEY,
  YOUTUBE_FRAME_FORWARD_HOTKEY,
  YOUTUBE_FRAME_SECONDS,
  YOUTUBE_LAYOUT_SMALL_HOTKEY,
  YOUTUBE_LAYOUT_TALL_HOTKEY,
  type YoutubePlayerHandle,
  type YoutubePlayerMode,
} from '../../domain/youtube';
import { HotkeyBadge } from '../HotkeyBadge';
import { TrackGameHotkeysTooltip } from './TrackGameHotkeyHints';

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YtPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YtPlayer;
      PlayerState?: { PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YtPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getPlayerState: () => number;
  getVideoData?: () => { title?: string };
  getIframe?: () => HTMLIFrameElement;
  cueVideoById?: (args: { videoId: string; startSeconds?: number }) => void;
};

let apiLoadPromise: Promise<void> | null = null;

function loadYoutubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.querySelector('script[data-yt-iframe-api]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.ytIframeApi = 'true';
      document.head.appendChild(script);
    }
  });

  return apiLoadPromise;
}

/** Keep keyboard focus on the page so Space / arrows / , . reach our handlers. */
function retainKeyboardFocusOutsideIframe(iframe: HTMLIFrameElement): () => void {
  iframe.setAttribute('tabindex', '-1');
  const onFocus = () => {
    iframe.blur();
    if (document.body.tabIndex < 0) document.body.tabIndex = -1;
    document.body.focus({ preventScroll: true });
  };
  iframe.addEventListener('focus', onFocus);
  return () => iframe.removeEventListener('focus', onFocus);
}

export type { YoutubePlayerHandle };

function PlayerChrome({
  ready,
  playing,
  displayTime,
  videoTitle,
  layout,
  minimal,
  onPlayPause,
  onSeekBy,
  onStepFrame,
  onSetLayout,
  onHide,
  onPopOut,
  onDockBack,
  showTrackGameHints = true,
}: {
  ready: boolean;
  playing: boolean;
  displayTime: number;
  videoTitle: string;
  layout: 'tall' | 'docked' | 'popout' | 'popoutWindow';
  minimal: boolean;
  onPlayPause: () => void;
  onSeekBy: (delta: number) => void;
  onStepFrame: (direction: -1 | 1) => void;
  onSetLayout?: (mode: 'tall' | 'docked') => void;
  onHide?: () => void;
  onPopOut?: () => void;
  onDockBack?: () => void;
  showTrackGameHints?: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        alignItems: 'center',
        px: 1,
        py: 0.5,
        bgcolor: 'grey.800',
        color: 'grey.100',
        flexWrap: 'wrap',
        rowGap: 0.5,
      }}
    >
      <IconButton
        size="small"
        color="inherit"
        aria-label={playing ? 'Pause' : 'Play'}
        disabled={!ready}
        onClick={onPlayPause}
      >
        {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
      </IconButton>
      {!minimal ? (
        <>
          <Button size="small" color="inherit" disabled={!ready} onClick={() => onSeekBy(-5)}>
            −5s
          </Button>
          <Button size="small" color="inherit" disabled={!ready} onClick={() => onSeekBy(5)}>
            +5s
          </Button>
        </>
      ) : null}
      <Button
        size="small"
        color="inherit"
        disabled={!ready || playing}
        onClick={() => onStepFrame(-1)}
        title="Previous frame when paused"
      >
        <HotkeyBadge hotkey={YOUTUBE_FRAME_BACK_HOTKEY} />
      </Button>
      <Button
        size="small"
        color="inherit"
        disabled={!ready || playing}
        onClick={() => onStepFrame(1)}
        title="Next frame when paused"
      >
        <HotkeyBadge hotkey={YOUTUBE_FRAME_FORWARD_HOTKEY} />
      </Button>
      <Typography variant="caption" sx={{ minWidth: 48, fontVariantNumeric: 'tabular-nums' }}>
        {formatVideoTime(displayTime)}
      </Typography>
      {videoTitle ? (
        <Typography
          variant="caption"
          noWrap
          title={videoTitle}
          sx={{ maxWidth: minimal ? 160 : 280, opacity: 0.85 }}
        >
          {videoTitle}
        </Typography>
      ) : null}
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        {showTrackGameHints && (layout === 'tall' || layout === 'popoutWindow') ? (
          <TrackGameHotkeysTooltip />
        ) : null}
        {onPopOut ? (
          <Button
            size="small"
            color="inherit"
            startIcon={<OpenInNewIcon fontSize="small" />}
            onClick={onPopOut}
            title="Open video in a second window"
          >
            Pop out
          </Button>
        ) : null}
        {onDockBack ? (
          <Button size="small" color="inherit" variant="outlined" onClick={onDockBack}>
            Dock back
          </Button>
        ) : null}
        {onSetLayout ? (
          <>
            <HotkeyBadge hotkey={YOUTUBE_LAYOUT_SMALL_HOTKEY} />
            <Button
              size="small"
              color="inherit"
              variant={layout === 'docked' ? 'outlined' : 'text'}
              onClick={() => onSetLayout('docked')}
            >
              Small
            </Button>
            <HotkeyBadge hotkey={YOUTUBE_LAYOUT_TALL_HOTKEY} />
            <Button
              size="small"
              color="inherit"
              variant={layout === 'tall' ? 'outlined' : 'text'}
              onClick={() => onSetLayout('tall')}
            >
              Tall
            </Button>
          </>
        ) : null}
        {onHide ? (
          <IconButton size="small" color="inherit" aria-label="Hide player" onClick={onHide}>
            <VisibilityOffIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Stack>
    </Stack>
  );
}

export const YoutubePlayer = forwardRef<
  YoutubePlayerHandle,
  {
    youtubeUrl: string;
    mode: YoutubePlayerMode;
    onModeChange: (mode: YoutubePlayerMode) => void;
    /** Seconds to cue on first load (paused). Timeline seeks do not use this. */
    startSeconds?: number | null;
    variant?: 'page' | 'popoutWindow';
    onPopOut?: () => void;
    onDockBack?: () => void;
    popoutBlocked?: boolean;
    showTrackGameHints?: boolean;
    allowLayoutToggle?: boolean;
  }
>(function YoutubePlayer(
  {
    youtubeUrl,
    mode,
    onModeChange,
    startSeconds = null,
    variant = 'page',
    onPopOut,
    onDockBack,
    popoutBlocked = false,
    showTrackGameHints = true,
    allowLayoutToggle = true,
  },
  ref,
) {
  const videoId = parseYoutubeVideoId(youtubeUrl);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const releaseIframeFocusRef = useRef<(() => void) | null>(null);
  const pendingSeekSecondsRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [videoTitle, setVideoTitle] = useState('');
  const [embedError, setEmbedError] = useState<string | null>(null);

  const seekBy = (deltaSeconds: number) => {
    const player = playerRef.current;
    if (!ready || !player || mode === 'hidden') return;
    try {
      const next = Math.max(0, player.getCurrentTime() + deltaSeconds);
      player.seekTo(next, true);
      setDisplayTime(next);
    } catch {
      /* ignore */
    }
  };

  const togglePlayPause = () => {
    const player = playerRef.current;
    if (!ready || !player || mode === 'hidden') return;
    try {
      if (player.getPlayerState() === 1) player.pauseVideo();
      else player.playVideo();
    } catch {
      /* ignore */
    }
  };

  const stepFrame = (direction: -1 | 1) => {
    const player = playerRef.current;
    if (!ready || !player || mode === 'hidden') return;
    try {
      // Match YouTube: , / . only step while paused (not playing)
      const state = player.getPlayerState();
      if (state === 1) return;
      const next = Math.max(0, player.getCurrentTime() + direction * YOUTUBE_FRAME_SECONDS);
      player.seekTo(next, true);
      // Nudge pause so the iframe paints the new frame
      player.pauseVideo();
      setDisplayTime(next);
    } catch {
      /* ignore */
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      getCurrentTime: () => {
        if (!ready || !playerRef.current || mode === 'hidden') return null;
        try {
          return playerRef.current.getCurrentTime();
        } catch {
          return null;
        }
      },
      seekTo: (seconds: number) => {
        if (!ready || !playerRef.current || mode === 'hidden') {
          pendingSeekSecondsRef.current = seconds;
          return;
        }
        try {
          playerRef.current.seekTo(seconds, true);
          setDisplayTime(seconds);
          pendingSeekSecondsRef.current = null;
        } catch {
          pendingSeekSecondsRef.current = seconds;
        }
      },
      seekBy,
      togglePlayPause,
      stepFrame,
      isPaused: () => {
        if (!ready || !playerRef.current || mode === 'hidden') return true;
        try {
          return playerRef.current.getPlayerState() !== 1;
        } catch {
          return true;
        }
      },
    }),
    [ready, mode],
  );

  useEffect(() => {
    if (!videoId || mode === 'hidden') {
      releaseIframeFocusRef.current?.();
      releaseIframeFocusRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
      pendingSeekSecondsRef.current = null;
      setReady(false);
      return;
    }

    let cancelled = false;
    setEmbedError(null);
    setReady(false);

    void loadYoutubeIframeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT?.Player) return;
      releaseIframeFocusRef.current?.();
      releaseIframeFocusRef.current = null;
      playerRef.current?.destroy();
      // YT.Player replaces its mount node with an iframe. Keep that iframe
      // off React's reconcile path or setState in onReady will wipe the embed.
      const host = mountRef.current;
      host.replaceChildren();
      const target = document.createElement('div');
      target.style.width = '100%';
      target.style.height = '100%';
      host.appendChild(target);

      const pending = pendingSeekSecondsRef.current;
      const cueAt =
        pending ??
        (startSeconds != null && Number.isFinite(startSeconds)
          ? Math.max(0, startSeconds)
          : 0);
      pendingSeekSecondsRef.current = null;

      playerRef.current = new window.YT.Player(target, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          origin: window.location.origin,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          autoplay: 0,
          start: Math.floor(cueAt),
          // Prefer our page-level Space / arrows / , . handlers
          disablekb: 1,
        },
        events: {
          onReady: (event: { target: YtPlayer }) => {
            if (cancelled) return;
            setReady(true);
            try {
              setVideoTitle(event.target.getVideoData?.()?.title?.trim() || '');
            } catch {
              setVideoTitle('');
            }
            try {
              const iframe = event.target.getIframe?.();
              if (iframe) {
                releaseIframeFocusRef.current = retainKeyboardFocusOutsideIframe(iframe);
              }
            } catch {
              /* ignore */
            }
            const lateSeek = pendingSeekSecondsRef.current;
            if (lateSeek !== null) {
              pendingSeekSecondsRef.current = null;
              try {
                event.target.cueVideoById?.({
                  videoId,
                  startSeconds: lateSeek,
                });
                setDisplayTime(lateSeek);
              } catch {
                /* playerVars.start already applied */
              }
            } else if (cueAt > 0) {
              setDisplayTime(cueAt);
            }
          },
          onError: () => {
            if (!cancelled) {
              setEmbedError(
                'This video cannot be embedded. Open it on YouTube; scoring still works without timestamps.',
              );
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      releaseIframeFocusRef.current?.();
      releaseIframeFocusRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, mode === 'hidden' ? 'hidden' : 'visible', startSeconds]);

  useEffect(() => {
    if (!ready || mode === 'hidden') return;
    const onPointerDown = () => {
      // After interacting with the embed, return keyboard focus to the page
      window.setTimeout(() => {
        const active = document.activeElement;
        if (
          active instanceof HTMLIFrameElement &&
          active.closest('.sk-youtube-player')
        ) {
          active.blur();
          if (document.body.tabIndex < 0) document.body.tabIndex = -1;
          document.body.focus({ preventScroll: true });
        }
      }, 0);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [ready, mode]);

  useEffect(() => {
    if (!ready || mode === 'hidden') return;
    const id = window.setInterval(() => {
      try {
        const player = playerRef.current;
        if (!player) return;
        setDisplayTime(player.getCurrentTime());
        setPlaying(player.getPlayerState() === 1);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [ready, mode]);

  if (!videoId) {
    return (
      <Alert severity="warning" sx={{ borderRadius: 0 }}>
        Invalid YouTube URL on this match.
      </Alert>
    );
  }

  if (mode === 'hidden') {
    return (
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'grey.100',
        }}
      >
        <Button size="small" onClick={() => onModeChange('tall')}>
          Show video
        </Button>
        <HotkeyBadge hotkey={YOUTUBE_LAYOUT_TALL_HOTKEY} />
        <Typography variant="caption" color="text.secondary">
          Timestamps pause while hidden
        </Typography>
      </Stack>
    );
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const isPopoutWindow = variant === 'popoutWindow';
  const layout = isPopoutWindow ? 'popoutWindow' : mode === 'docked' ? 'docked' : 'tall';
  const isTall = layout === 'tall' || layout === 'popoutWindow';

  const chrome = (
    <PlayerChrome
      ready={ready}
      playing={playing}
      displayTime={displayTime}
      videoTitle={videoTitle}
      layout={layout}
      minimal={!isTall}
      onPlayPause={togglePlayPause}
      onSeekBy={seekBy}
      onStepFrame={stepFrame}
      onSetLayout={
        isPopoutWindow || !allowLayoutToggle
          ? undefined
          : (next) => onModeChange(next)
      }
      onHide={isPopoutWindow ? undefined : () => onModeChange('hidden')}
      onPopOut={isPopoutWindow ? undefined : onPopOut}
      onDockBack={onDockBack}
      showTrackGameHints={showTrackGameHints}
    />
  );

  const frame = (
    <Box
      sx={{
        ...(isTall
          ? {
              flex: 1,
              minHeight: 0,
              containerType: 'size',
              display: 'grid',
              placeItems: 'center',
              bgcolor: '#000',
            }
          : {
              bgcolor: '#000',
            }),
      }}
    >
      <Box
        sx={{
          position: 'relative',
          bgcolor: '#000',
          aspectRatio: '16 / 9',
          ...(isTall
            ? {
                width: 'min(100cqw, calc(100cqh * 16 / 9))',
                maxHeight: '100%',
              }
            : {
                width: 'min(100%, 640px, calc(28vh * 16 / 9))',
                maxHeight: '28vh',
                mx: 'auto',
              }),
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      className="sk-youtube-player"
      sx={{
        borderBottom: isTall ? 1 : 0,
        borderColor: 'divider',
        bgcolor: 'grey.900',
        color: 'grey.100',
        width: '100%',
        height: isTall ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {chrome}
      {popoutBlocked ? (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          Pop-out was blocked. Allow pop-ups for this site and try again.
        </Alert>
      ) : null}
      {isPopoutWindow ? (
        <Typography variant="caption" sx={{ px: 1.5, py: 0.5, opacity: 0.8 }}>
          Fullscreen this window (F11), not YouTube’s fullscreen button. Scoring
          hotkeys work from either window.
        </Typography>
      ) : null}
      {embedError ? (
        <Alert
          severity="warning"
          sx={{ borderRadius: 0 }}
          action={
            <Button
              color="inherit"
              size="small"
              href={watchUrl}
              target="_blank"
              rel="noreferrer"
              component="a"
            >
              Open on YouTube
            </Button>
          }
        >
          {embedError}
        </Alert>
      ) : null}
      {frame}
    </Box>
  );
});

export function YoutubePopoutBar({
  ready,
  playing,
  displayTime,
  blocked,
  handle,
  onDockBack,
  onModeChange,
}: {
  ready: boolean;
  playing: boolean;
  displayTime: number;
  blocked?: boolean;
  handle: YoutubePlayerHandle;
  onDockBack: () => void;
  onModeChange: (mode: 'tall' | 'docked') => void;
}) {
  return (
    <Box
      className="sk-youtube-player"
      sx={{ bgcolor: 'grey.900', color: 'grey.100', borderBottom: 1, borderColor: 'divider' }}
    >
      {blocked ? (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          Pop-out was blocked. Allow pop-ups for this site and try again.
        </Alert>
      ) : null}
      <PlayerChrome
        ready={ready}
        playing={playing}
        displayTime={displayTime}
        videoTitle=""
        layout="popout"
        minimal
        onPlayPause={() => handle.togglePlayPause()}
        onSeekBy={(delta) => handle.seekBy(delta)}
        onStepFrame={(direction) => handle.stepFrame(direction)}
        onSetLayout={onModeChange}
        onDockBack={onDockBack}
      />
      <Typography variant="caption" sx={{ display: 'block', px: 1.5, py: 0.5, opacity: 0.8 }}>
        Video is in the pop-out window. Fullscreen that window (F11), not YouTube’s
        button. Scoring hotkeys work from either window.
      </Typography>
    </Box>
  );
}
