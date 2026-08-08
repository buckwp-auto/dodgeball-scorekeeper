import { describe, expect, it } from 'vitest';
import { DeflectionResult, EKillType, ThrowResult } from './constants';
import type { ThrowDetail } from './databaseViews';
import { awardThrowEventCredit } from './statCreditEngine';
import { LEGACY_POLICY, STAT_CREDIT_PRESETS, type StatCreditPolicy } from './statCreditPolicy';

function detail(options: {
  throwerId: string;
  targetId: string;
  resultId: number;
  ordinal?: number;
  deflections?: { receiverId: string; resultId: number }[];
}): ThrowDetail {
  return {
    throwRow: {
      Id: `throw-${options.throwerId}-${options.ordinal ?? 1}`,
      GameEventThrowId: 'event-1',
      Ordinal: options.ordinal ?? 1,
      ThrowerId: options.throwerId,
      TargetId: options.targetId,
      ResultId: options.resultId,
    },
    deflections: (options.deflections ?? []).map((row, index) => ({
      Id: `defl-${options.throwerId}-${index}`,
      ThrowId: `throw-${options.throwerId}-${options.ordinal ?? 1}`,
      Ordinal: index + 1,
      ReceiverId: row.receiverId,
      ResultId: row.resultId,
    })),
  };
}

function sumCredit(awards: ReturnType<typeof awardThrowEventCredit>, throwerId: string) {
  return awards.throwerKills
    .filter((row) => row.throwerId === throwerId)
    .reduce((sum, row) => sum + row.credit, 0);
}

function integerKills(awards: ReturnType<typeof awardThrowEventCredit>, throwerId: string) {
  return awards.throwerKills
    .filter((row) => row.throwerId === throwerId)
    .reduce((sum, row) => sum + row.integer, 0);
}

function integerDeaths(awards: ReturnType<typeof awardThrowEventCredit>, targetId: string) {
  return awards.targetDeaths
    .filter((row) => row.targetId === targetId)
    .reduce((sum, row) => sum + row.integer, 0);
}

