import { writeFileSync } from 'fs';
import path from 'path';

/** Deterministic IDs for stable .scrkpr output. */
function fixtureId(sequence: number): string {
  const hex = sequence.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Six franchises; each roster is eight named characters. */
export const LEAGUE_TEAMS = [
  {
    name: 'The Fellowship',
    players: [
      'Frodo Baggins',
      'Samwise Gamgee',
      'Aragorn',
      'Legolas',
      'Gimli',
      'Gandalf',
      'Boromir',
      'Merry Brandybuck',
    ],
  },
  {
    name: 'Rebel Alliance',
    players: [
      'Luke Skywalker',
      'Leia Organa',
      'Han Solo',
      'Chewbacca',
      'Lando Calrissian',
      'Rey',
      'Finn',
      'Poe Dameron',
    ],
  },
  {
    name: 'Order of the Phoenix',
    players: [
      'Harry Potter',
      'Hermione Granger',
      'Ron Weasley',
      'Neville Longbottom',
      'Luna Lovegood',
      'Ginny Weasley',
      'Albus Dumbledore',
      'Minerva McGonagall',
    ],
  },
  {
    name: "Earth's Mightiest",
    players: [
      'Tony Stark',
      'Steve Rogers',
      'Natasha Romanoff',
      'Bruce Banner',
      'Thor Odinson',
      'Clint Barton',
      'Wanda Maximoff',
      'Peter Parker',
    ],
  },
  {
    name: 'Hawkins Crew',
    players: [
      'Eleven',
      'Mike Wheeler',
      'Dustin Henderson',
      'Lucas Sinclair',
      'Will Byers',
      'Max Mayfield',
      'Steve Harrington',
      'Nancy Wheeler',
    ],
  },
  {
    name: 'Dunder Mifflin',
    players: [
      'Michael Scott',
      'Jim Halpert',
      'Pam Beesly',
      'Dwight Schrute',
      'Angela Martin',
      'Stanley Hudson',
      'Kevin Malone',
      'Oscar Martinez',
    ],
  },
] as const;

export const LEAGUE_TEAM_NAMES = LEAGUE_TEAMS.map((team) => team.name);

/** Each team plays exactly four head-to-head matches in this fixture. */
export const LEAGUE_MATCH_PAIRINGS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 2],
  [1, 3],
  [1, 5],
  [2, 4],
  [2, 5],
  [3, 4],
  [3, 5],
  [4, 5],
];

export const PLAYERS_PER_TEAM = 8;
export const GAMES_PER_MATCH = 4;
/** Active lineup size per side; rotates across games within a match. */
export const PLAYERS_PER_GAME_SIDE = 4;

/** Mirrors GameEventFinishResult / ThrowResult / DeflectionResult. */
const FINISH_WIN_HOME = 1;
const FINISH_WIN_AWAY = 2;
const ThrowResult = {
  Hit: 1,
  Block: 2,
  BlockFailed: 3,
  Catch: 4,
  CatchFailed: 5,
  Dodge: 6,
  Miss: 7,
} as const;
const DeflectionResult = {
  Hit: 1,
  Block: 2,
  BlockFailed: 3,
  Catch: 4,
  CatchFailed: 5,
} as const;

type Guid = string;

type DatabaseDto = {
  Tables: Record<string, unknown[]>;
};

type ThrowRow = {
  Id: Guid;
  GameEventThrowId: Guid;
  Ordinal: number;
  ThrowerId: Guid;
  TargetId: Guid;
  RecoveredId: Guid | null;
  ResultId: number;
};

type DeflectionRow = {
  Id: Guid;
  ThrowId: Guid;
  Ordinal: number;
  ReceiverId: Guid;
  ResultId: number;
};

const EMPTY_TABLE_NAMES = [
  'Deflection',
  'Game',
  'GameEvent',
  'GameEventError',
  'GameEventFinish',
  'GameEventThrow',
  'GamePlayer',
  'Match',
  'MatchEvent',
  'MatchEventGame',
  'MatchPlayer',
  'Player',
  'Team',
  'TeamPlayer',
  'Throw',
] as const;

function createEmptyTables(): DatabaseDto['Tables'] {
  return Object.fromEntries(EMPTY_TABLE_NAMES.map((name) => [name, []]));
}

