import { getMatchName, getTeam } from './database';
import type { GameEventRow } from './gameEvents';
import { getGamePlayerInfos } from './gameEvents';
import { buildTimelineEntry, type TimelineEntry } from './gameEventTimeline';
import { getMatchById, getMatchGames, getMatchIdForGame } from './matchGame';
import type { DatabaseDto, Guid } from './types';

export type LeagueHighlight = {
  eventId: Guid;
  matchId: Guid;
  gameId: Guid;
  matchName: string;
  gameName: string;
  youtubeUrl: string | null;
  entry: TimelineEntry;
};

export type LeagueHighlightGameGroup = {
  gameId: Guid;
  gameName: string;
  highlights: LeagueHighlight[];
};

export type LeagueHighlightMatchGroup = {
  matchId: Guid;
  matchName: string;
  youtubeUrl: string | null;
  games: LeagueHighlightGameGroup[];
};

export function highlightEventHref(
  matchId: Guid,
  gameId: Guid,
  eventId: Guid,
): string {
  return `/matches/${matchId}/games/${gameId}/events?event=${encodeURIComponent(eventId)}`;
}

export function timelineEntryInvolvesPlayer(
  entry: TimelineEntry,
  playerId: Guid,
): boolean {
  return entry.rows.some((row) =>
    row.segments.some(
      (segment) => segment.kind === 'player' && segment.player.playerId === playerId,
    ),
  );
}

export function getPlayerHighlightGroups(
  data: DatabaseDto,
  playerId: Guid,
): LeagueHighlightMatchGroup[] {
  return getLeagueHighlightGroups(data)
    .map((match) => ({
      ...match,
      games: match.games
        .map((game) => ({
          ...game,
          highlights: game.highlights.filter((highlight) =>
            timelineEntryInvolvesPlayer(highlight.entry, playerId),
          ),
        }))
        .filter((game) => game.highlights.length > 0),
    }))
    .filter((match) => match.games.length > 0);
}

export function getLeagueHighlightGroups(
  data: DatabaseDto,
): LeagueHighlightMatchGroup[] {
  const highlighted = (data.Tables.GameEvent as GameEventRow[]).filter(
    (row) => row.IsHighlight,
  );
  if (highlighted.length === 0) return [];

  const byMatch = new Map<Guid, Map<Guid, GameEventRow[]>>();
  for (const event of highlighted) {
    const matchId = getMatchIdForGame(data, event.GameId);
    if (!matchId) continue;
    let games = byMatch.get(matchId);
    if (!games) {
      games = new Map();
      byMatch.set(matchId, games);
    }
    const list = games.get(event.GameId) ?? [];
    list.push(event);
    games.set(event.GameId, list);
  }

  const groups: LeagueHighlightMatchGroup[] = [];
  for (const [matchId, games] of byMatch) {
    const match = getMatchById(data, matchId);
    if (!match) continue;
    const matchName = getMatchName(data, match);
    const homeName = getTeam(data, match.TeamIdHome)?.Name ?? 'Home';
    const awayName = getTeam(data, match.TeamIdAway)?.Name ?? 'Away';
    const youtubeUrl = match.YoutubeUrl?.trim() || null;
    const gameGroups: LeagueHighlightGameGroup[] = [];

    for (const game of getMatchGames(data, matchId)) {
      const events = games.get(game.gameId);
      if (!events?.length) continue;
      const players = getGamePlayerInfos(data, matchId, game.gameId);
      const sorted = [...events].sort((a, b) => a.Ordinal - b.Ordinal);
      const highlights = sorted.flatMap((event) => {
        const entry = buildTimelineEntry(data, event, players, homeName, awayName);
        if (!entry) return [];
        return [
          {
            eventId: event.Id,
            matchId,
            gameId: game.gameId,
            matchName,
            gameName: game.label,
            youtubeUrl,
            entry,
          },
        ];
      });
      if (highlights.length === 0) continue;
      gameGroups.push({
        gameId: game.gameId,
        gameName: game.label,
        highlights,
      });
    }

    if (gameGroups.length === 0) continue;
    groups.push({
      matchId,
      matchName,
      youtubeUrl,
      games: gameGroups,
    });
  }

  return groups.sort(
    (a, b) => a.matchName.localeCompare(b.matchName) || a.matchId.localeCompare(b.matchId),
  );
}
