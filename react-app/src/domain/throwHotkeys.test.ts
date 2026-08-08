import { describe, expect, it } from 'vitest';
import {
  applyPlayerHotkeyToThrowDrafts,
  resolveGroupThrowingHome,
} from '../components/trackGame/ThrowEditor';
import type { GamePlayerInfo, ThrowDraft } from './gameEvents';
import { emptyThrowDraft } from './gameEvents';
import { ThrowResult } from './statistics/constants';
import { RECOVERED_NONE_HOTKEY } from './hotkeys';

const players: GamePlayerInfo[] = [
  { gamePlayerId: 'h-bob', playerName: 'Bob', teamHome: true, playerId: 'p-bob' },
  { gamePlayerId: 'h-amy', playerName: 'Amy', teamHome: true, playerId: 'p-amy' },
  { gamePlayerId: 'a-zoe', playerName: 'Zoe', teamHome: false, playerId: 'p-zoe' },
  { gamePlayerId: 'a-ned', playerName: 'Ned', teamHome: false, playerId: 'p-ned' },
];

describe('applyPlayerHotkeyToThrowDrafts permanent keys', () => {
  it('keeps Amy on A after Bob is eliminated (display order changes)', () => {
    const drafts: ThrowDraft[] = [emptyThrowDraft()];

    // Amy is permanently A (name order), Bob is S — even though Bob sorts below after elim
    const withAmy = applyPlayerHotkeyToThrowDrafts(drafts, players, 'a');
    expect(withAmy?.[0].throwerGamePlayerId).toBe('h-amy');

    // An out player can still throw — they may have released the ball as they went out
    const withBob = applyPlayerHotkeyToThrowDrafts(drafts, players, 's');
    expect(withBob?.[0].throwerGamePlayerId).toBe('h-bob');
  });

  it('uses person side not display column after sides switch', () => {
    const drafts: ThrowDraft[] = [
      {
        ...emptyThrowDraft(),
        throwerGamePlayerId: 'a-ned',
        targetGamePlayerId: '',
      },
    ];
    // Away is throwing: Ned's J still toggles thrower; Amy's A sets target
    const clearThrower = applyPlayerHotkeyToThrowDrafts(drafts, players, 'j');
    expect(clearThrower?.[0].throwerGamePlayerId).toBe('');

    const setTarget = applyPlayerHotkeyToThrowDrafts(drafts, players, 'a');
    expect(setTarget?.[0].targetGamePlayerId).toBe('h-amy');
  });

  it('keeps a second group throw on the throwing team', () => {
    const drafts: ThrowDraft[] = [
      {
        ...emptyThrowDraft(),
        throwerGamePlayerId: 'h-amy',
        targetGamePlayerId: 'a-ned',
        resultId: ThrowResult.Hit,
      },
      emptyThrowDraft(),
    ];

    // Away is defending, so Ned's J targets him rather than making him a thrower
    const ned = applyPlayerHotkeyToThrowDrafts(drafts, players, 'j');
    expect(ned?.[1].throwerGamePlayerId).toBe('');
    expect(ned?.[1].targetGamePlayerId).toBe('a-ned');

    // Bob is on the throwing team, so his S makes him the second thrower
    const bob = applyPlayerHotkeyToThrowDrafts(drafts, players, 's');
    expect(bob?.[1].throwerGamePlayerId).toBe('h-bob');
  });

  it('keeps a target that was picked before the thrower', () => {
    const drafts: ThrowDraft[] = [{ ...emptyThrowDraft(), targetGamePlayerId: 'a-ned' }];
    const next = applyPlayerHotkeyToThrowDrafts(drafts, players, 'a');
    expect(next?.[0].throwerGamePlayerId).toBe('h-amy');
    expect(next?.[0].targetGamePlayerId).toBe('a-ned');
  });

  it('assigns None recovery with its hotkey and recovers out players by key', () => {
    const drafts: ThrowDraft[] = [
      {
        ...emptyThrowDraft(),
        throwerGamePlayerId: 'h-amy',
        targetGamePlayerId: 'a-ned',
        resultId: ThrowResult.Catch,
        recoveredId: undefined,
      },
    ];
    const none = applyPlayerHotkeyToThrowDrafts(drafts, players, RECOVERED_NONE_HOTKEY);
    expect(none?.[0].recoveredId).toBeNull();

    const recoverOut = applyPlayerHotkeyToThrowDrafts(drafts, players, 'k');
    // Zoe is permanently K (Ned=j, Zoe=k) and selectable for recovery while out
    expect(recoverOut?.[0].recoveredId).toBe('a-zoe');
  });
});

describe('resolveGroupThrowingHome', () => {
  it('is undecided until the group names a thrower or target', () => {
    expect(resolveGroupThrowingHome([emptyThrowDraft()], players)).toBeNull();
  });

  it('takes the side of the first thrower in the group', () => {
    const drafts: ThrowDraft[] = [
      { ...emptyThrowDraft(), throwerGamePlayerId: 'a-ned' },
      emptyThrowDraft(),
    ];
    expect(resolveGroupThrowingHome(drafts, players)).toBe(false);
  });

  it('infers the throwing side from a target when no thrower is set yet', () => {
    const drafts: ThrowDraft[] = [{ ...emptyThrowDraft(), targetGamePlayerId: 'a-ned' }];
    expect(resolveGroupThrowingHome(drafts, players)).toBe(true);
  });

  it('reads the side from a later draft when the first is empty', () => {
    const drafts: ThrowDraft[] = [
      emptyThrowDraft(),
      { ...emptyThrowDraft(), throwerGamePlayerId: 'h-amy' },
    ];
    expect(resolveGroupThrowingHome(drafts, players)).toBe(true);
  });
});
