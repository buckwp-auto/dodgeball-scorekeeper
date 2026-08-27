import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from './database';
import {
  getGameStartEvent,
  persistFinishGameEvent,
  persistThrowGameEvent,
  setGameEventVideoOffset,
} from './gameEvents';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from './matchGame';
import {
  buildMatchListSpoiler,
  formatInProgressGameClock,
} from './matchListSpoiler';
import { GameEventFinishResult, ThrowResult } from './statistics/constants';

function setupTwoTeamLeague() {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home Hawks');
  const away = addTeam(data, 'Away Owls');
  const h1 = addPlayer(data, home.Id, 'Alex');
  const a1 = addPlayer(data, away.Id, 'Casey');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  return { data, home, away, h1, a1, match };
}

function addGameWithRoster(
  data: ReturnType<typeof createEmptyDatabase>,
  matchId: string,
  homePlayerId: string,
  awayPlayerId: string,
) {
  const gameId = addGame(data, matchId);
  toggleGamePlayer(data, matchId, gameId, homePlayerId);
  toggleGamePlayer(data, matchId, gameId, awayPlayerId);
  return gameId;
}

function throwHit(
  data: ReturnType<typeof createEmptyDatabase>,
  matchId: string,
  gameId: string,
  videoOffsetSeconds?: number,
) {
  const players = (
    data.Tables.GamePlayer as { Id: string; GameId: string; MatchPlayerId: string }[]
  ).filter((row) => row.GameId === gameId);
  const matchPlayers = data.Tables.MatchPlayer as {
    Id: string;
    PlayerId: string;
    TeamHome: boolean;
  }[];
  const homeGp = players.find(
    (row) => matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.TeamHome,
  )!;
  const awayGp = players.find(
    (row) => matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.TeamHome === false,
  )!;
  persistThrowGameEvent(
    data,
    gameId,
    matchId,
    [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ],
    videoOffsetSeconds != null ? { videoOffsetSeconds } : undefined,
  );
}

describe('buildMatchListSpoiler', () => {
  it('marks a match with no games as not started and 0–0', () => {
    const { data, match } = setupTwoTeamLeague();
    const spoiler = buildMatchListSpoiler(data, match.Id)!;
    expect(spoiler.progress).toBe('notStarted');
    expect(spoiler.progressLabel).toBe('Not started');
    expect(spoiler.scoreText).toBe('Home Hawks 0–0 Away Owls');
    expect(spoiler.activeGameLabel).toBeNull();
    expect(spoiler.gameClockText).toBeNull();
  });

  it('marks a fully finished series as finished with game wins', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    const gameId = addGameWithRoster(data, match.Id, h1.Id, a1.Id);
    persistFinishGameEvent(data, gameId, { resultId: GameEventFinishResult.WinHome });

    const spoiler = buildMatchListSpoiler(data, match.Id)!;
    expect(spoiler.progress).toBe('finished');
    expect(spoiler.progressLabel).toBe('Finished');
    expect(spoiler.scoreText).toBe('Home Hawks 1–0 Away Owls');
    expect(spoiler.activeGameLabel).toBeNull();
    expect(spoiler.gameClockText).toBeNull();
  });

  it('marks an unfinished game as in progress without inventing a clock', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    addGameWithRoster(data, match.Id, h1.Id, a1.Id);

    const spoiler = buildMatchListSpoiler(data, match.Id)!;
    expect(spoiler.progress).toBe('inProgress');
    expect(spoiler.progressLabel).toBe('In progress');
    expect(spoiler.activeGameLabel).toBe('Game 1');
    expect(spoiler.gameClockText).toBeNull();
  });

  it('uses the first unfinished game as the active clock source', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    const game1 = addGameWithRoster(data, match.Id, h1.Id, a1.Id);
    persistFinishGameEvent(data, game1, { resultId: GameEventFinishResult.WinHome });
    const game2 = addGameWithRoster(data, match.Id, h1.Id, a1.Id);
    const start = getGameStartEvent(data, game2)!;
    setGameEventVideoOffset(data, start.Id, 3600);
    throwHit(data, match.Id, game2, 3845);

    const spoiler = buildMatchListSpoiler(data, match.Id)!;
    expect(spoiler.progress).toBe('inProgress');
    expect(spoiler.scoreText).toBe('Home Hawks 1–0 Away Owls');
    expect(spoiler.activeGameLabel).toBe('Game 2');
    expect(spoiler.gameClockText).toBe('4:05');
  });
});

describe('formatInProgressGameClock', () => {
  it('returns elapsed from Game start when both stamps exist', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    const gameId = addGameWithRoster(data, match.Id, h1.Id, a1.Id);
    const start = getGameStartEvent(data, gameId)!;
    setGameEventVideoOffset(data, start.Id, 120);
    throwHit(data, match.Id, gameId, 185);
    expect(formatInProgressGameClock(data, gameId)).toBe('1:05');
  });

  it('falls back to raw VOD time when Game start is unstamped', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    const gameId = addGameWithRoster(data, match.Id, h1.Id, a1.Id);
    throwHit(data, match.Id, gameId, 125);
    expect(formatInProgressGameClock(data, gameId)).toBe('2:05');
  });

  it('returns null when nothing is stamped', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    const gameId = addGameWithRoster(data, match.Id, h1.Id, a1.Id);
    expect(formatInProgressGameClock(data, gameId)).toBeNull();
  });
});
