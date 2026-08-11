import {
  parseYoutubeVideoId,
  YOUTUBE_FRAME_SECONDS,
  type YoutubePlayerHandle,
} from './youtube';

export const YOUTUBE_POPOUT_PATH = '/youtube-popout';
export const YOUTUBE_POPOUT_MESSAGE_KIND = 'sk-yt-popout';

/** Match id from a router pathname (basename already stripped), or null. */
export function matchIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'matches' && parts[1]) return parts[1];
  return null;
}

export type YoutubePopoutSnapshot = {
  currentTime: number;
  playing: boolean;
  ready: boolean;
};

/** How close the player head must get before a pending auto-seek is considered done. */
export const YOUTUBE_POPOUT_SEEK_SETTLED_SECONDS = 1.25;
/** Max time to show the seeking spinner if YouTube never reports the target. */
export const YOUTUBE_POPOUT_SEEK_TIMEOUT_MS = 4000;

export function youtubePopoutSeekSettled(
  currentTime: number,
  targetSeconds: number,
): boolean {
  return (
    Number.isFinite(currentTime) &&
    Number.isFinite(targetSeconds) &&
    Math.abs(currentTime - targetSeconds) <= YOUTUBE_POPOUT_SEEK_SETTLED_SECONDS
  );
}

/**
 * After opening a pop-out, keep the Track Game attach mark unless the pop-out
 * is switching to a different match or video (which should force a fresh attach).
 */
export function attachedGameIdAfterPopoutOpen(args: {
  previousBoundMatchId: string | null;
  previousBoundVideoId: string | null;
  previousAttachedGameId: string | null;
  matchId: string;
  videoId: string;
}): string | null {
  const switchingTarget =
    (args.previousBoundMatchId != null && args.previousBoundMatchId !== args.matchId) ||
    (args.previousBoundVideoId != null && args.previousBoundVideoId !== args.videoId);
  return switchingTarget ? null : args.previousAttachedGameId;
}

/**
 * Auto-seek when a persisted pop-out attaches to a different Track Game and a
 * stamp exists. Same-game attach (e.g. pop out while already on that game) stays put.
 */
export function shouldAutoSeekPopoutForGame(args: {
  attachedGameId: string | null;
  gameId: string;
  seekTargetSeconds: number | null;
}): boolean {
  return (
    args.attachedGameId !== args.gameId &&
    args.seekTargetSeconds != null &&
    Number.isFinite(args.seekTargetSeconds)
  );
}

export type YoutubePopoutCommand =
  | { type: 'command'; op: 'togglePlayPause' }
  | { type: 'command'; op: 'seekTo'; seconds: number }
  | { type: 'command'; op: 'seekBy'; deltaSeconds: number }
  | { type: 'command'; op: 'stepFrame'; direction: -1 | 1 };

export type YoutubePopoutControllerMessage = YoutubePopoutCommand | { type: 'shutdown' };

export type YoutubePopoutHostMessage =
  | { type: 'state'; currentTime: number; playing: boolean }
  | { type: 'keydown'; key: string; code: string; repeat: boolean; shiftKey: boolean }
  | { type: 'goodbye' };

type KindEnvelope = { kind: typeof YOUTUBE_POPOUT_MESSAGE_KIND };

export type YoutubePopoutControllerEnvelope = KindEnvelope & YoutubePopoutControllerMessage;
export type YoutubePopoutHostEnvelope = KindEnvelope & YoutubePopoutHostMessage;

export function youtubePopoutChannelName(sessionId: string): string {
  return `scorekeeper-yt-popout:${sessionId}`;
}

