export enum ECompetitionOutcome {
  Win = 1,
  Loss = 2,
  Tie = 3,
  Incomplete = 4,
}

export enum EKillType {
  Hit = 1,
  BlockFailed = 2,
  CatchFailed = 3,
}

export enum EDeathType {
  Hit = 1,
  BlockFailed = 2,
  CatchFailed = 3,
  CatchThrown = 4,
}

export enum EThrowError {
  WastedBall = 1,
}

export enum EDeathError {
  LineOut = 1,
  BlockIllegal = 2,
}

export enum ThrowResult {
  Hit = 1,
  Block = 2,
  BlockFailed = 3,
  Catch = 4,
  CatchFailed = 5,
  Dodge = 6,
  Miss = 7,
}

export enum DeflectionResult {
  Hit = 1,
  Block = 2,
  BlockFailed = 3,
  Catch = 4,
  CatchFailed = 5,
}

export enum GameEventFinishResult {
  WinHome = 1,
  WinAway = 2,
  Tie = 3,
}

export enum GameEventErrorOffense {
  LineOut = 1,
  WastedBall = 2,
  BlockIllegal = 3,
}

export function invertCompetitionOutcome(
  outcome: ECompetitionOutcome,
): ECompetitionOutcome {
  if (outcome === ECompetitionOutcome.Win) return ECompetitionOutcome.Loss;
  if (outcome === ECompetitionOutcome.Loss) return ECompetitionOutcome.Win;
  return outcome;
}

export function enumValues<T extends Record<string, number | string>>(
  enumObject: T,
): number[] {
  return Object.values(enumObject).filter(
    (value): value is number => typeof value === 'number',
  );
}
