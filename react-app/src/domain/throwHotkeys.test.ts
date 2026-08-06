import { describe, expect, it } from 'vitest';
import { applyPlayerHotkeyToThrowDrafts } from '../components/trackGame/ThrowEditor';
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
    const eliminated = new Set(['h-bob']);

    // Amy is permanently A (name order), Bob is S — even though Bob sorts below after elim
    const withAmy = applyPlayerHotkeyToThrowDrafts(drafts, players, 'a', eliminated);
    expect(withAmy?.[0].throwerGamePlayerId).toBe('h-amy');

    // Bob's key S is ignored while eliminated
    expect(applyPlayerHotkeyToThrowDrafts(drafts, players, 's', eliminated)).toBeNull();
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
    const eliminated = new Set(['a-zoe']);

    const none = applyPlayerHotkeyToThrowDrafts(
      drafts,
      players,
      RECOVERED_NONE_HOTKEY,
      eliminated,
    );
    expect(none?.[0].recoveredId).toBeNull();

    const recoverOut = applyPlayerHotkeyToThrowDrafts(drafts, players, 'k', eliminated);
    // Zoe is permanently K (Ned=j, Zoe=k) and selectable for recovery while out
    expect(recoverOut?.[0].recoveredId).toBe('a-zoe');
  });
});
