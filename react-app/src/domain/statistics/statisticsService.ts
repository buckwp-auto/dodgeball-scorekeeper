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

  getPlayerStatisticsByGamePlayer(gamePlayerId: Guid): {
    builder: PlayerStatisticsBuilder;
    teamHome: boolean;
  } {
    const gamePlayer = this.gamePlayers.get(gamePlayerId);
    if (!gamePlayer) throw new Error('Game player not found');
    const matchPlayer = this.matchPlayers.get(gamePlayer.MatchPlayerId);
    if (!matchPlayer) throw new Error('Match player not found');
    return {
      builder: this.getPlayerStatistics(matchPlayer.PlayerId),
      teamHome: matchPlayer.TeamHome,
    };
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
        };
      })
      .filter((row): row is PlayerStatistics => row !== null);
  }
}

function isCatch(
  throwDetail: ThrowDetail,
): { caught: true; deflection: boolean } | { caught: false } {
  if (throwDetail.throwRow.ResultId === ThrowResult.Catch) {
    return { caught: true, deflection: false };
  }
  if (
    throwDetail.deflections.some(
      (deflection) => deflection.ResultId === DeflectionResult.Catch,
    )
  ) {
    return { caught: true, deflection: true };
  }
  return { caught: false };
}

function tryGetKillFromThrow(
  result: number,
): { killType: EKillType; deathType: EDeathType } | undefined {
  switch (result) {
    case ThrowResult.Hit:
      return { killType: EKillType.Hit, deathType: EDeathType.Hit };
    case ThrowResult.BlockFailed:
      return { killType: EKillType.BlockFailed, deathType: EDeathType.BlockFailed };
    case ThrowResult.CatchFailed:
      return { killType: EKillType.CatchFailed, deathType: EDeathType.CatchFailed };
    default:
      return undefined;
  }
}

function tryGetKillFromDeflection(
  result: number,
): { killType: EKillType; deathType: EDeathType } | undefined {
  switch (result) {
    case DeflectionResult.Hit:
      return { killType: EKillType.Hit, deathType: EDeathType.Hit };
    case DeflectionResult.BlockFailed:
      return { killType: EKillType.BlockFailed, deathType: EDeathType.BlockFailed };
    case DeflectionResult.CatchFailed:
      return { killType: EKillType.CatchFailed, deathType: EDeathType.CatchFailed };
    default:
      return undefined;
  }
}

function populateThrowers(
  context: StatisticsContext,
  throwDetails: ThrowDetail[],
): { throwersHome: Guid[]; throwersAway: Guid[] } {
  const throwersHome: Guid[] = [];
  const throwersAway: Guid[] = [];
  for (const throwDetail of throwDetails) {
    const { builder, teamHome } = context.getPlayerStatisticsByGamePlayer(
      throwDetail.throwRow.ThrowerId,
    );
    void builder;
    const throwers = teamHome ? throwersHome : throwersAway;
    if (!throwers.includes(throwDetail.throwRow.ThrowerId)) {
      throwers.push(throwDetail.throwRow.ThrowerId);
    }
  }
  return { throwersHome, throwersAway };
}

function processThrow(
  context: StatisticsContext,
  throwDetail: ThrowDetail,
  allThrowDetails: ThrowDetail[],
): void {
  const catchResult = isCatch(throwDetail);
  const { throwersHome, throwersAway } = populateThrowers(context, allThrowDetails);
  const { builder: thrower, teamHome: throwerHome } =
    context.getPlayerStatisticsByGamePlayer(throwDetail.throwRow.ThrowerId);
  const throwers = throwerHome ? throwersHome : throwersAway;
  const offense = throwers.length > 1 ? thrower.offenseGroup : thrower.offenseIndividual;
  const kills = throwers.length > 1 ? thrower.killsGroup : thrower.killsIndividual;
  const killsCredit = thrower.killsCredit;
  const killCredit = 1 / throwers.length;

  offense.throws.increment(throwDetail.throwRow.ResultId as ThrowResult, 1);

  const { builder: target } = context.getPlayerStatisticsByGamePlayer(
    throwDetail.throwRow.TargetId,
  );
  target.defense.targets.increment(throwDetail.throwRow.ResultId as ThrowResult, 1);

  if (catchResult.caught) {
    const deaths = catchResult.deflection
      ? thrower.deaths.deflections
      : thrower.deaths.direct;
    deaths.increment(EDeathType.CatchThrown, 1);
  } else {
    const kill = tryGetKillFromThrow(throwDetail.throwRow.ResultId);
    if (kill) {
      target.deaths.direct.increment(kill.deathType, 1);
      kills.direct.increment(kill.killType, 1);
      killsCredit.direct.increment(kill.killType, killCredit);
      for (const throwerOther of throwers) {
        if (throwerOther !== throwDetail.throwRow.ThrowerId) {
          context
            .getPlayerStatisticsByGamePlayer(throwerOther)
            .builder.killsCredit.support.increment(kill.killType, killCredit);
        }
      }
    }
  }

  for (const deflection of throwDetail.deflections) {
    offense.deflections.increment(deflection.ResultId as DeflectionResult, 1);
    const { builder: receiver } = context.getPlayerStatisticsByGamePlayer(
      deflection.ReceiverId,
    );
    receiver.defense.deflections.increment(deflection.ResultId as DeflectionResult, 1);
    if (!catchResult.caught) {
      const kill = tryGetKillFromDeflection(deflection.ResultId);
      if (kill) {
        receiver.deaths.deflections.increment(kill.deathType, 1);
        kills.deflections.increment(kill.killType, 1);
        killsCredit.deflections.increment(kill.killType, killCredit);
        for (const throwerOther of throwers) {
          if (throwerOther !== throwDetail.throwRow.ThrowerId) {
            context
              .getPlayerStatisticsByGamePlayer(throwerOther)
              .builder.killsCredit.support.increment(kill.killType, killCredit);
          }
        }
      }
    }
  }
}

function processError(
  context: StatisticsContext,
  offenderId: Guid,
  offenseId: number,
): void {
  const { builder: offender } = context.getPlayerStatisticsByGamePlayer(offenderId);
  switch (offenseId) {
    case GameEventErrorOffense.LineOut:
      offender.deaths.errors.increment(EDeathError.LineOut, 1);
      break;
    case GameEventErrorOffense.WastedBall:
      offender.offenseErrors.increment(EThrowError.WastedBall, 1);
      break;
    case GameEventErrorOffense.BlockIllegal:
      offender.deaths.errors.increment(EDeathError.BlockIllegal, 1);
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
            processThrow(context, detail, details);
          }
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
