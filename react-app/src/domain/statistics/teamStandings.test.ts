import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from '../database';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from '../matchGame';
import { persistFinishGameEvent } from '../gameEvents';
import { GameEventFinishResult } from './constants';
import {
  buildMatchSeries,
  buildTeamStandings,
  formatMatchSeriesScore,
} from './teamStandings';

function addFinishedGame(
  data: ReturnType<typeof createEmptyDatabase>,
  matchId: string,
  homePlayerId: string,
  awayPlayerId: string,
  result: GameEventFinishResult,
) {
  const gameId = addGame(data, matchId);
  toggleGamePlayer(data, matchId, gameId, homePlayerId);
  toggleGamePlayer(data, matchId, gameId, awayPlayerId);
  persistFinishGameEvent(data, gameId, { resultId: result });
  return gameId;
}

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

describe('formatMatchSeriesScore', () => {
  it('shows 0–0 before any finished games', () => {
    const { data, match } = setupTwoTeamLeague();
    const series = buildMatchSeries(data, match.Id)!;
    expect(formatMatchSeriesScore(series)).toBe('Home Hawks 0–0 Away Owls');
  });

  it('shows finished game wins and appends ties', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    addFinishedGame(data, match.Id, h1.Id, a1.Id, GameEventFinishResult.WinHome);
    addFinishedGame(data, match.Id, h1.Id, a1.Id, GameEventFinishResult.WinAway);
    addFinishedGame(data, match.Id, h1.Id, a1.Id, GameEventFinishResult.Tie);

    const series = buildMatchSeries(data, match.Id)!;
    expect(formatMatchSeriesScore(series)).toBe('Home Hawks 1–1 Away Owls (1 T)');
  });
});

describe('team standings', () => {
  it('treats equal finished game wins as a match tie', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    addFinishedGame(data, match.Id, h1.Id, a1.Id, GameEventFinishResult.WinHome);
    addFinishedGame(data, match.Id, h1.Id, a1.Id, GameEventFinishResult.WinAway);

    const series = buildMatchSeries(data, match.Id)!;
    expect(series.homeGameWins).toBe(1);
    expect(series.awayGameWins).toBe(1);
    expect(series.matchOutcome).toBe('tie');
    expect(series.games.map((game) => game.result)).toEqual(['home', 'away']);

    const standings = buildTeamStandings(data, [match.Id]);
    const hawks = standings.find((row) => row.teamName === 'Home Hawks')!;
    const owls = standings.find((row) => row.teamName === 'Away Owls')!;
    expect(hawks.gamesWon).toBe(1);
    expect(hawks.gamesLost).toBe(1);
    expect(hawks.matchesTied).toBe(1);
    expect(hawks.matchesWon).toBe(0);
    expect(owls.matchesTied).toBe(1);
    expect(hawks.gameWinPct).toBe(0.5);
  });

  it('awards the match to the side with more finished game wins', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    addFinishedGame(data, match.Id, h1.Id, a1.Id, GameEventFinishResult.WinHome);
    addFinishedGame(data, match.Id, h1.Id, a1.Id, GameEventFinishResult.WinHome);

    const series = buildMatchSeries(data, match.Id)!;
    expect(series.matchOutcome).toBe('home');
    expect(series.homeGameWins).toBe(2);

    const standings = buildTeamStandings(data);
    const hawks = standings.find((row) => row.teamName === 'Home Hawks')!;
    const owls = standings.find((row) => row.teamName === 'Away Owls')!;
    expect(hawks.matchesWon).toBe(1);
    expect(owls.matchesLost).toBe(1);
    expect(hawks.gameWinPct).toBe(1);
  });

  it('omits unfinished games from match W-L', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    addFinishedGame(data, match.Id, h1.Id, a1.Id, GameEventFinishResult.WinHome);
    const unfinished = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, unfinished, h1.Id);
    toggleGamePlayer(data, match.Id, unfinished, a1.Id);

    const series = buildMatchSeries(data, match.Id)!;
    expect(series.unfinished).toBe(1);
    expect(series.matchOutcome).toBe('home');
    expect(series.homeGameWins).toBe(1);
  });

  it('does not assign match W-L when every game is unfinished', () => {
    const { data, match, h1, a1 } = setupTwoTeamLeague();
    const gameId = addGame(data, match.Id);
    toggleGamePlayer(data, match.Id, gameId, h1.Id);
    toggleGamePlayer(data, match.Id, gameId, a1.Id);

    const series = buildMatchSeries(data, match.Id)!;
    expect(series.matchOutcome).toBeNull();
    expect(buildTeamStandings(data)[0].matchesWon).toBe(0);
    expect(buildTeamStandings(data)[0].matchesTied).toBe(0);
  });
});
