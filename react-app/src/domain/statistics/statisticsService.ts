import { resolveLeagueStatPolicy } from '../leagueSettings';
import type { DatabaseDto, Guid } from '../types';
import {
  DeflectionResult,
  ECompetitionOutcome,
  EDeathError,
  EDeathType,
  EKillType,
  EThrowError,
  GameEventErrorOffense,
  GameEventFinishResult,
  ThrowResult,
  enumValues,
  invertCompetitionOutcome,
} from './constants';
import {
  AmountsBuilder,
  CountsBuilder,
  StatisticAggregates,
} from './statisticAggregates';
import {
  buildGameEventsByGame,
  buildGameOverviews,
  buildMatchEventsByMatch,
  buildMatchOverviews,
  buildPlayerOverviews,
  buildThrowsDetail,
  indexGameEventErrors,
  indexGameEventFinishes,
  indexGameEventThrows,
  indexGamePlayers,
  indexMatchEventGames,
  indexMatchPlayers,
  type GameOverview,
  type MatchOverview,
  type MatchPlayerRow,
  type PlayerOverview,
  type ThrowDetail,
} from './databaseViews';
import {
  awardThrowEventCredit,
  type EventCreditAwards,
} from './statCreditEngine';
import type { StatCreditPolicy } from './statCreditPolicy';

class PlayerStatisticsBuilder {
  readonly playerId: Guid;
  readonly matches = new CountsBuilder<ECompetitionOutcome>();
  readonly games = new CountsBuilder<ECompetitionOutcome>();
  readonly offenseIndividual = new PlayerStatisticsBuilderOffense();
  readonly offenseGroup = new PlayerStatisticsBuilderOffense();
  readonly offenseErrors = new CountsBuilder<EThrowError>();
  readonly defense = new PlayerStatisticsBuilderDefense();
  readonly killsIndividual = new PlayerStatisticsBuilderKills();
  readonly killsGroup = new PlayerStatisticsBuilderKills();
  readonly killsCredit = new PlayerStatisticsBuilderKillsCredit();
  readonly deaths = new PlayerStatisticsBuilderDeaths();
  deathsCredit = 0;
  teamThrowAssists = 0;
  doubleKills = 0;
  tripleKills = 0;
  quadKills = 0;
  doubleCatches = 0;
  tripleCatches = 0;
  quadCatches = 0;
  catchesDirect = 0;
  catchesDeflection = 0;

  constructor(playerId: Guid) {
    this.playerId = playerId;
  }
}

class PlayerStatisticsBuilderOffense {
  readonly throws = new CountsBuilder<ThrowResult>();
  readonly deflections = new CountsBuilder<DeflectionResult>();
}

class PlayerStatisticsBuilderDefense {
  readonly targets = new CountsBuilder<ThrowResult>();
  readonly deflections = new CountsBuilder<DeflectionResult>();
}

class PlayerStatisticsBuilderKills {
  readonly direct = new CountsBuilder<EKillType>();
  readonly deflections = new CountsBuilder<EKillType>();
}

class PlayerStatisticsBuilderKillsCredit {
  readonly direct = new AmountsBuilder<EKillType>();
  readonly deflections = new AmountsBuilder<EKillType>();
  readonly support = new AmountsBuilder<EKillType>();
}

class PlayerStatisticsBuilderDeaths {
  readonly direct = new CountsBuilder<EDeathType>();
  readonly deflections = new CountsBuilder<EDeathType>();
  readonly errors = new CountsBuilder<EDeathError>();
}

