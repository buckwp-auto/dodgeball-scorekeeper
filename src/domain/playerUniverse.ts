import { getPlayersForTeam, getTeams } from './database';
import type { ImageRef } from './imageRef';
import {
  normalizePlayerName,
  rankNameMatch,
  type PlayerMatchRank,
} from './playerMatch';
import type { DatabaseDto } from './types';

export type UniversePlayer = {
  /** Stable id for Autocomplete keys: leagueId + source player Id. */
  key: string;
  playerName: string;
  teamName: string;
  leagueName: string;
  leagueId: string;
  image?: ImageRef | null;
  addedFromMatch: boolean;
};

export type UniversePlayerCandidate = UniversePlayer & {
  rank: PlayerMatchRank;
};

export type UniverseLeagueEntry = {
  leagueId: string;
  leagueName: string;
  data: DatabaseDto;
};

function prefersOver(candidate: UniversePlayer, existing: UniversePlayer): boolean {
  const candidateHasImage = Boolean(candidate.image?.url);
  const existingHasImage = Boolean(existing.image?.url);
  if (candidateHasImage !== existingHasImage) return candidateHasImage;
  if (candidate.addedFromMatch !== existing.addedFromMatch) {
    return !candidate.addedFromMatch;
  }
  return false;
}

/** Flatten players from other leagues; skip aliases; dedupe by normalized name. */
export function buildUniversePlayers(
  entries: UniverseLeagueEntry[],
): UniversePlayer[] {
  const byName = new Map<string, UniversePlayer>();

  for (const entry of entries) {
    for (const team of getTeams(entry.data)) {
      for (const player of getPlayersForTeam(entry.data, team.Id)) {
        if (player.LinkedPlayerId) continue;
        const normalized = normalizePlayerName(player.Name);
        if (!normalized) continue;
        const next: UniversePlayer = {
          key: `${entry.leagueId}:${player.Id}`,
          playerName: player.Name,
          teamName: team.Name,
          leagueName: entry.leagueName,
          leagueId: entry.leagueId,
          image: player.Image,
          addedFromMatch: Boolean(player.AddedFromMatch),
        };
        const existing = byName.get(normalized);
        if (!existing || prefersOver(next, existing)) {
          byName.set(normalized, next);
        }
      }
    }
  }

  return [...byName.values()].sort(
    (a, b) =>
      a.playerName.localeCompare(b.playerName) ||
      a.leagueName.localeCompare(b.leagueName) ||
      a.key.localeCompare(b.key),
  );
}

export function universePlayerLabel(player: UniversePlayer): string {
  return `${player.playerName} (${player.teamName} · ${player.leagueName})`;
}

export function suggestUniversePlayers(
  universe: UniversePlayer[],
  options: {
    query: string;
    excludeNames?: Iterable<string>;
  },
): UniversePlayerCandidate[] {
  const query = normalizePlayerName(options.query);
  if (!query) return [];

  const excluded = new Set(
    [...(options.excludeNames ?? [])]
      .map((name) => normalizePlayerName(name))
      .filter(Boolean),
  );

  const rankOrder: Record<PlayerMatchRank, number> = {
    exact: 0,
    prefix: 1,
    token: 2,
    substring: 3,
    fuzzy: 4,
  };

  const candidates: UniversePlayerCandidate[] = [];
  for (const player of universe) {
    if (excluded.has(normalizePlayerName(player.playerName))) continue;
    const rank = rankNameMatch(query, player.playerName);
    if (!rank) continue;
    candidates.push({ ...player, rank });
  }

  return candidates.sort(
    (a, b) =>
      rankOrder[a.rank] - rankOrder[b.rank] ||
      a.playerName.localeCompare(b.playerName) ||
      a.leagueName.localeCompare(b.leagueName) ||
      a.key.localeCompare(b.key),
  );
}
