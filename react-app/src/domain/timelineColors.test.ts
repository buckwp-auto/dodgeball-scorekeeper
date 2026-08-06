import { describe, expect, it } from 'vitest';
import { DeflectionResult, ThrowResult } from './statistics/constants';
import {
  playerColorVars,
  playerHue,
  playerPillStyles,
  rowBackgroundForTone,
  TEAM_HUES,
  teamHeaderStyles,
  teamHue,
  toneForDeflectionResult,
  toneForThrowResult,
} from './timelineColors';

describe('timelineColors', () => {
  it('maps throw results to row tones', () => {
    expect(toneForThrowResult(ThrowResult.Hit)).toBe('hit');
    expect(toneForThrowResult(ThrowResult.BlockFailed)).toBe('hit');
    expect(toneForThrowResult(ThrowResult.CatchFailed)).toBe('hit');
    expect(toneForThrowResult(ThrowResult.Catch)).toBe('catch');
    expect(toneForThrowResult(ThrowResult.Dodge)).toBe('dodge');
    expect(toneForThrowResult(ThrowResult.Block)).toBe('block');
    expect(toneForThrowResult(ThrowResult.Miss)).toBe('miss');
  });

  it('maps deflection results to row tones', () => {
    expect(toneForDeflectionResult(DeflectionResult.Block)).toBe('block');
    expect(toneForDeflectionResult(DeflectionResult.Catch)).toBe('catch');
    expect(toneForDeflectionResult(DeflectionResult.Hit)).toBe('hit');
  });

  it('keeps team hues outside result colors and varies players by lighten/darken', () => {
    expect(TEAM_HUES.home).toBe(275);
    expect(TEAM_HUES.away).toBe(28);
    expect(teamHue(true)).toBe(275);
    expect(teamHeaderStyles(true).backgroundColor).toContain('275');

    const a = playerPillStyles(true, 'player-a');
    const b = playerPillStyles(true, 'player-b');
    expect(a.backgroundColor).not.toBe(b.backgroundColor);

    const varsA = playerColorVars('player-a');
    expect(Math.abs(varsA.hueOffset)).toBeLessThanOrEqual(8);
    expect([-8, -4, 0, 4, 8]).toContain(varsA.lightnessDelta);
    expect(playerHue(true, 'player-a')).toBe(275 + varsA.hueOffset);

    // Lightness should actually move for at least some ids in a small sample.
    const deltas = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map(
      (id) => playerColorVars(id).lightnessDelta,
    );
    expect(new Set(deltas).size).toBeGreaterThan(1);

    // Text stays on the high-contrast end of the surface (not drifting with fill).
    expect(playerPillStyles(true, 'player-a', 'light').color).toMatch(/% 24%\)$/);
    expect(playerPillStyles(true, 'player-a', 'dark').color).toMatch(/% 94%\)$/);
  });

  it('uses stronger red for hits than for dodges', () => {
    const hit = rowBackgroundForTone('hit', false);
    const dodge = rowBackgroundForTone('dodge', false);
    expect(hit).toMatch(/hsl\(0 58%/);
    expect(dodge).toMatch(/hsl\(48 32%/);
  });
});