export type PlayerStatistics = {
  playerId: Guid;
  team: PlayerOverview['team'];
  player: PlayerOverview['player'];
  matches: StatisticAggregates<ECompetitionOutcome, number>;
  games: StatisticAggregates<ECompetitionOutcome, number>;
  offenseThrowsIndividual: StatisticAggregates<ThrowResult, number>;
  offenseThrowsGroup: StatisticAggregates<ThrowResult, number>;
  offenseDeflectionsIndividual: StatisticAggregates<DeflectionResult, number>;
  offenseDeflectionsGroup: StatisticAggregates<DeflectionResult, number>;
  offenseErrors: StatisticAggregates<EThrowError, number>;
  defenseTargets: StatisticAggregates<ThrowResult, number>;
  defenseDeflections: StatisticAggregates<DeflectionResult, number>;
  killsDirectIndividual: StatisticAggregates<EKillType, number>;
  killsDirectGroup: StatisticAggregates<EKillType, number>;
  killsDirectCredit: StatisticAggregates<EKillType, number>;
  killsDeflectionsIndividual: StatisticAggregates<EKillType, number>;
  killsDeflectionsGroup: StatisticAggregates<EKillType, number>;
  killsDeflectionsCredit: StatisticAggregates<EKillType, number>;
  killsSupportCredit: StatisticAggregates<EKillType, number>;
  deathsDirect: StatisticAggregates<EDeathType, number>;
  deathsDeflections: StatisticAggregates<EDeathType, number>;
  deathsErrors: StatisticAggregates<EDeathError, number>;
  deathsCredit: number;
  teamThrowAssists: number;
  doubleKills: number;
  tripleKills: number;
  quadKills: number;
  doubleCatches: number;
  tripleCatches: number;
  quadCatches: number;
  catchesDirect: number;
  catchesDeflection: number;
};

class StatisticsContext {
  readonly playerOverviews: Map<Guid, PlayerOverview>;
  readonly matchPlayers: Map<Guid, MatchPlayerRow>;
  readonly gamePlayers: Map<Guid, import('./databaseViews').GamePlayerRow>;
  private readonly builders = new Map<Guid, PlayerStatisticsBuilder>();

  constructor(
    playerOverviews: Map<Guid, PlayerOverview>,
    matchPlayers: Map<Guid, MatchPlayerRow>,
    gamePlayers: Map<Guid, import('./databaseViews').GamePlayerRow>,
  ) {
    this.playerOverviews = playerOverviews;
    this.matchPlayers = matchPlayers;
    this.gamePlayers = gamePlayers;
  }

  tryGetPlayerStatisticsByGamePlayer(gamePlayerId: Guid): {
    builder: PlayerStatisticsBuilder;
    teamHome: boolean;
  } | null {
    const gamePlayer = this.gamePlayers.get(gamePlayerId);
    if (!gamePlayer) return null;
    const matchPlayer = this.matchPlayers.get(gamePlayer.MatchPlayerId);
    if (!matchPlayer) return null;
    return {
      builder: this.getPlayerStatistics(matchPlayer.PlayerId),
      teamHome: matchPlayer.TeamHome,
    };
  }

  getPlayerStatisticsByGamePlayer(gamePlayerId: Guid): {
    builder: PlayerStatisticsBuilder;
    teamHome: boolean;
  } {
    const resolved = this.tryGetPlayerStatisticsByGamePlayer(gamePlayerId);
    if (!resolved) {
      throw new Error(
        this.gamePlayers.has(gamePlayerId)
          ? 'Match player not found'
          : 'Game player not found',
      );
    }
    return resolved;
  }

  getPlayerStatisticsByMatchPlayer(matchPlayerId: Guid): {
    builder: PlayerStatisticsBuilder;
    teamHome: boolean;
  } {
    const matchPlayer = this.matchPlayers.get(matchPlayerId);
    if (!matchPlayer) throw new Error('Match player not found');
    return {
      builder: this.getPlayerStatistics(matchPlayer.PlayerId),
      teamHome: matchPlayer.TeamHome,
    };
  }

  getPlayerStatistics(playerId: Guid): PlayerStatisticsBuilder {
    let builder = this.builders.get(playerId);
    if (!builder) {
      builder = new PlayerStatisticsBuilder(playerId);
      this.builders.set(playerId, builder);
    }
    return builder;
  }