describe('awardThrowEventCredit', () => {
  it('legacy team throw on the same target double-counts deaths and splits 1/N credit', () => {
    const awards = awardThrowEventCredit(
      [
        detail({ throwerId: 'a', targetId: 'x', resultId: ThrowResult.Hit, ordinal: 1 }),
        detail({ throwerId: 'b', targetId: 'x', resultId: ThrowResult.Hit, ordinal: 2 }),
      ],
      LEGACY_POLICY,
    );

    expect(integerKills(awards, 'a')).toBe(1);
    expect(integerKills(awards, 'b')).toBe(1);
    expect(sumCredit(awards, 'a')).toBeCloseTo(0.5);
    expect(sumCredit(awards, 'b')).toBeCloseTo(0.5);
    expect(integerDeaths(awards, 'x')).toBe(2);
    expect(awards.supportCredits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ throwerId: 'b', credit: 0.5, killType: EKillType.Hit }),
        expect.objectContaining({ throwerId: 'a', credit: 0.5, killType: EKillType.Hit }),
      ]),
    );
    expect(awards.assists).toHaveLength(0);
  });

  it('shared credit dedupes the same target and splits among hitters', () => {
    const awards = awardThrowEventCredit(
      [
        detail({ throwerId: 'a', targetId: 'x', resultId: ThrowResult.Hit, ordinal: 1 }),
        detail({ throwerId: 'b', targetId: 'x', resultId: ThrowResult.Hit, ordinal: 2 }),
      ],
      STAT_CREDIT_PRESETS.sharedCredit,
    );

    expect(integerKills(awards, 'a')).toBe(1);
    expect(integerKills(awards, 'b')).toBe(1);
    expect(sumCredit(awards, 'a')).toBeCloseTo(0.5);
    expect(sumCredit(awards, 'b')).toBeCloseTo(0.5);
    expect(integerDeaths(awards, 'x')).toBe(1);
    expect(awards.supportCredits).toHaveLength(0);
    expect(awards.assists).toHaveLength(0);
  });

  it('different targets in a team throw stay independent full kills', () => {
    const awards = awardThrowEventCredit(
      [
        detail({ throwerId: 'a', targetId: 'x', resultId: ThrowResult.Hit, ordinal: 1 }),
        detail({ throwerId: 'b', targetId: 'y', resultId: ThrowResult.Hit, ordinal: 2 }),
      ],
      STAT_CREDIT_PRESETS.sharedCredit,
    );

    expect(sumCredit(awards, 'a')).toBeCloseTo(1);
    expect(sumCredit(awards, 'b')).toBeCloseTo(1);
    expect(integerDeaths(awards, 'x')).toBe(1);
    expect(integerDeaths(awards, 'y')).toBe(1);
  });

  it('awards a team-throw assist to a non-hitting thrower', () => {
    const awards = awardThrowEventCredit(
      [
        detail({ throwerId: 'a', targetId: 'x', resultId: ThrowResult.Hit, ordinal: 1 }),
        detail({ throwerId: 'b', targetId: 'x', resultId: ThrowResult.Miss, ordinal: 2 }),
      ],
      STAT_CREDIT_PRESETS.sharedCredit,
    );

    expect(integerKills(awards, 'a')).toBe(1);
    expect(sumCredit(awards, 'a')).toBeCloseTo(1);
    expect(integerKills(awards, 'b')).toBe(0);
    expect(awards.assists).toEqual(['b']);
  });

  it('firstWeighted gives the first ordinal the configured share', () => {
    const policy: StatCreditPolicy = {
      ...STAT_CREDIT_PRESETS.firstHitter,
      teamThrowFirstHitPercent: 60,
    };
    const awards = awardThrowEventCredit(
      [
        detail({ throwerId: 'a', targetId: 'x', resultId: ThrowResult.Hit, ordinal: 1 }),
        detail({ throwerId: 'b', targetId: 'x', resultId: ThrowResult.Hit, ordinal: 2 }),
      ],
      policy,
    );

    expect(sumCredit(awards, 'a')).toBeCloseTo(0.6);
    expect(sumCredit(awards, 'b')).toBeCloseTo(0.4);
    expect(integerDeaths(awards, 'x')).toBe(1);
  });

  it('firstWeighted solo hitter still gets full credit', () => {
    const awards = awardThrowEventCredit(
      [detail({ throwerId: 'a', targetId: 'x', resultId: ThrowResult.Hit })],
      STAT_CREDIT_PRESETS.firstHitter,
    );
    expect(sumCredit(awards, 'a')).toBeCloseTo(1);
  });

  it('fullEach gives every hitter 1.0 with one death', () => {
    const awards = awardThrowEventCredit(
      [
        detail({ throwerId: 'a', targetId: 'x', resultId: ThrowResult.Hit, ordinal: 1 }),
        detail({ throwerId: 'b', targetId: 'x', resultId: ThrowResult.Hit, ordinal: 2 }),
      ],
      STAT_CREDIT_PRESETS.fullEach,
    );
    expect(sumCredit(awards, 'a')).toBeCloseTo(1);
    expect(sumCredit(awards, 'b')).toBeCloseTo(1);
    expect(integerDeaths(awards, 'x')).toBe(1);
  });

  it('applies deflection kill weight on deflection outs', () => {
    const awards = awardThrowEventCredit(
      [
        detail({
          throwerId: 'a',
          targetId: 'x',
          resultId: ThrowResult.Block,
          deflections: [{ receiverId: 'y', resultId: DeflectionResult.Hit }],
        }),
      ],
      STAT_CREDIT_PRESETS.sharedCredit,
    );

    expect(integerKills(awards, 'a')).toBe(1);
    expect(sumCredit(awards, 'a')).toBeCloseTo(0.5);
    expect(integerDeaths(awards, 'y')).toBe(1);
    expect(awards.throwerKills[0]?.source).toBe('deflection');
  });

  it('scales catch-thrown death credit for deflection catches', () => {
    const awards = awardThrowEventCredit(
      [
        detail({
          throwerId: 'a',
          targetId: 'x',
          resultId: ThrowResult.Hit,
          deflections: [{ receiverId: 'y', resultId: DeflectionResult.Catch }],
        }),
      ],
      STAT_CREDIT_PRESETS.sharedCredit,
    );

    expect(awards.throwerKills).toHaveLength(0);
    expect(awards.catchThrownDeaths).toEqual([
      expect.objectContaining({
        throwerId: 'a',
        source: 'deflection',
        integer: 1,
        credit: 0.5,
      }),
    ]);
    expect(awards.catches).toEqual([{ catcherId: 'y', source: 'deflection' }]);
  });

  it('tracks a double kill when a throw and deflection both eliminate', () => {
    const awards = awardThrowEventCredit(
      [
        detail({
          throwerId: 'a',
          targetId: 'x',
          resultId: ThrowResult.Hit,
          deflections: [{ receiverId: 'y', resultId: DeflectionResult.Hit }],
        }),
      ],
      STAT_CREDIT_PRESETS.fullEach,
    );

    expect(integerKills(awards, 'a')).toBe(2);
    expect(awards.multiKills).toEqual([{ throwerId: 'a', size: 2 }]);
  });

  it('tracks a multi-catch when one defender catches two team-throw balls', () => {
    const awards = awardThrowEventCredit(
      [
        detail({ throwerId: 'a', targetId: 'x', resultId: ThrowResult.Catch, ordinal: 1 }),
        detail({ throwerId: 'b', targetId: 'x', resultId: ThrowResult.Catch, ordinal: 2 }),
      ],
      STAT_CREDIT_PRESETS.sharedCredit,
    );

    expect(awards.catches).toHaveLength(2);
    expect(awards.multiCatches).toEqual([{ catcherId: 'x', size: 2 }]);
    expect(awards.catchThrownDeaths).toHaveLength(2);
  });

  it('catch on a throw suppresses that throw’s kills', () => {
    const awards = awardThrowEventCredit(
      [
        detail({
          throwerId: 'a',
          targetId: 'x',
          resultId: ThrowResult.Hit,
          deflections: [{ receiverId: 'y', resultId: DeflectionResult.Catch }],
        }),
      ],
      LEGACY_POLICY,
    );

    expect(awards.throwerKills).toHaveLength(0);
    expect(awards.targetDeaths).toHaveLength(0);
    expect(awards.catchThrownDeaths[0]?.source).toBe('deflection');
  });
});
