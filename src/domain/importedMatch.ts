import { getMatchById } from './matchGame';
import type { DatabaseDto, Guid, MatchRow } from './types';

export function isStatsImportedMatch(match: MatchRow | undefined | null): boolean {
  return Boolean(match?.StatsImported);
}

export function isStatsImportedMatchId(data: DatabaseDto, matchId: Guid): boolean {
  return isStatsImportedMatch(getMatchById(data, matchId));
}

export function matchHasGameEvents(data: DatabaseDto, matchId: Guid): boolean {
  const gameIds = new Set<Guid>();
  for (const link of data.Tables.MatchEventGame as { MatchEventId: Guid; GameId: Guid }[]) {
    const matchEvent = (data.Tables.MatchEvent as { Id: Guid; MatchId: Guid }[]).find(
      (row) => row.Id === link.MatchEventId,
    );
    if (matchEvent?.MatchId === matchId) gameIds.add(link.GameId);
  }
  for (const event of data.Tables.GameEvent as { GameId: Guid }[]) {
    if (gameIds.has(event.GameId)) return true;
  }
  return false;
}