  buildPlayerStatistics(): PlayerStatistics[] {
    return [...this.builders.values()]
      .map((builder) => {
        const overview = this.playerOverviews.get(builder.playerId);
        if (!overview) return null;
        return {
          playerId: builder.playerId,
          team: overview.team,
          player: overview.player,
          matches: builder.matches.build(),
          games: builder.games.build(),
          offenseThrowsIndividual: builder.offenseIndividual.throws.build(),
          offenseThrowsGroup: builder.offenseGroup.throws.build(),
          offenseDeflectionsIndividual: builder.offenseIndividual.deflections.build(),
          offenseDeflectionsGroup: builder.offenseGroup.deflections.build(),
          offenseErrors: builder.offenseErrors.build(),
          defenseTargets: builder.defense.targets.build(),
          defenseDeflections: builder.defense.deflections.build(),
          killsDirectIndividual: builder.killsIndividual.direct.build(),
          killsDirectGroup: builder.killsGroup.direct.build(),
          killsDirectCredit: builder.killsCredit.direct.build(),
          killsDeflectionsIndividual: builder.killsIndividual.deflections.build(),
          killsDeflectionsGroup: builder.killsGroup.deflections.build(),
          killsDeflectionsCredit: builder.killsCredit.deflections.build(),
          killsSupportCredit: builder.killsCredit.support.build(),
          deathsDirect: builder.deaths.direct.build(),
          deathsDeflections: builder.deaths.deflections.build(),
          deathsErrors: builder.deaths.errors.build(),
          deathsCredit: builder.deathsCredit,
          teamThrowAssists: builder.teamThrowAssists,
          doubleKills: builder.doubleKills,
          tripleKills: builder.tripleKills,
          quadKills: builder.quadKills,
          doubleCatches: builder.doubleCatches,
          tripleCatches: builder.tripleCatches,
          quadCatches: builder.quadCatches,
          catchesDirect: builder.catchesDirect,
          catchesDeflection: builder.catchesDeflection,
        };
      })
      .filter((row): row is PlayerStatistics => row !== null);
  }
}

function populateThrowers(
  context: StatisticsContext,
  throwDetails: ThrowDetail[],
): { throwersHome: Guid[]; throwersAway: Guid[] } {
  const throwersHome: Guid[] = [];
  const throwersAway: Guid[] = [];
  for (const throwDetail of throwDetails) {
    const resolved = context.tryGetPlayerStatisticsByGamePlayer(
      throwDetail.throwRow.ThrowerId,
    );
    if (!resolved) continue;
    const throwers = resolved.teamHome ? throwersHome : throwersAway;
    if (!throwers.includes(throwDetail.throwRow.ThrowerId)) {
      throwers.push(throwDetail.throwRow.ThrowerId);
    }
  }
  return { throwersHome, throwersAway };
}

function incrementThrowFacts(
  context: StatisticsContext,
  throwDetail: ThrowDetail,
  allThrowDetails: ThrowDetail[],
): void {
  const { throwersHome, throwersAway } = populateThrowers(context, allThrowDetails);
  const throwerInfo = context.tryGetPlayerStatisticsByGamePlayer(
    throwDetail.throwRow.ThrowerId,
  );
  if (throwerInfo) {
    const throwers = throwerInfo.teamHome ? throwersHome : throwersAway;
    const offense =
      throwers.length > 1 ? throwerInfo.builder.offenseGroup : throwerInfo.builder.offenseIndividual;
    offense.throws.increment(throwDetail.throwRow.ResultId as ThrowResult, 1);
    for (const deflection of throwDetail.deflections) {
      offense.deflections.increment(deflection.ResultId as DeflectionResult, 1);
    }
  }

  const target = context.tryGetPlayerStatisticsByGamePlayer(throwDetail.throwRow.TargetId);
  if (target) {
    target.builder.defense.targets.increment(throwDetail.throwRow.ResultId as ThrowResult, 1);
  }

  for (const deflection of throwDetail.deflections) {
    const receiver = context.tryGetPlayerStatisticsByGamePlayer(deflection.ReceiverId);
    if (receiver) {
      receiver.builder.defense.deflections.increment(deflection.ResultId as DeflectionResult, 1);
    }
  }
}

