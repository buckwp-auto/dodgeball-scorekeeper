import { getPlayer, getPlayersForTeam, getTeamForPlayer, getTeams } from './database';
import type { ImageRef } from './imageRef';
import type { DatabaseDto, Guid, PlayerRow } from './types';

export type PlayerMatchRank = 'exact' | 'prefix' | 'token' | 'substring' | 'fuzzy';

export type PlayerMatchCandidate = {
  playerId: Guid;
  playerName: string;
  teamId: Guid;
  teamName: string;
  image?: ImageRef | null;
  addedFromMatch: boolean;
  sameTeam: boolean;
  rank: PlayerMatchRank;
};

export function normalizePlayerName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  const prev = Array.from({ length: right.length + 1 }, (_, index) => index);
  const next = new Array<number>(right.length + 1);
  for (let i = 0; i < left.length; i += 1) {
    next[0] = i + 1;
    for (let j = 0; j < right.length; j += 1) {
      const cost = left[i] === right[j] ? 0 : 1;
      next[j + 1] = Math.min(prev[j + 1]! + 1, next[j]! + 1, prev[j]! + cost);
    }
    for (let j = 0; j <= right.length; j += 1) prev[j] = next[j]!;
  }
  return prev[right.length]!;
}

export function rankNameMatch(query: string, name: string): PlayerMatchRank | null {
  const q = normalizePlayerName(query);
  const n = normalizePlayerName(name);
  if (!q || !n) return null;
  if (n === q) return 'exact';
  if (n.startsWith(q)) return 'prefix';

  const tokens = n.split(/[\s-]+/).filter(Boolean);
  if (tokens.some((token) => token === q || token.startsWith(q))) return 'token';
  if (q.length >= 2 && n.includes(q)) return 'substring';

  if (Math.min(q.length, n.length) >= 4 && editDistance(q, n) <= 1) return 'fuzzy';
  if (
    q.length >= 4 &&
    tokens.some((token) => token.length >= 4 && editDistance(q, token) <= 1)
  ) {
    return 'fuzzy';
  }
  return null;
}

export function suggestLinkedPlayers(
  data: DatabaseDto,
  options: {
    query: string;
    matchId?: Guid;
    sideTeamId?: Guid;
    excludePlayerId?: Guid;
  },
): PlayerMatchCandidate[] {
  const query = normalizePlayerName(options.query);
  if (!query) return [];

  const onMatch = new Set(
    options.matchId
      ? (data.Tables.MatchPlayer as { MatchId: Guid; PlayerId: Guid }[])
          .filter((row) => row.MatchId === options.matchId)
          .map((row) => row.PlayerId)
      : [],
  );

  const candidates: PlayerMatchCandidate[] = [];
  for (const team of getTeams(data)) {
    for (const player of getPlayersForTeam(data, team.Id)) {
      if (player.LinkedPlayerId) continue;
      if (player.Id === options.excludePlayerId) continue;
      if (onMatch.has(player.Id)) continue;
      const rank = rankNameMatch(query, player.Name);
      if (!rank) continue;
      candidates.push({
        playerId: player.Id,
        playerName: player.Name,
        teamId: team.Id,
        teamName: team.Name,
        image: player.Image,
        addedFromMatch: Boolean(player.AddedFromMatch),
        sameTeam: Boolean(options.sideTeamId && team.Id === options.sideTeamId),
        rank,
      });
    }
  }

  const rankOrder: Record<PlayerMatchRank, number> = {
    exact: 0,
    prefix: 1,
    token: 2,
    substring: 3,
    fuzzy: 4,
  };
  return candidates.sort(
    (a, b) =>
      rankOrder[a.rank] - rankOrder[b.rank] ||
      Number(b.sameTeam) - Number(a.sameTeam) ||
      Number(a.addedFromMatch) - Number(b.addedFromMatch) ||
      a.playerName.localeCompare(b.playerName) ||
      a.teamName.localeCompare(b.teamName) ||
      a.playerId.localeCompare(b.playerId),
  );
}

export function linkPlayer(
  data: DatabaseDto,
  guestPlayerId: Guid,
  canonicalPlayerId: Guid,
): void {
  if (guestPlayerId === canonicalPlayerId) {
    throw new Error('Cannot link a player to themselves');
  }
  const guest = getPlayer(data, guestPlayerId);
  const canonical = getPlayer(data, canonicalPlayerId);
  if (!guest || !canonical) throw new Error('Player not found');
  if (canonical.LinkedPlayerId) {
    throw new Error('Cannot link to a player who is already a sub alias');
  }
  guest.LinkedPlayerId = canonicalPlayerId;
  if (!guest.Image && canonical.Image) {
    guest.Image = structuredClone(canonical.Image);
  }
}

export function unlinkPlayer(data: DatabaseDto, guestPlayerId: Guid): void {
  const guest = getPlayer(data, guestPlayerId);
  if (!guest) return;
  delete guest.LinkedPlayerId;
}

export function resolveCanonicalPlayerId(
  data: DatabaseDto,
  playerId: Guid,
): Guid {
  const player = getPlayer(data, playerId);
  if (!player?.LinkedPlayerId) return playerId;
  const target = getPlayer(data, player.LinkedPlayerId);
  if (!target || target.LinkedPlayerId) return playerId;
  return player.LinkedPlayerId;
}

export function getLinkedGuestPlayers(
  data: DatabaseDto,
  canonicalPlayerId: Guid,
): PlayerRow[] {
  return (data.Tables.Player as PlayerRow[]).filter(
    (player) => player.LinkedPlayerId === canonicalPlayerId,
  );
}

export function getPlayerIdsForProfile(
  data: DatabaseDto,
  playerId: Guid,
): Guid[] {
  const canonicalId = resolveCanonicalPlayerId(data, playerId);
  return [canonicalId, ...getLinkedGuestPlayers(data, canonicalId).map((row) => row.Id)];
}

export function linkedPlayerLabel(
  data: DatabaseDto,
  player: PlayerRow,
): string | null {
  if (!player.LinkedPlayerId) return null;
  const canonical = getPlayer(data, player.LinkedPlayerId);
  if (!canonical) return null;
  const team = getTeamForPlayer(data, canonical.Id);
  return team ? `sub for ${team.Name} · ${canonical.Name}` : `sub for ${canonical.Name}`;
}
