import { YOUTUBE_POPOUT_PATH } from './youtubePopout';

/** GA4 / Firebase Analytics event names used by the app. */
export const ANALYTICS_EVENTS = {
  pageView: 'page_view',
  videoPlayerMode: 'video_player_mode',
  videoTimelineSeek: 'video_timeline_seek',
  itemDeleted: 'item_deleted',
} as const;

export type AnalyticsDeleteKind =
  | 'team'
  | 'player'
  | 'match'
  | 'game'
  | 'game_event';

/**
 * Map a React Router pathname (no basename) to a stable report label.
 * IDs are stripped so GA is not flooded with unique paths.
 */
export function pageNameFromPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === YOUTUBE_POPOUT_PATH) return 'youtube_popout';
  if (path === '/') return 'overview';
  if (path === '/teams') return 'teams';
  if (path === '/matches') return 'matches';
  if (path === '/stats') return 'stats';
  if (path === '/highlights') return 'highlights';
  if (path === '/settings') return 'settings';
  if (path === '/history') return 'history';
  if (/^\/teams\/[^/]+$/.test(path)) return 'team';
  if (/^\/players\/[^/]+$/.test(path)) return 'player';
  if (/^\/matches\/[^/]+\/stats$/.test(path)) return 'match_stats';
  if (/^\/matches\/[^/]+\/events$/.test(path)) return 'match_events';
  if (/^\/matches\/[^/]+\/games\/[^/]+\/stats$/.test(path)) return 'game_stats';
  if (/^\/matches\/[^/]+\/games\/[^/]+\/events$/.test(path)) {
    return 'track_game';
  }
  if (/^\/matches\/[^/]+\/games\/[^/]+$/.test(path)) return 'game';
  if (/^\/matches\/[^/]+$/.test(path)) return 'match';
  return 'other';
}
