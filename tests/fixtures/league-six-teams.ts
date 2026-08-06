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

/** WinHome = 1, WinAway = 2 (GameEventFinishResult). */
const FINISH_WIN_HOME = 1;
const FINISH_WIN_AWAY = 2;

type Guid = string;

type DatabaseDto = {
  Tables: Record<string, unknown[]>;
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

      for (const pi of playerIndicesForGame(gameIndex)) {
        for (const map of [matchPlayerBySide.home, matchPlayerBySide.away]) {
          const matchPlayerId = map.get(pi)!;
          (tables.GamePlayer as { Id: Guid; GameId: Guid; MatchPlayerId: Guid }[]).push({
            Id: nextId(),
            GameId: gameId,
            MatchPlayerId: matchPlayerId,
          });
        }
      }

      const gameEventId = nextId();
      (tables.GameEvent as { Id: Guid; GameId: Guid; Ordinal: number }[]).push({
        Id: gameEventId,
        GameId: gameId,
        Ordinal: 1,
      });
      const homeWins = (homeIdx + awayIdx + gameIndex) % 2 === 0;
      (tables.GameEventFinish as { GameEventId: Guid; ResultId: number }[]).push({
        GameEventId: gameEventId,
        ResultId: homeWins ? FINISH_WIN_HOME : FINISH_WIN_AWAY,
      });
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
