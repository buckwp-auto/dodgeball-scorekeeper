"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var league_six_teams_exports = {};
__export(league_six_teams_exports, {
  DEMO_YOUTUBE_URLS: () => DEMO_YOUTUBE_URLS,
  GAMES_PER_MATCH: () => GAMES_PER_MATCH,
  LEAGUE_MATCH_PAIRINGS: () => LEAGUE_MATCH_PAIRINGS,
  LEAGUE_SIX_TEAMS_FIXTURE: () => LEAGUE_SIX_TEAMS_FIXTURE,
  LEAGUE_TEAMS: () => LEAGUE_TEAMS,
  LEAGUE_TEAM_NAMES: () => LEAGUE_TEAM_NAMES,
  PLAYERS_PER_GAME_SIDE: () => PLAYERS_PER_GAME_SIDE,
  PLAYERS_PER_TEAM: () => PLAYERS_PER_TEAM,
  buildLeagueSixTeamsDatabase: () => buildLeagueSixTeamsDatabase,
  leagueSixTeamsFixturePath: () => leagueSixTeamsFixturePath,
  leagueSixTeamsScrkprJson: () => leagueSixTeamsScrkprJson
});
module.exports = __toCommonJS(league_six_teams_exports);
var import_fs = require("fs");
var import_path = __toESM(require("path"));
function fixtureId(sequence) {
  const hex = sequence.toString(16).padStart(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
const LEAGUE_TEAMS = [
  {
    name: "The Fellowship",
    avatarStyle: "adventurer",
    players: [
      "Frodo Baggins",
      "Samwise Gamgee",
      "Aragorn",
      "Legolas",
      "Gimli",
      "Gandalf",
      "Boromir",
      "Merry Brandybuck"
    ]
  },
  {
    name: "Rebel Alliance",
    avatarStyle: "pixel-art",
    players: [
      "Luke Skywalker",
      "Leia Organa",
      "Han Solo",
      "Chewbacca",
      "Lando Calrissian",
      "Rey",
      "Finn",
      "Poe Dameron"
    ]
  },
  {
    name: "Order of the Phoenix",
    avatarStyle: "lorelei",
    players: [
      "Harry Potter",
      "Hermione Granger",
      "Ron Weasley",
      "Neville Longbottom",
      "Luna Lovegood",
      "Ginny Weasley",
      "Albus Dumbledore",
      "Minerva McGonagall"
    ]
  },
  {
    name: "Earth's Mightiest",
    avatarStyle: "avataaars",
    players: [
      "Tony Stark",
      "Steve Rogers",
      "Natasha Romanoff",
      "Bruce Banner",
      "Thor Odinson",
      "Clint Barton",
      "Wanda Maximoff",
      "Peter Parker"
    ]
  },
  {
    name: "Hawkins Crew",
    avatarStyle: "open-peeps",
    players: [
      "Eleven",
      "Mike Wheeler",
      "Dustin Henderson",
      "Lucas Sinclair",
      "Will Byers",
      "Max Mayfield",
      "Steve Harrington",
      "Nancy Wheeler"
    ]
  },
  {
    name: "Dunder Mifflin",
    avatarStyle: "micah",
    players: [
      "Michael Scott",
      "Jim Halpert",
      "Pam Beesly",
      "Dwight Schrute",
      "Angela Martin",
      "Stanley Hudson",
      "Kevin Malone",
      "Oscar Martinez"
    ]
  }
];
const LEAGUE_TEAM_NAMES = LEAGUE_TEAMS.map((team) => team.name);
const LEAGUE_MATCH_PAIRINGS = [
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
  [4, 5]
];
const PLAYERS_PER_TEAM = 8;
const GAMES_PER_MATCH = 12;
const PLAYERS_PER_GAME_SIDE = 4;
const DEMO_YOUTUBE_URLS = [
  "https://www.youtube.com/watch?v=9XBnadGg_C0",
  "https://www.youtube.com/watch?v=FWQLzRGACCg",
  "https://www.youtube.com/watch?v=k02lYgSxHH0",
  "https://www.youtube.com/watch?v=bxif3AS1oZU",
  "https://www.youtube.com/watch?v=AQmCAOpljnU",
  "https://www.youtube.com/watch?v=AnDTvS_1VGs",
  "https://www.youtube.com/watch?v=azPIDImiKx4",
  "https://www.youtube.com/watch?v=-jfE3Gz20_M",
  "https://www.youtube.com/watch?v=7I6QEF2pi4k",
  "https://www.youtube.com/watch?v=PZdANwOZpkE",
  "https://www.youtube.com/watch?v=VnHDKeDQKXU",
  "https://www.youtube.com/watch?v=YKHUlu9eixY"
];
function sampleImage(style, seed) {
  return {
    kind: "external",
    url: `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(seed)}&size=256`
  };
}
const FINISH_WIN_HOME = 1;
const FINISH_WIN_AWAY = 2;
const ThrowResult = {
  Hit: 1,
  Block: 2,
  BlockFailed: 3,
  Catch: 4,
  CatchFailed: 5,
  Dodge: 6,
  Miss: 7
};
const DeflectionResult = {
  Hit: 1,
  Block: 2,
  BlockFailed: 3,
  Catch: 4,
  CatchFailed: 5
};
const EMPTY_TABLE_NAMES = [
  "Deflection",
  "Game",
  "GameEvent",
  "GameEventError",
  "GameEventFinish",
  "GameEventStart",
  "GameEventThrow",
  "GamePlayer",
  "Match",
  "MatchEvent",
  "MatchEventGame",
  "MatchPlayer",
  "Player",
  "Team",
  "TeamPlayer",
  "Throw"
];
const MATCH_INTRO_SECONDS = 45;
const EVENT_GAP_SECONDS = 12;
const BETWEEN_GAMES_GAP_SECONDS = 90;
function createEmptyTables() {
  return Object.fromEntries(EMPTY_TABLE_NAMES.map((name) => [name, []]));
}
function playerIndicesForGame(gameIndex) {
  const indices = [];
  for (let slot = 0; slot < PLAYERS_PER_GAME_SIDE; slot++) {
    indices.push((gameIndex * 2 + slot) % PLAYERS_PER_TEAM);
  }
  return indices;
}
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pickOne(items, rng) {
  return items[Math.floor(rng() * items.length)];
}
function activeOf(ids, eliminated) {
  return ids.filter((id) => !eliminated.has(id));
}
function applyThrowToEliminated(eliminated, throwRow, deflections) {
  const isCatch = throwRow.ResultId === ThrowResult.Catch || deflections.some((row) => row.ResultId === DeflectionResult.Catch);
  if (isCatch) {
    eliminated.add(throwRow.ThrowerId);
    if (throwRow.RecoveredId) eliminated.delete(throwRow.RecoveredId);
    return;
  }
  if (throwRow.ResultId === ThrowResult.Hit || throwRow.ResultId === ThrowResult.BlockFailed || throwRow.ResultId === ThrowResult.CatchFailed) {
    eliminated.add(throwRow.TargetId);
  }
  for (const deflection of deflections) {
    if (deflection.ResultId === DeflectionResult.Catch) {
      eliminated.add(throwRow.ThrowerId);
    } else if (deflection.ResultId === DeflectionResult.Hit || deflection.ResultId === DeflectionResult.BlockFailed || deflection.ResultId === DeflectionResult.CatchFailed) {
      eliminated.add(deflection.ReceiverId);
    }
  }
}
function countNewEliminations(eliminated, throwRow, deflections) {
  const next = new Set(eliminated);
  applyThrowToEliminated(next, throwRow, deflections);
  return next.size - eliminated.size;
}
function throwIsHighlight(resultId, deflections, newOuts) {
  if (resultId === ThrowResult.Catch) return true;
  if (deflections.some((row) => row.resultId === DeflectionResult.Catch)) return true;
  if (deflections.length > 0) return true;
  return newOuts >= 2;
}
function appendThrowEvent(tables, nextId, gameId, ordinal, throwerId, targetId, resultId, recoveredId, deflections, options) {
  const gameEventId = nextId();
  tables.GameEvent.push({
    Id: gameEventId,
    GameId: gameId,
    Ordinal: ordinal,
    ...options?.isHighlight ? { IsHighlight: true } : {},
    ...options?.videoOffsetSeconds != null ? { VideoOffsetSeconds: options.videoOffsetSeconds } : {}
  });
  tables.GameEventThrow.push({ GameEventId: gameEventId });
  const throwId = nextId();
  tables.Throw.push({
    Id: throwId,
    GameEventThrowId: gameEventId,
    Ordinal: 1,
    ThrowerId: throwerId,
    TargetId: targetId,
    RecoveredId: recoveredId,
    ResultId: resultId
  });
  deflections.forEach((deflection, index) => {
    tables.Deflection.push({
      Id: nextId(),
      ThrowId: throwId,
      Ordinal: index + 1,
      ReceiverId: deflection.receiverId,
      ResultId: deflection.resultId
    });
  });
}
function writeGameEventHistory(tables, nextId, gameId, homeGamePlayerIds, awayGamePlayerIds, seed, videoStartSeconds) {
  const rng = mulberry32(seed);
  const eliminated = /* @__PURE__ */ new Set();
  let ordinal = 1;
  let lastOffset = videoStartSeconds;
  const maxThrowEvents = 64;
  const startEventId = nextId();
  tables.GameEvent.push({
    Id: startEventId,
    GameId: gameId,
    Ordinal: ordinal,
    VideoOffsetSeconds: videoStartSeconds
  });
  tables.GameEventStart.push({ GameEventId: startEventId });
  const gameRow = tables.Game.find(
    (row) => row.Id === gameId
  );
  if (gameRow) gameRow.VideoStartSeconds = videoStartSeconds;
  ordinal += 1;
  while (ordinal <= maxThrowEvents + 1) {
    const activeHome2 = activeOf(homeGamePlayerIds, eliminated);
    const activeAway2 = activeOf(awayGamePlayerIds, eliminated);
    if (activeHome2.length === 0 || activeAway2.length === 0) break;
    const homeThrows = rng() < 0.5;
    const throwerTeam = homeThrows ? activeHome2 : activeAway2;
    const targetTeam = homeThrows ? activeAway2 : activeHome2;
    const catcherTeamAll = homeThrows ? awayGamePlayerIds : homeGamePlayerIds;
    const throwerId = pickOne(throwerTeam, rng);
    const targetId = pickOne(targetTeam, rng);
    let resultId = ThrowResult.Hit;
    let recoveredId = null;
    const deflections = [];
    const roll = rng();
    const otherTargets = targetTeam.filter((id) => id !== targetId);
    const outOnCatcherSide = catcherTeamAll.filter((id) => eliminated.has(id));
    if (ordinal > maxThrowEvents - 8) {
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
      recoveredId = outOnCatcherSide.length > 0 && rng() < 0.55 ? pickOne(outOnCatcherSide, rng) : null;
    } else if (roll < 0.86 && otherTargets.length > 0) {
      resultId = ThrowResult.Block;
      deflections.push({
        receiverId: pickOne(otherTargets, rng),
        resultId: DeflectionResult.Hit
      });
    } else if (roll < 0.93 && otherTargets.length > 0) {
      resultId = ThrowResult.Hit;
      deflections.push({
        receiverId: pickOne(otherTargets, rng),
        resultId: rng() < 0.5 ? DeflectionResult.CatchFailed : DeflectionResult.BlockFailed
      });
    } else {
      resultId = ThrowResult.Hit;
    }
    const throwRow = {
      ThrowerId: throwerId,
      TargetId: targetId,
      ResultId: resultId,
      RecoveredId: recoveredId
    };
    const deflectionRows = deflections.map((row) => ({
      ReceiverId: row.receiverId,
      ResultId: row.resultId
    }));
    const newOuts = countNewEliminations(eliminated, throwRow, deflectionRows);
    lastOffset = videoStartSeconds + (ordinal - 1) * EVENT_GAP_SECONDS;
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
      {
        isHighlight: throwIsHighlight(resultId, deflections, newOuts),
        videoOffsetSeconds: lastOffset
      }
    );
    applyThrowToEliminated(
      eliminated,
      {
        ThrowerId: throwerId,
        TargetId: targetId,
        ResultId: resultId,
        RecoveredId: recoveredId
      },
      deflections.map((row) => ({ ReceiverId: row.receiverId, ResultId: row.resultId }))
    );
    ordinal += 1;
  }
  const activeHome = activeOf(homeGamePlayerIds, eliminated);
  const activeAway = activeOf(awayGamePlayerIds, eliminated);
  if (activeHome.length > 0 && activeAway.length > 0) {
    const homeWins2 = activeAway.length <= activeHome.length;
    const survivors = homeWins2 ? activeAway : activeHome;
    const finishers = homeWins2 ? activeOf(homeGamePlayerIds, eliminated) : activeOf(awayGamePlayerIds, eliminated);
    for (const targetId of survivors) {
      const throwerId = pickOne(finishers, rng);
      lastOffset = videoStartSeconds + (ordinal - 1) * EVENT_GAP_SECONDS;
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
        { videoOffsetSeconds: lastOffset }
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
  lastOffset += EVENT_GAP_SECONDS;
  const finishEventId = nextId();
  tables.GameEvent.push({
    Id: finishEventId,
    GameId: gameId,
    Ordinal: ordinal,
    VideoOffsetSeconds: lastOffset
  });
  tables.GameEventFinish.push({
    GameEventId: finishEventId,
    ResultId: homeWins ? FINISH_WIN_HOME : FINISH_WIN_AWAY
  });
  return { homeWins, videoEndSeconds: lastOffset };
}
function buildLeagueSixTeamsDatabase() {
  let seq = 1;
  const nextId = () => fixtureId(seq++);
  const tables = createEmptyTables();
  const teamIds = [];
  const playersByTeam = [];
  for (const team of LEAGUE_TEAMS) {
    if (team.players.length !== PLAYERS_PER_TEAM) {
      throw new Error(`Expected ${PLAYERS_PER_TEAM} players for ${team.name}`);
    }
    const teamId = nextId();
    teamIds.push(teamId);
    tables.Team.push({
      Id: teamId,
      Name: team.name,
      Notes: null,
      Image: sampleImage("shapes", team.name)
    });
    const roster = [];
    for (const playerName of team.players) {
      const playerId = nextId();
      roster.push(playerId);
      tables.Player.push({
        Id: playerId,
        Name: playerName,
        Notes: null,
        Image: sampleImage(team.avatarStyle, playerName)
      });
      tables.TeamPlayer.push({
        Id: nextId(),
        TeamId: teamId,
        PlayerId: playerId
      });
    }
    playersByTeam.push(roster);
  }
  LEAGUE_MATCH_PAIRINGS.forEach(([homeIdx, awayIdx], matchIndex) => {
    const matchId = nextId();
    tables.Match.push({
      Id: matchId,
      TeamIdHome: teamIds[homeIdx],
      TeamIdAway: teamIds[awayIdx],
      Notes: null,
      YoutubeUrl: DEMO_YOUTUBE_URLS[matchIndex % DEMO_YOUTUBE_URLS.length]
    });
    const matchPlayerBySide = {
      home: /* @__PURE__ */ new Map(),
      away: /* @__PURE__ */ new Map()
    };
    for (let pi = 0; pi < PLAYERS_PER_TEAM; pi++) {
      for (const [teamHome, teamIdx, map] of [
        [true, homeIdx, matchPlayerBySide.home],
        [false, awayIdx, matchPlayerBySide.away]
      ]) {
        const playerId = playersByTeam[teamIdx][pi];
        const matchPlayerId = nextId();
        map.set(pi, matchPlayerId);
        tables.MatchPlayer.push({
          Id: matchPlayerId,
          MatchId: matchId,
          PlayerId: playerId,
          TeamHome: teamHome
        });
      }
    }
    let nextGameStartSeconds = MATCH_INTRO_SECONDS;
    for (let gameIndex = 0; gameIndex < GAMES_PER_MATCH; gameIndex++) {
      const gameId = nextId();
      const matchEventId = nextId();
      tables.Game.push({ Id: gameId });
      tables.MatchEvent.push({
        Id: matchEventId,
        MatchId: matchId,
        Ordinal: gameIndex + 1
      });
      tables.MatchEventGame.push({
        MatchEventId: matchEventId,
        GameId: gameId
      });
      const homeGamePlayerIds = [];
      const awayGamePlayerIds = [];
      for (const pi of playerIndicesForGame(gameIndex)) {
        const homeGpId = nextId();
        const awayGpId = nextId();
        homeGamePlayerIds.push(homeGpId);
        awayGamePlayerIds.push(awayGpId);
        tables.GamePlayer.push(
          {
            Id: homeGpId,
            GameId: gameId,
            MatchPlayerId: matchPlayerBySide.home.get(pi)
          },
          {
            Id: awayGpId,
            GameId: gameId,
            MatchPlayerId: matchPlayerBySide.away.get(pi)
          }
        );
      }
      const { videoEndSeconds } = writeGameEventHistory(
        tables,
        nextId,
        gameId,
        homeGamePlayerIds,
        awayGamePlayerIds,
        (homeIdx + 1) * 1e3 + (awayIdx + 1) * 100 + gameIndex * 17 + 42,
        nextGameStartSeconds
      );
      nextGameStartSeconds = videoEndSeconds + BETWEEN_GAMES_GAP_SECONDS;
    }
  });
  return { Tables: tables };
}
function leagueSixTeamsScrkprJson() {
  return JSON.stringify(buildLeagueSixTeamsDatabase());
}
const LEAGUE_SIX_TEAMS_FIXTURE = "league-six-teams.scrkpr";
function leagueSixTeamsFixturePath() {
  return import_path.default.join(process.cwd(), "tests", "fixtures", LEAGUE_SIX_TEAMS_FIXTURE);
}
function writeLeagueSixTeamsFixture() {
  (0, import_fs.writeFileSync)(leagueSixTeamsFixturePath(), leagueSixTeamsScrkprJson(), "utf-8");
}
const invokedAsScript = typeof process !== "undefined" && Array.isArray(process.argv) && process.argv[1] != null && /league-six-teams\.(ts|js|mjs|cjs)$/.test(process.argv[1].replace(/\\/g, "/"));
if (invokedAsScript) {
  writeLeagueSixTeamsFixture();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEMO_YOUTUBE_URLS,
  GAMES_PER_MATCH,
  LEAGUE_MATCH_PAIRINGS,
  LEAGUE_SIX_TEAMS_FIXTURE,
  LEAGUE_TEAMS,
  LEAGUE_TEAM_NAMES,
  PLAYERS_PER_GAME_SIDE,
  PLAYERS_PER_TEAM,
  buildLeagueSixTeamsDatabase,
  leagueSixTeamsFixturePath,
  leagueSixTeamsScrkprJson
});
