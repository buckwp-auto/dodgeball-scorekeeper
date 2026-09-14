import { describe, expect, it } from 'vitest';
import {
  addDeflectionToDrafts,
  applyPlayerHotkeyToThrowDrafts,
  focusedDeflectionIndex,
  resolveGroupThrowingHome,
} from '../components/trackGame/ThrowEditor';
import type { GamePlayerInfo, ThrowDraft } from './gameEvents';
import { emptyThrowDraft, nextDeflectionsAfterResult, throwDraftAllowsMoreDeflections } from './gameEvents';
import { DeflectionResult, ThrowResult } from './statistics/constants';
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

  it('focuses a pending continuation and routes receiver plus result keys there', () => {
    const drafts: ThrowDraft[] = [
      {
        ...emptyThrowDraft(),
        throwerGamePlayerId: 'h-amy',
        targetGamePlayerId: 'a-ned',
        resultId: ThrowResult.Hit,
      },
    ];
    const opened = addDeflectionToDrafts(drafts);
    expect(focusedDeflectionIndex(opened[0])).toBe(0);
    expect(opened[0].deflections).toEqual([
      { receiverGamePlayerId: '', resultId: DeflectionResult.Hit },
    ]);

    // Defending Zoe (K) becomes the receiver; thrower/target stay put
    const withReceiver = applyPlayerHotkeyToThrowDrafts(opened, players, 'k');
    expect(withReceiver?.[0].deflections[0].receiverGamePlayerId).toBe('a-zoe');
    expect(withReceiver?.[0].throwerGamePlayerId).toBe('h-amy');
    expect(withReceiver?.[0].targetGamePlayerId).toBe('a-ned');

    // Y is Block on the continuation, not on the throw
    const withBlock = applyPlayerHotkeyToThrowDrafts(opened, players, 'y');
    expect(withBlock?.[0].deflections[0].resultId).toBe(DeflectionResult.Block);
    expect(withBlock?.[0].resultId).toBe(ThrowResult.Hit);

    // T sets Dodge on the focused continuation
    const dodgeContinuation = applyPlayerHotkeyToThrowDrafts(opened, players, 't');
    expect(dodgeContinuation?.[0].resultId).toBe(ThrowResult.Hit);
    expect(dodgeContinuation?.[0].deflections[0].resultId).toBe(DeflectionResult.Dodge);
  });

  it('allows continuations after Dodge or Miss and keeps Miss on the throw', () => {
    const dodgePrimary: ThrowDraft[] = [
      {
        ...emptyThrowDraft(),
        throwerGamePlayerId: 'h-amy',
        targetGamePlayerId: 'a-ned',
        resultId: ThrowResult.Dodge,
      },
    ];
    const opened = addDeflectionToDrafts(dodgePrimary);
    expect(opened[0].deflections).toHaveLength(1);

    const hitWithContinuation: ThrowDraft[] = [
      {
        ...emptyThrowDraft(),
        throwerGamePlayerId: 'h-amy',
        targetGamePlayerId: 'a-ned',
        resultId: ThrowResult.Hit,
        deflections: [
          { receiverGamePlayerId: 'a-zoe', resultId: DeflectionResult.Dodge },
        ],
      },
    ];
    // H is Miss on the throw (not a continuation result) and keeps the chain
    const missKey = applyPlayerHotkeyToThrowDrafts(hitWithContinuation, players, 'h');
    expect(missKey?.[0].resultId).toBe(ThrowResult.Miss);
    expect(missKey?.[0].deflections).toEqual([
      { receiverGamePlayerId: 'a-zoe', resultId: DeflectionResult.Dodge },
    ]);
  });

  it('does not allow continuations after Catch', () => {
    const drafts: ThrowDraft[] = [
      {
        ...emptyThrowDraft(),
        throwerGamePlayerId: 'h-amy',
        targetGamePlayerId: 'a-ned',
        resultId: ThrowResult.Catch,
        recoveredId: null,
      },
    ];
    expect(addDeflectionToDrafts(drafts)[0].deflections).toEqual([]);
  });

  it('refuses another continuation after a continuation Catch', () => {
    const drafts: ThrowDraft[] = [
      {
        ...emptyThrowDraft(),
        throwerGamePlayerId: 'h-amy',
        targetGamePlayerId: 'a-ned',
        resultId: ThrowResult.Dodge,
        deflections: [
          { receiverGamePlayerId: 'a-zoe', resultId: DeflectionResult.Catch },
        ],
        recoveredId: null,
      },
    ];
    expect(addDeflectionToDrafts(drafts)[0].deflections).toHaveLength(1);
    expect(throwDraftAllowsMoreDeflections(drafts[0])).toBe(false);
  });

  it('truncates later continuations when Catch is set mid-chain', () => {
    const next = nextDeflectionsAfterResult(
      [
        { receiverGamePlayerId: 'a-zoe', resultId: DeflectionResult.Block },
        { receiverGamePlayerId: 'a-ned', resultId: DeflectionResult.Hit },
      ],
      0,
      DeflectionResult.Catch,
    );
    expect(next).toEqual([
      { receiverGamePlayerId: 'a-zoe', resultId: DeflectionResult.Catch },
    ]);
  });

  it('keeps result keys on the last deflection after a receiver is chosen', () => {
    const drafts: ThrowDraft[] = [
      {
        ...emptyThrowDraft(),
        throwerGamePlayerId: 'h-amy',
        targetGamePlayerId: 'a-ned',
        resultId: ThrowResult.Hit,
        deflections: [
          { receiverGamePlayerId: 'a-zoe', resultId: DeflectionResult.Hit },
        ],
      },
    ];
    expect(focusedDeflectionIndex(drafts[0])).toBe(0);

    const catchDeflect = applyPlayerHotkeyToThrowDrafts(drafts, players, 'g');
    expect(catchDeflect?.[0].deflections[0].resultId).toBe(DeflectionResult.Catch);
    expect(catchDeflect?.[0].resultId).toBe(ThrowResult.Hit);
    // No one is out yet → Recovered defaults to None
    expect(catchDeflect?.[0].recoveredId).toBeNull();

    // Defending Ned (J) goes back to toggling the throw target
    const retarget = applyPlayerHotkeyToThrowDrafts(drafts, players, 'j');
    expect(retarget?.[0].targetGamePlayerId).toBe('');
    expect(retarget?.[0].deflections[0].receiverGamePlayerId).toBe('a-zoe');
  });

  it('defaults Recovered to the defending team first-out on Catch', () => {
    const drafts: ThrowDraft[] = [
      {
        ...emptyThrowDraft(),
        throwerGamePlayerId: 'h-amy',
        targetGamePlayerId: 'a-ned',
        resultId: ThrowResult.Hit,
      },
    ];
    const live = {
      eliminatedGamePlayerIds: new Set(['a-zoe']),
      eliminationOrder: new Map([['a-zoe', 1]]),
    };
    const withCatch = applyPlayerHotkeyToThrowDrafts(drafts, players, 'g', live);
    expect(withCatch?.[0].resultId).toBe(ThrowResult.Catch);
    expect(withCatch?.[0].recoveredId).toBe('a-zoe');
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