function applyEventAwards(
  context: StatisticsContext,
  details: ThrowDetail[],
  awards: EventCreditAwards,
): void {
  const { throwersHome, throwersAway } = populateThrowers(context, details);

  const groupFor = (gamePlayerId: Guid) => {
    const resolved = context.tryGetPlayerStatisticsByGamePlayer(gamePlayerId);
    if (!resolved) return null;
    const throwers = resolved.teamHome ? throwersHome : throwersAway;
    return { builder: resolved.builder, group: throwers.length > 1 };
  };

  for (const kill of awards.throwerKills) {
    const grouped = groupFor(kill.throwerId);
    if (!grouped) continue;
    const { builder, group } = grouped;
    const kills = group ? builder.killsGroup : builder.killsIndividual;
    const countBucket = kill.source === 'deflection' ? kills.deflections : kills.direct;
    countBucket.increment(kill.killType, kill.integer);
    const creditBucket =
      kill.source === 'deflection'
        ? builder.killsCredit.deflections
        : builder.killsCredit.direct;
    creditBucket.increment(kill.killType, kill.credit);
  }

  for (const support of awards.supportCredits) {
    const resolved = context.tryGetPlayerStatisticsByGamePlayer(support.throwerId);
    if (!resolved) continue;
    resolved.builder.killsCredit.support.increment(support.killType, support.credit);
  }

  for (const death of awards.targetDeaths) {
    const resolved = context.tryGetPlayerStatisticsByGamePlayer(death.targetId);
    if (!resolved) continue;
    const { builder } = resolved;
    const bucket =
      death.source === 'deflection' ? builder.deaths.deflections : builder.deaths.direct;
    bucket.increment(death.deathType, death.integer);
    builder.deathsCredit += death.credit;
  }

  for (const death of awards.catchThrownDeaths) {
    const resolved = context.tryGetPlayerStatisticsByGamePlayer(death.throwerId);
    if (!resolved) continue;
    const { builder } = resolved;
    const bucket =
      death.source === 'deflection' ? builder.deaths.deflections : builder.deaths.direct;
    bucket.increment(EDeathType.CatchThrown, death.integer);
    builder.deathsCredit += death.credit;
  }

  for (const throwerId of awards.assists) {
    const resolved = context.tryGetPlayerStatisticsByGamePlayer(throwerId);
    if (!resolved) continue;
    resolved.builder.teamThrowAssists += 1;
  }

  for (const multi of awards.multiKills) {
    const resolved = context.tryGetPlayerStatisticsByGamePlayer(multi.throwerId);
    if (!resolved) continue;
    const builder = resolved.builder;
    if (multi.size === 2) builder.doubleKills += 1;
    else if (multi.size === 3) builder.tripleKills += 1;
    else builder.quadKills += 1;
  }

  for (const catchAward of awards.catches) {
    const resolved = context.tryGetPlayerStatisticsByGamePlayer(catchAward.catcherId);
    if (!resolved) continue;
    const builder = resolved.builder;
    if (catchAward.source === 'deflection') builder.catchesDeflection += 1;
    else builder.catchesDirect += 1;
  }

  for (const multi of awards.multiCatches) {
    const resolved = context.tryGetPlayerStatisticsByGamePlayer(multi.catcherId);
    if (!resolved) continue;
    const builder = resolved.builder;
    if (multi.size === 2) builder.doubleCatches += 1;
    else if (multi.size === 3) builder.tripleCatches += 1;
    else builder.quadCatches += 1;
  }
}

function processError(
  context: StatisticsContext,
  offenderId: Guid,
  offenseId: number,
): void {
  const resolved = context.tryGetPlayerStatisticsByGamePlayer(offenderId);
  if (!resolved) return;
  const { builder: offender } = resolved;
  switch (offenseId) {
    case GameEventErrorOffense.LineOut:
      offender.deaths.errors.increment(EDeathError.LineOut, 1);
      offender.deathsCredit += 1;
      break;
    case GameEventErrorOffense.WastedBall:
      offender.offenseErrors.increment(EThrowError.WastedBall, 1);
      break;
    case GameEventErrorOffense.BlockIllegal:
      offender.deaths.errors.increment(EDeathError.BlockIllegal, 1);
      offender.deathsCredit += 1;
      break;
    default:
      throw new Error(`Error game event offense (${offenseId}) not recognized.`);
  }
}

function processMatchOutcome(
  context: StatisticsContext,
  matchOverview: MatchOverview,
  matchOutcomeHome: ECompetitionOutcome,
): void {
  const matchOutcomeAway = invertCompetitionOutcome(matchOutcomeHome);
  for (const matchPlayer of matchOverview.matchPlayers) {
    const builder = context.getPlayerStatistics(matchPlayer.PlayerId);
    const outcome = matchPlayer.TeamHome ? matchOutcomeHome : matchOutcomeAway;
    builder.matches.increment(outcome, 1);
  }
}