export function buildYoutubePopoutHref(args: {
  videoId: string;
  startSeconds: number;
  sessionId: string;
  origin?: string;
  base?: string;
}): string {
  const origin =
    args.origin ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const base =
    args.base ??
    (typeof import.meta.env.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/');
  const root = base.endsWith('/') ? base : `${base}/`;
  const url = new URL(YOUTUBE_POPOUT_PATH.replace(/^\//, ''), `${origin}${root}`);
  url.searchParams.set('v', args.videoId);
  url.searchParams.set('t', String(Math.max(0, args.startSeconds)));
  url.searchParams.set('sid', args.sessionId);
  return url.href;
}

export function parseYoutubePopoutSearch(
  search: string,
): { videoId: string; startSeconds: number; sessionId: string } | null {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  );
  const videoId = parseYoutubeVideoId(params.get('v') ?? '');
  const sessionId = params.get('sid')?.trim() ?? '';
  if (!videoId || !sessionId) return null;
  const parsedT = Number(params.get('t'));
  const startSeconds =
    Number.isFinite(parsedT) && parsedT >= 0 ? parsedT : 0;
  return { videoId, startSeconds, sessionId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isYoutubePopoutControllerMessage(
  value: unknown,
): value is YoutubePopoutControllerEnvelope {
  if (!isRecord(value) || value.kind !== YOUTUBE_POPOUT_MESSAGE_KIND) return false;
  if (value.type === 'shutdown') return true;
  if (value.type !== 'command') return false;
  if (value.op === 'togglePlayPause') return true;
  if (value.op === 'seekTo') {
    return typeof value.seconds === 'number' && Number.isFinite(value.seconds);
  }
  if (value.op === 'seekBy') {
    return (
      typeof value.deltaSeconds === 'number' && Number.isFinite(value.deltaSeconds)
    );
  }
  if (value.op === 'stepFrame') {
    return value.direction === -1 || value.direction === 1;
  }
  return false;
}

export function isYoutubePopoutHostMessage(
  value: unknown,
): value is YoutubePopoutHostEnvelope {
  if (!isRecord(value) || value.kind !== YOUTUBE_POPOUT_MESSAGE_KIND) return false;
  if (value.type === 'goodbye') return true;
  if (value.type === 'state') {
    return (
      typeof value.currentTime === 'number' &&
      Number.isFinite(value.currentTime) &&
      typeof value.playing === 'boolean'
    );
  }
  if (value.type === 'keydown') {
    return (
      typeof value.key === 'string' &&
      typeof value.code === 'string' &&
      typeof value.repeat === 'boolean' &&
      typeof value.shiftKey === 'boolean'
    );
  }
  return false;
}

export function envelopeYoutubePopoutMessage<
  T extends YoutubePopoutControllerMessage | YoutubePopoutHostMessage,
>(message: T): KindEnvelope & T {
  return { kind: YOUTUBE_POPOUT_MESSAGE_KIND, ...message };
}

export function applyYoutubePopoutCommand(
  player: YoutubePlayerHandle | null | undefined,
  command: YoutubePopoutCommand,
): void {
  if (!player) return;
  if (command.op === 'togglePlayPause') {
    player.togglePlayPause();
    return;
  }
  if (command.op === 'seekTo') {
    player.seekTo(command.seconds);
    return;
  }
  if (command.op === 'seekBy') {
    player.seekBy(command.deltaSeconds);
    return;
  }
  player.stepFrame(command.direction);
}

export function createRemoteYoutubePlayerHandle(options: {
  post: (message: YoutubePopoutControllerEnvelope) => void;
  getSnapshot: () => YoutubePopoutSnapshot;
  onOptimisticChange?: () => void;
}): YoutubePlayerHandle {
  const bump = () => options.onOptimisticChange?.();
  return {
    getCurrentTime: () => options.getSnapshot().currentTime,
    seekTo: (seconds) => {
      const snap = options.getSnapshot();
      snap.currentTime = Math.max(0, seconds);
      bump();
      options.post(envelopeYoutubePopoutMessage({ type: 'command', op: 'seekTo', seconds }));
    },
    seekBy: (deltaSeconds) => {
      const snap = options.getSnapshot();
      snap.currentTime = Math.max(0, snap.currentTime + deltaSeconds);
      bump();
      options.post(
        envelopeYoutubePopoutMessage({
          type: 'command',
          op: 'seekBy',
          deltaSeconds,
        }),
      );
    },
    togglePlayPause: () => {
      const snap = options.getSnapshot();
      snap.playing = !snap.playing;
      bump();
      options.post(
        envelopeYoutubePopoutMessage({ type: 'command', op: 'togglePlayPause' }),
      );
    },
    stepFrame: (direction) => {
      const snap = options.getSnapshot();
      if (snap.playing) return;
      snap.currentTime = Math.max(
        0,
        snap.currentTime + direction * YOUTUBE_FRAME_SECONDS,
      );
      bump();
      options.post(
        envelopeYoutubePopoutMessage({
          type: 'command',
          op: 'stepFrame',
          direction,
        }),
      );
    },
    isPaused: () => !options.getSnapshot().playing,
  };
}

export function dispatchYoutubePopoutKeydown(
  message: Extract<YoutubePopoutHostMessage, { type: 'keydown' }>,
): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: message.key,
      code: message.code,
      repeat: message.repeat,
      shiftKey: message.shiftKey,
      bubbles: true,
      cancelable: true,
    }),
  );
}
