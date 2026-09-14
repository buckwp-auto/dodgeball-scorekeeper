import { describe, expect, it } from 'vitest';
import { DeflectionResult, ThrowResult } from './statistics/constants';
import {
  displayDeflectionResultLabel,
  displayThrowResultLabel,
  isConnectingHitDeflectionResult,
  isConnectingHitThrowResult,
  isIncomingEluHitDeflectionResult,
  isIncomingEluHitThrowResult,
} from './throwResults';

describe('throwResults helpers', () => {
  it('maps deprecated failed results to Hit labels', () => {
    expect(displayThrowResultLabel(ThrowResult.BlockFailed)).toBe('Hit');
    expect(displayThrowResultLabel(ThrowResult.CatchFailed)).toBe('Hit');
    expect(displayDeflectionResultLabel(DeflectionResult.BlockFailed)).toBe('Hit');
  });

  it('treats Disarm as a connecting hit', () => {
    expect(isConnectingHitThrowResult(ThrowResult.Disarm)).toBe(true);
    expect(isIncomingEluHitThrowResult(ThrowResult.Disarm)).toBe(true);
    expect(displayThrowResultLabel(ThrowResult.Disarm)).toBe('Disarm');
  });

  it('treats continuation Dodge as targeted but not an elu hit', () => {
    expect(displayDeflectionResultLabel(DeflectionResult.Dodge)).toBe('Dodge');
    expect(isIncomingEluHitDeflectionResult(DeflectionResult.Dodge)).toBe(false);
    expect(isConnectingHitDeflectionResult(DeflectionResult.Dodge)).toBe(false);
  });
});
