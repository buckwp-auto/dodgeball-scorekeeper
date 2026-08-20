import { DeflectionResult, ThrowResult } from './statistics/constants';

export function isDeprecatedFailedThrowResult(resultId: number): boolean {
  return (
    resultId === ThrowResult.BlockFailed || resultId === ThrowResult.CatchFailed
  );
}

export function isDeprecatedFailedDeflectionResult(resultId: number): boolean {
  return (
    resultId === DeflectionResult.BlockFailed ||
    resultId === DeflectionResult.CatchFailed
  );
}

export function isDisarmThrowResult(resultId: number): boolean {
  return resultId === ThrowResult.Disarm;
}

export function isDisarmDeflectionResult(resultId: number): boolean {
  return resultId === DeflectionResult.Disarm;
}

/** Incoming contact counted against elusiveness (Hit, Disarm, deprecated failed block). */
export function isIncomingEluHitThrowResult(resultId: ThrowResult): boolean {
  return (
    resultId === ThrowResult.Hit ||
    resultId === ThrowResult.Disarm ||
    resultId === ThrowResult.BlockFailed
  );
}

export function isIncomingEluHitDeflectionResult(resultId: DeflectionResult): boolean {
  return (
    resultId === DeflectionResult.Hit ||
    resultId === DeflectionResult.Disarm ||
    resultId === DeflectionResult.BlockFailed
  );
}

/** Throw or deflection that counts as a connecting hit on charts / heatmaps. */
export function isConnectingHitThrowResult(resultId: number): boolean {
  return (
    resultId === ThrowResult.Hit ||
    resultId === ThrowResult.Disarm ||
    isDeprecatedFailedThrowResult(resultId)
  );
}

export function isConnectingHitDeflectionResult(resultId: number): boolean {
  return (
    resultId === DeflectionResult.Hit ||
    resultId === DeflectionResult.Disarm ||
    isDeprecatedFailedDeflectionResult(resultId)
  );
}

export function displayThrowResultLabel(resultId: ThrowResult): string {
  if (isDeprecatedFailedThrowResult(resultId)) return 'Hit';
  switch (resultId) {
    case ThrowResult.Hit:
      return 'Hit';
    case ThrowResult.Block:
      return 'Block';
    case ThrowResult.Catch:
      return 'Catch';
    case ThrowResult.Dodge:
      return 'Dodge';
    case ThrowResult.Miss:
      return 'Miss';
    case ThrowResult.Disarm:
      return 'Disarm';
    default:
      return '?';
  }
}

export function displayDeflectionResultLabel(resultId: DeflectionResult): string {
  if (isDeprecatedFailedDeflectionResult(resultId)) return 'Hit';
  switch (resultId) {
    case DeflectionResult.Hit:
      return 'Hit';
    case DeflectionResult.Block:
      return 'Block';
    case DeflectionResult.Catch:
      return 'Catch';
    case DeflectionResult.Disarm:
      return 'Disarm';
    default:
      return '?';
  }
}