function playerIndicesForGame(gameIndex: number): number[] {
  const indices: number[] = [];
  for (let slot = 0; slot < PLAYERS_PER_GAME_SIDE; slot++) {
    indices.push((gameIndex * 2 + slot) % PLAYERS_PER_TEAM);
  }
  return indices;
}

/** Deterministic PRNG for varied but stable event histories. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)]!;
}

function activeOf(ids: Guid[], eliminated: Set<Guid>): Guid[] {
  return ids.filter((id) => !eliminated.has(id));
}

function applyThrowToEliminated(
  eliminated: Set<Guid>,
  throwRow: { ThrowerId: Guid; TargetId: Guid; ResultId: number; RecoveredId: Guid | null },
  deflections: { ReceiverId: Guid; ResultId: number }[],
): void {
  const isCatch =
    throwRow.ResultId === ThrowResult.Catch ||
    deflections.some((row) => row.ResultId === DeflectionResult.Catch);
  if (isCatch) {
    eliminated.add(throwRow.ThrowerId);
    if (throwRow.RecoveredId) eliminated.delete(throwRow.RecoveredId);
    return;
  }
  if (
    throwRow.ResultId === ThrowResult.Hit ||
    throwRow.ResultId === ThrowResult.BlockFailed ||
    throwRow.ResultId === ThrowResult.CatchFailed
  ) {
    eliminated.add(throwRow.TargetId);
  }
  for (const deflection of deflections) {
    if (deflection.ResultId === DeflectionResult.Catch) {
      eliminated.add(throwRow.ThrowerId);
    } else if (
      deflection.ResultId === DeflectionResult.Hit ||
      deflection.ResultId === DeflectionResult.BlockFailed ||
      deflection.ResultId === DeflectionResult.CatchFailed
    ) {
      eliminated.add(deflection.ReceiverId);
    }
  }
}

function appendThrowEvent(
  tables: DatabaseDto['Tables'],
  nextId: () => Guid,
  gameId: Guid,
  ordinal: number,
  throwerId: Guid,
  targetId: Guid,
  resultId: number,
  recoveredId: Guid | null,
  deflections: { receiverId: Guid; resultId: number }[],
): void {
  const gameEventId = nextId();
  (tables.GameEvent as { Id: Guid; GameId: Guid; Ordinal: number }[]).push({
    Id: gameEventId,
    GameId: gameId,
    Ordinal: ordinal,
  });
  (tables.GameEventThrow as { GameEventId: Guid }[]).push({ GameEventId: gameEventId });
  const throwId = nextId();
  (tables.Throw as ThrowRow[]).push({
    Id: throwId,
    GameEventThrowId: gameEventId,
    Ordinal: 1,
    ThrowerId: throwerId,
    TargetId: targetId,
    RecoveredId: recoveredId,
    ResultId: resultId,
  });
  deflections.forEach((deflection, index) => {
    (tables.Deflection as DeflectionRow[]).push({
      Id: nextId(),
      ThrowId: throwId,
      Ordinal: index + 1,
      ReceiverId: deflection.receiverId,
      ResultId: deflection.resultId,
    });
  });
}

/**
 * Builds a throw history until one side is wiped, mixing misses/dodges/hits/catches/deflections.
 * Returns whether home won.
 */
