import { getGamePlayerInfos } from '../gameEvents';
import { getMatchPlayers } from '../matchGame';
import type { DatabaseDto, Guid } from '../types';
import { isConnectingHitThrowResult } from '../throwResults';
import { buildPlayerOverviews } from './databaseViews';
import {
  iterateScopedThrows,
  playerIdByGamePlayerId,
  resolveStatsQuery,
  type StatsScope,
} from './displayStats';

export type HeatmapPlayer = {
  playerId: Guid;
  name: string;
  teamHome: boolean | null;
};

export type HeatmapCell = {
  throws: number;
  hits: number;
};

export type TargetHeatmap = {
  throwers: HeatmapPlayer[];
  targets: HeatmapPlayer[];
  cells: Map<string, HeatmapCell>;
};

export function heatmapCellKey(throwerId: Guid, targetId: Guid): string {
  return `${throwerId}|${targetId}`;
}

export function buildTargetHeatmap(
  data: DatabaseDto,
  scope: StatsScope,
): TargetHeatmap {
  const { matchIds, gameIds } = resolveStatsQuery(data, scope);
  const playerIds = playerIdByGamePlayerId(data);
  const overviews = buildPlayerOverviews(data);
  const sideByPlayer =
    scope.kind === 'league' ? null : teamHomeByPlayer(data, scope.matchId, scope.kind === 'game' ? scope.gameId : undefined);

  const cells = new Map<string, HeatmapCell>();
  const throwerIds = new Set<Guid>();
  const targetIds = new Set<Guid>();

  iterateScopedThrows(data, matchIds, gameIds, (detail) => {
    const throwerId = playerIds.get(detail.throwRow.ThrowerId);
    const targetId = playerIds.get(detail.throwRow.TargetId);
    if (!throwerId || !targetId) return;
    throwerIds.add(throwerId);
    targetIds.add(targetId);
    const key = heatmapCellKey(throwerId, targetId);
    const cell = cells.get(key) ?? { throws: 0, hits: 0 };
    cell.throws += 1;
    if (isConnectingHitThrowResult(detail.throwRow.ResultId)) cell.hits += 1;
    cells.set(key, cell);
  });

  const toPlayer = (playerId: Guid): HeatmapPlayer | null => {
    const overview = overviews.get(playerId);
    if (!overview) return null;
    return {
      playerId,
      name: overview.player.Name,
      teamHome: sideByPlayer?.get(playerId) ?? null,
    };
  };

  const sortPlayers = (ids: Set<Guid>): HeatmapPlayer[] =>
    [...ids]
      .map(toPlayer)
      .filter((row): row is HeatmapPlayer => row != null)
      .sort((a, b) => {
        if (a.teamHome !== b.teamHome) {
          if (a.teamHome === true) return -1;
          if (b.teamHome === true) return 1;
          if (a.teamHome === false) return -1;
          if (b.teamHome === false) return 1;
        }
        return a.name.localeCompare(b.name);
      });

  return {
    throwers: sortPlayers(throwerIds),
    targets: sortPlayers(targetIds),
    cells,
  };
}

function teamHomeByPlayer(
  data: DatabaseDto,
  matchId: Guid,
  gameId?: Guid,
): Map<Guid, boolean> {
  if (gameId) {
    const map = new Map<Guid, boolean>();
    for (const info of getGamePlayerInfos(data, matchId, gameId)) {
      map.set(info.playerId, info.teamHome);
    }
    return map;
  }
  const map = new Map<Guid, boolean>();
  for (const row of getMatchPlayers(data, matchId)) {
    map.set(row.PlayerId, row.TeamHome);
  }
  return map;
}
