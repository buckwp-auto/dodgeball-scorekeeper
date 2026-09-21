import { describe, expect, it } from 'vitest';
import { ThrowResult } from './statistics/constants';
import {
  ThrowTag,
  normalizeThrowTags,
  throwTagsForPersist,
  toggleThrowTag,
} from './throwTags';

describe('normalizeThrowTags', () => {
  it('keeps only known vocabulary, dedupes, and caps count', () => {
    expect(
      normalizeThrowTags(
        [
          'CounterRush',
          'CounterRush',
          'unknown',
          'InvalidHigh',
          'InvalidGrounded',
          'InvalidCounter',
          'Headshot',
          'FailedDodge',
          'extra',
        ],
        ThrowResult.Hit,
      ),
    ).toEqual([
      ThrowTag.CounterRush,
      ThrowTag.InvalidHigh,
      ThrowTag.InvalidGrounded,
      ThrowTag.InvalidCounter,
      ThrowTag.Headshot,
      ThrowTag.FailedDodge,
    ]);
  });

  it('drops contact and defensive-failure tags when result is not a kill', () => {
    expect(
      normalizeThrowTags(
        [ThrowTag.CounterRegular, ThrowTag.Headshot, ThrowTag.FailedDodge, ThrowTag.InvalidHigh],
        ThrowResult.Miss,
      ),
    ).toEqual([ThrowTag.CounterRegular, ThrowTag.InvalidHigh]);
  });

  it('keeps at most one counter and one defensive-failure tag', () => {
    expect(
      normalizeThrowTags(
        [ThrowTag.CounterRush, ThrowTag.CounterWave, ThrowTag.FailedBlock, ThrowTag.FailedCatch],
        ThrowResult.Hit,
      ),
    ).toEqual([ThrowTag.CounterRush, ThrowTag.FailedBlock]);
  });

  it('returns empty for non-arrays', () => {
    expect(normalizeThrowTags(null, ThrowResult.Hit)).toEqual([]);
    expect(normalizeThrowTags('Headshot', ThrowResult.Hit)).toEqual([]);
  });
});

describe('toggleThrowTag', () => {
  it('replaces another counter when selecting a new one', () => {
    expect(
      toggleThrowTag([ThrowTag.CounterRush], ThrowTag.CounterWave, ThrowResult.Hit),
    ).toEqual([ThrowTag.CounterWave]);
  });

  it('clears a tag when toggled off', () => {
    expect(
      toggleThrowTag([ThrowTag.InvalidHigh], ThrowTag.InvalidHigh, ThrowResult.Miss),
    ).toEqual([]);
  });

  it('ignores headshot on non-kill results', () => {
    expect(toggleThrowTag([], ThrowTag.Headshot, ThrowResult.Dodge)).toEqual([]);
  });
});

describe('throwTagsForPersist', () => {
  it('omits empty tag lists', () => {
    expect(throwTagsForPersist([], ThrowResult.Hit)).toBeUndefined();
    expect(throwTagsForPersist(undefined, ThrowResult.Hit)).toBeUndefined();
  });

  it('returns normalized tags when present', () => {
    expect(
      throwTagsForPersist([ThrowTag.CounterRush, 'nope'], ThrowResult.Hit),
    ).toEqual([ThrowTag.CounterRush]);
  });
});
