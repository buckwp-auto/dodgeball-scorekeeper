/** YouTube URL helpers, layout modes, and video time formatting. */

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

/** Approximate frame length for , / . step-when-paused (YouTube ~30fps). */
export const YOUTUBE_FRAME_SECONDS = 1 / 30;

/** Arrow-key seek amount (YouTube default). */
export const YOUTUBE_SEEK_SECONDS = 5;

export const YOUTUBE_LAYOUT_SMALL_HOTKEY = '[';
export const YOUTUBE_LAYOUT_TALL_HOTKEY = ']';
export const YOUTUBE_FRAME_BACK_HOTKEY = ',';
export const YOUTUBE_FRAME_FORWARD_HOTKEY = '.';
export const YOUTUBE_PLAY_PAUSE_HOTKEY = ' ';
export const YOUTUBE_SEEK_BACK_HOTKEY = 'ArrowLeft';
export const YOUTUBE_SEEK_FORWARD_HOTKEY = 'ArrowRight';

/** Extract an 11-character YouTube video id from common URL shapes. */
export function parseYoutubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
    return /^[\w-]{11}$/.test(id) ? id : null;
  }

  const v = parsed.searchParams.get('v');
  if (v && /^[\w-]{11}$/.test(v)) return v;

  const parts = parsed.pathname.split('/').filter(Boolean);
  const embedIndex = parts.findIndex((part) =>
    part === 'embed' || part === 'shorts' || part === 'live' || part === 'v',
  );
  if (embedIndex >= 0) {
    const id = parts[embedIndex + 1] ?? '';
    return /^[\w-]{11}$/.test(id) ? id : null;
  }

  return null;
}

/** Format seconds as m:ss or h:mm:ss. */
export function formatVideoTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '';
  }
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse m:ss, h:mm:ss, or plain seconds into a non-negative number.
 * Empty / invalid → null.
 */
export function parseVideoTime(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((part) => /^\d+$/.test(part))) return null;
  const nums = parts.map((part) => Number(part));
  let total = 0;
  if (nums.length === 3) {
    total = nums[0]! * 3600 + nums[1]! * 60 + nums[2]!;
  } else {
    total = nums[0]! * 60 + nums[1]!;
  }
  return Number.isFinite(total) && total >= 0 ? total : null;
}

/**
 * tall = full-width large player above editor+timeline
 * docked = player centered in editor column; timeline rises beside it
 * hidden = scoring only
 * popout = player in a second window; Track Game keeps a thin control bar
 */
export type YoutubeInPageMode = 'tall' | 'docked' | 'hidden';
export type YoutubePlayerMode = YoutubeInPageMode | 'popout';

export type YoutubePlayerHandle = {
  getCurrentTime: () => number | null;
  seekTo: (seconds: number) => void;
  seekBy: (deltaSeconds: number) => void;
  togglePlayPause: () => void;
  /** Step ~1 frame when paused (YouTube , / . behavior). */
  stepFrame: (direction: -1 | 1) => void;
  isPaused: () => boolean;
};

export const YOUTUBE_PLAYER_MODE_KEY = 'SCOREKEEPER_YT_PLAYER_MODE';

export function isYoutubeInPageMode(value: string): value is YoutubeInPageMode {
  return value === 'tall' || value === 'docked' || value === 'hidden';
}

export function loadYoutubePlayerMode(): YoutubeInPageMode {
  try {
    const raw = sessionStorage.getItem(YOUTUBE_PLAYER_MODE_KEY);
    if (isYoutubeInPageMode(raw ?? '')) return raw as YoutubeInPageMode;
    // Migrate prior session values
    if (raw === 'expanded') return 'tall';
    if (raw === 'compact') return 'docked';
    if (raw === 'popout') return 'tall';
  } catch {
    /* ignore */
  }
  return 'tall';
}

export function saveYoutubePlayerMode(mode: YoutubeInPageMode): void {
  try {
    sessionStorage.setItem(YOUTUBE_PLAYER_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