function writeGameEventHistory(
  tables: DatabaseDto['Tables'],
  nextId: () => Guid,
  gameId: Guid,
  homeGamePlayerIds: Guid[],
  awayGamePlayerIds: Guid[],
  seed: number,
): boolean {
  const rng = mulberry32(seed);
  const eliminated = new Set<Guid>();
  let ordinal = 1;
  const maxEvents = 64;

  while (ordinal <= maxEvents) {
    const activeHome = activeOf(homeGamePlayerIds, eliminated);
    const activeAway = activeOf(awayGamePlayerIds, eliminated);
    if (activeHome.length === 0 || activeAway.length === 0) break;

    const homeThrows = rng() < 0.5;
    const throwerTeam = homeThrows ? activeHome : activeAway;
    const targetTeam = homeThrows ? activeAway : activeHome;
    const catcherTeamAll = homeThrows ? awayGamePlayerIds : homeGamePlayerIds;
    const throwerId = pickOne(throwerTeam, rng);
    const targetId = pickOne(targetTeam, rng);

    let resultId = ThrowResult.Hit;
    let recoveredId: Guid | null = null;
    const deflections: { receiverId: Guid; resultId: number }[] = [];
    const roll = rng();
    const otherTargets = targetTeam.filter((id) => id !== targetId);
    const outOnCatcherSide = catcherTeamAll.filter((id) => eliminated.has(id));

    if (ordinal > maxEvents - 8) {
      // Force progress toward a wipe near the safety limit.
      resultId = ThrowResult.Hit;
    } else if (roll < 0.18) {
      resultId = ThrowResult.Dodge;
    } else if (roll < 0.32) {
      resultId = ThrowResult.Miss;
    } else if (roll < 0.42) {
      resultId = ThrowResult.Block;
    } else if (roll < 0.52) {
      resultId = ThrowResult.BlockFailed;
    } else if (roll < 0.62) {
      resultId = ThrowResult.CatchFailed;
    } else if (roll < 0.74) {
      resultId = ThrowResult.Catch;
      recoveredId =
        outOnCatcherSide.length > 0 && rng() < 0.55 ? pickOne(outOnCatcherSide, rng) : null;
    } else if (roll < 0.86 && otherTargets.length > 0) {
      // Block that caroms into another active opponent.
      resultId = ThrowResult.Block;
      deflections.push({
        receiverId: pickOne(otherTargets, rng),
        resultId: DeflectionResult.Hit,
      });
    } else if (roll < 0.93 && otherTargets.length > 0) {
      // Hit that glances into a teammate (failed catch / block).
      resultId = ThrowResult.Hit;
      deflections.push({
        receiverId: pickOne(otherTargets, rng),
        resultId: rng() < 0.5 ? DeflectionResult.CatchFailed : DeflectionResult.BlockFailed,
      });
    } else {
      resultId = ThrowResult.Hit;
    }

    appendThrowEvent(
      tables,
      nextId,
      gameId,
      ordinal,
      throwerId,
      targetId,
      resultId,
      recoveredId,
      deflections,
    );
    applyThrowToEliminated(
      eliminated,
      {
        ThrowerId: throwerId,
        TargetId: targetId,
        ResultId: resultId,
        RecoveredId: recoveredId,
      },
      deflections.map((row) => ({ ReceiverId: row.receiverId, ResultId: row.resultId })),
    );
    ordinal += 1;
  }

  const activeHome = activeOf(homeGamePlayerIds, eliminated);
  const activeAway = activeOf(awayGamePlayerIds, eliminated);
  if (activeHome.length > 0 && activeAway.length > 0) {
    // Safety: clean up remaining opposing players with hits.
    const homeWins = activeAway.length <= activeHome.length;
    const survivors = homeWins ? activeAway : activeHome;
    const finishers = homeWins
      ? activeOf(homeGamePlayerIds, eliminated)
      : activeOf(awayGamePlayerIds, eliminated);
    for (const targetId of survivors) {
      const throwerId = pickOne(finishers, rng);
      appendThrowEvent(
        tables,
        nextId,
        gameId,
        ordinal,
        throwerId,
        targetId,
        ThrowResult.Hit,
        null,
        [],
      );
      eliminated.add(targetId);
      ordinal += 1;
    }
  }

  const homeAlive = activeOf(homeGamePlayerIds, eliminated).length > 0;
  const awayAlive = activeOf(awayGamePlayerIds, eliminated).length > 0;
  if (homeAlive === awayAlive) {
    throw new Error(`Game ${gameId} did not end with exactly one team eliminated`);
  }
  const homeWins = homeAlive && !awayAlive;

  const finishEventId = nextId();
  (tables.GameEvent as { Id: Guid; GameId: Guid; Ordinal: number }[]).push({
    Id: finishEventId,
    GameId: gameId,
    Ordinal: ordinal,
  });
  (tables.GameEventFinish as { GameEventId: Guid; ResultId: number }[]).push({
    GameEventId: finishEventId,
    ResultId: homeWins ? FINISH_WIN_HOME : FINISH_WIN_AWAY,
  });

  return homeWins;
}

/**
 * Six-team league: 8 players per team, 12 matches (four per team), four completed games
 * per match with rotating lineups drawn from each team's match roster.
 */