function processGameOutcome(
  context: StatisticsContext,
  gameOverview: GameOverview,
  gameOutcomeHome: ECompetitionOutcome,
): void {
  const gameOutcomeAway = invertCompetitionOutcome(gameOutcomeHome);
  for (const gamePlayer of gameOverview.gamePlayers) {
    const matchPlayer = context.matchPlayers.get(gamePlayer.MatchPlayerId);
    if (!matchPlayer) continue;
    const builder = context.getPlayerStatistics(matchPlayer.PlayerId);
    const outcome = matchPlayer.TeamHome ? gameOutcomeHome : gameOutcomeAway;
    builder.games.increment(outcome, 1);
  }
}

function getGameOutcomeHome(resultId: number): ECompetitionOutcome {
  switch (resultId) {
    case GameEventFinishResult.WinHome:
      return ECompetitionOutcome.Win;
    case GameEventFinishResult.WinAway:
      return ECompetitionOutcome.Loss;
    case GameEventFinishResult.Tie:
      return ECompetitionOutcome.Tie;
    default:
      throw new Error(`Finish game event result (${resultId}) not recognized.`);
  }
}

export function createStatisticsSummary(
  data: DatabaseDto,
  matchIds: Guid[],
  gameIds?: Set<Guid>,
  policy: StatCreditPolicy = resolveLeagueStatPolicy(data),
): PlayerStatistics[] {
  const playerOverviews = buildPlayerOverviews(data);
  const matchOverviews = buildMatchOverviews(data);
  const gameOverviews = buildGameOverviews(data);
  const matchEventsByMatch = buildMatchEventsByMatch(data);
  const gameEventsByGame = buildGameEventsByGame(data);
  const throwsDetail = buildThrowsDetail(data);
  const matchEventGames = indexMatchEventGames(data);
  const gameEventThrows = indexGameEventThrows(data);
  const gameEventErrors = indexGameEventErrors(data);
  const gameEventFinishes = indexGameEventFinishes(data);

  const context = new StatisticsContext(
    playerOverviews,
    indexMatchPlayers(data),
    indexGamePlayers(data),
  );

  for (const matchId of matchIds) {
    const matchOverview = matchOverviews.get(matchId);
    if (!matchOverview) continue;

    let matchOutcomeHome = ECompetitionOutcome.Incomplete;
    const matchEvents = matchEventsByMatch.get(matchId) ?? [];

    for (const matchEvent of matchEvents) {
      const matchEventGame = matchEventGames.get(matchEvent.Id);
      if (!matchEventGame) continue;
      if (gameIds && !gameIds.has(matchEventGame.GameId)) continue;

      let gameOutcomeHome = ECompetitionOutcome.Incomplete;
      const gameEvents = gameEventsByGame.get(matchEventGame.GameId) ?? [];

      for (const gameEvent of gameEvents) {
        const gameEventThrow = gameEventThrows.get(gameEvent.Id);
        if (gameEventThrow) {
          const details = throwsDetail.get(gameEvent.Id) ?? [];
          for (const detail of details) {
            incrementThrowFacts(context, detail, details);
          }
          applyEventAwards(context, details, awardThrowEventCredit(details, policy));
          continue;
        }

        const gameEventError = gameEventErrors.get(gameEvent.Id);
        if (gameEventError) {
          processError(context, gameEventError.OffenderId, gameEventError.OffenseId);
          continue;
        }

        const gameEventFinish = gameEventFinishes.get(gameEvent.Id);
        if (gameEventFinish) {
          gameOutcomeHome = getGameOutcomeHome(gameEventFinish.ResultId);
        }
      }

      const gameOverview = gameOverviews.get(matchEventGame.GameId);
      if (gameOverview) {
        processGameOutcome(context, gameOverview, gameOutcomeHome);
      }
    }

    processMatchOutcome(context, matchOverview, matchOutcomeHome);
  }

  return context
    .buildPlayerStatistics()
    .sort(
      (a, b) =>
        a.team.Name.localeCompare(b.team.Name) ||
        a.player.Name.localeCompare(b.player.Name),
    );
}

export { enumValues };
