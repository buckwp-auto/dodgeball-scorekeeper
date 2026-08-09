import { getMatches } from '../database';
import { getMatchGames } from '../matchGame';
import type { DatabaseDto, Guid } from '../types';
import { GameEventFinishResult } from './constants';
import {
  buildGameEventsByGame,
  buildMatchOverviews,
  indexGameEventFinishes,
  type TeamRow,
} from './databaseViews';
import type { StatsScope } from './displayStats';
import { resolveStatsQuery } from './displayStats';

export type GameSeriesResult = 'home' | 'away' | 'tie' | 'unfinished';

export type MatchSeriesGame = {
  gameId: Guid;
  label: string;
  result: GameSeriesResult;
};

export type MatchSeries = {
  matchId: Guid;
  homeTeam: TeamRow;
  awayTeam: TeamRow;
  homeGameWins: number;
  awayGameWins: number;
  ties: number;
  unfinished: number;
  /** Null when no finished games. */
  matchOutcome: 'home' | 'away' | 'tie' | null;
  games: MatchSeriesGame[];
};

export type TeamStanding = {
  teamId: Guid;
  teamName: string;
  gamesWon: number;
  gamesLost: number;
  gamesTied: number;
  gameWinPct: number | null;
  matchesWon: number;
  matchesLost: number;
  matchesTied: number;
  matchWinPct: number | null;
};

export function buildMatchSeries(
  data: DatabaseDto,
  matchId: Guid,
): MatchSeries | null {
  const overview = buildMatchOverviews(data).get(matchId);
  if (!overview) return null;

  const finishes = indexGameEventFinishes(data);
  const eventsByGame = buildGameEventsByGame(data);
  const listed = getMatchGames(data, matchId);

  let homeGameWins = 0;
  let awayGameWins = 0;
  let ties = 0;
  let unfinished = 0;
  const games: MatchSeriesGame[] = listed.map((item) => {
    const events = eventsByGame.get(item.gameId) ?? [];
    const finish = events
      .map((event) => finishes.get(event.Id))
      .find((row) => row != null);
    if (!finish) {
      unfinished += 1;
      return { gameId: item.gameId, label: item.label, result: 'unfinished' };
    }
    if (finish.ResultId === GameEventFinishResult.WinHome) {
      homeGameWins += 1;
      return { gameId: item.gameId, label: item.label, result: 'home' };
    }
    if (finish.ResultId === GameEventFinishResult.WinAway) {
      awayGameWins += 1;
      return { gameId: item.gameId, label: item.label, result: 'away' };
    }
    ties += 1;
    return { gameId: item.gameId, label: item.label, result: 'tie' };
  });

  let matchOutcome: MatchSeries['matchOutcome'] = null;
  if (homeGameWins + awayGameWins + ties > 0) {
    if (homeGameWins > awayGameWins) matchOutcome = 'home';
    else if (awayGameWins > homeGameWins) matchOutcome = 'away';
    else matchOutcome = 'tie';
  }

  return {
    matchId,
    homeTeam: overview.teamHome,
    awayTeam: overview.teamAway,
    homeGameWins,
    awayGameWins,
    ties,
    unfinished,
    matchOutcome,
    games,
  };
}

/** Home/away game wins, e.g. `Hawks 2–1 Owls` (ties appended when present). */
export function formatMatchSeriesScore(series: MatchSeries): string {
  const score = `${series.homeTeam.Name} ${series.homeGameWins}–${series.awayGameWins} ${series.awayTeam.Name}`;
  if (series.ties > 0) return `${score} (${series.ties} T)`;
  return score;
}

export function buildTeamStandings(
  data: DatabaseDto,
  matchIds?: Guid[],
): TeamStanding[] {
  const ids = matchIds ?? getMatches(data).map((row) => row.match.Id);
  const byTeam = new Map<Guid, TeamStanding>();

  const ensure = (team: TeamRow): TeamStanding => {
    let standing = byTeam.get(team.Id);
    if (!standing) {
      standing = emptyStanding(team);
      byTeam.set(team.Id, standing);
    }
    return standing;
  };

  for (const matchId of ids) {
    const series = buildMatchSeries(data, matchId);
    if (!series) continue;
    const home = ensure(series.homeTeam);
    const away = ensure(series.awayTeam);
    for (const game of series.games) {
      if (game.result === 'home') {
        home.gamesWon += 1;
        away.gamesLost += 1;
      } else if (game.result === 'away') {
        away.gamesWon += 1;
        home.gamesLost += 1;
      } else if (game.result === 'tie') {
        home.gamesTied += 1;
        away.gamesTied += 1;
      }
    }
    if (series.matchOutcome === 'home') {
      home.matchesWon += 1;
      away.matchesLost += 1;
    } else if (series.matchOutcome === 'away') {
      away.matchesWon += 1;
      home.matchesLost += 1;
    } else if (series.matchOutcome === 'tie') {
      home.matchesTied += 1;
      away.matchesTied += 1;
    }
  }

  return [...byTeam.values()]
    .map(finalizeStanding)
    .sort((a, b) => {
      const ap = a.gameWinPct ?? -1;
      const bp = b.gameWinPct ?? -1;
      if (bp !== ap) return bp - ap;
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      return a.teamName.localeCompare(b.teamName);
    });
}

export function buildTeamStandingsForScope(
  data: DatabaseDto,
  scope: StatsScope,
): TeamStanding[] {
  const { matchIds } = resolveStatsQuery(data, scope);
  return buildTeamStandings(data, matchIds);
}

function emptyStanding(team: TeamRow): TeamStanding {
  return {
    teamId: team.Id,
    teamName: team.Name,
    gamesWon: 0,
    gamesLost: 0,
    gamesTied: 0,
    gameWinPct: null,
    matchesWon: 0,
    matchesLost: 0,
    matchesTied: 0,
    matchWinPct: null,
  };
}

function finalizeStanding(standing: TeamStanding): TeamStanding {
  const decidedGames = standing.gamesWon + standing.gamesLost + standing.gamesTied;
  const decidedMatches =
    standing.matchesWon + standing.matchesLost + standing.matchesTied;
  return {
    ...standing,
    gameWinPct: decidedGames > 0 ? standing.gamesWon / decidedGames : null,
    matchWinPct: decidedMatches > 0 ? standing.matchesWon / decidedMatches : null,
  };
}