export function buildLeagueSixTeamsDatabase(): DatabaseDto {
  let seq = 1;
  const nextId = (): Guid => fixtureId(seq++);

  const tables = createEmptyTables();
  const teamIds: Guid[] = [];
  const playersByTeam: Guid[][] = [];

  for (const team of LEAGUE_TEAMS) {
    if (team.players.length !== PLAYERS_PER_TEAM) {
      throw new Error(`Expected ${PLAYERS_PER_TEAM} players for ${team.name}`);
    }
    const teamId = nextId();
    teamIds.push(teamId);
    (tables.Team as { Id: Guid; Name: string }[]).push({ Id: teamId, Name: team.name });

    const roster: Guid[] = [];
    for (const playerName of team.players) {
      const playerId = nextId();
      roster.push(playerId);
      (tables.Player as { Id: Guid; Name: string }[]).push({
        Id: playerId,
        Name: playerName,
      });
      (tables.TeamPlayer as { Id: Guid; TeamId: Guid; PlayerId: Guid }[]).push({
        Id: nextId(),
        TeamId: teamId,
        PlayerId: playerId,
      });
    }
    playersByTeam.push(roster);
  }

  for (const [homeIdx, awayIdx] of LEAGUE_MATCH_PAIRINGS) {
    const matchId = nextId();
    (tables.Match as { Id: Guid; TeamIdHome: Guid; TeamIdAway: Guid }[]).push({
      Id: matchId,
      TeamIdHome: teamIds[homeIdx],
      TeamIdAway: teamIds[awayIdx],
    });

    const matchPlayerBySide: { home: Map<number, Guid>; away: Map<number, Guid> } = {
      home: new Map(),
      away: new Map(),
    };

    for (let pi = 0; pi < PLAYERS_PER_TEAM; pi++) {
      for (const [teamHome, teamIdx, map] of [
        [true, homeIdx, matchPlayerBySide.home],
        [false, awayIdx, matchPlayerBySide.away],
      ] as const) {
        const playerId = playersByTeam[teamIdx][pi];
        const matchPlayerId = nextId();
        map.set(pi, matchPlayerId);
        (tables.MatchPlayer as {
          Id: Guid;
          MatchId: Guid;
          PlayerId: Guid;
          TeamHome: boolean;
        }[]).push({
          Id: matchPlayerId,
          MatchId: matchId,
          PlayerId: playerId,
          TeamHome: teamHome,
        });
      }
    }

    for (let gameIndex = 0; gameIndex < GAMES_PER_MATCH; gameIndex++) {
      const gameId = nextId();
      const matchEventId = nextId();
      (tables.Game as { Id: Guid }[]).push({ Id: gameId });
      (tables.MatchEvent as { Id: Guid; MatchId: Guid; Ordinal: number }[]).push({
        Id: matchEventId,
        MatchId: matchId,
        Ordinal: gameIndex + 1,
      });
      (tables.MatchEventGame as { MatchEventId: Guid; GameId: Guid }[]).push({
        MatchEventId: matchEventId,
        GameId: gameId,
      });

      const homeGamePlayerIds: Guid[] = [];
      const awayGamePlayerIds: Guid[] = [];
      for (const pi of playerIndicesForGame(gameIndex)) {
        const homeGpId = nextId();
        const awayGpId = nextId();
        homeGamePlayerIds.push(homeGpId);
        awayGamePlayerIds.push(awayGpId);
        (tables.GamePlayer as { Id: Guid; GameId: Guid; MatchPlayerId: Guid }[]).push(
          {
            Id: homeGpId,
            GameId: gameId,
            MatchPlayerId: matchPlayerBySide.home.get(pi)!,
          },
          {
            Id: awayGpId,
            GameId: gameId,
            MatchPlayerId: matchPlayerBySide.away.get(pi)!,
          },
        );
      }

      writeGameEventHistory(
        tables,
        nextId,
        gameId,
        homeGamePlayerIds,
        awayGamePlayerIds,
        (homeIdx + 1) * 1000 + (awayIdx + 1) * 100 + gameIndex * 17 + 42,
      );
    }
  }

  return { Tables: tables };
}

export function leagueSixTeamsScrkprJson(): string {
  return JSON.stringify(buildLeagueSixTeamsDatabase());
}

export const LEAGUE_SIX_TEAMS_FIXTURE = 'league-six-teams.scrkpr';

export function leagueSixTeamsFixturePath(): string {
  return path.join(process.cwd(), 'tests', 'fixtures', LEAGUE_SIX_TEAMS_FIXTURE);
}

if (require.main === module) {
  writeFileSync(leagueSixTeamsFixturePath(), leagueSixTeamsScrkprJson(), 'utf-8');
}
