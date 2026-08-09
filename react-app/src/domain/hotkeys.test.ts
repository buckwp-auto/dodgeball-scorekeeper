import { describe, expect, it } from 'vitest';
import {
  COLUMN_1_HOTKEYS,
  COLUMN_2_HOTKEYS,
  RECOVERED_NONE_HOTKEY,
  RESULT_HOTKEYS,
  assignColumn1Hotkey,
  assignColumn2Hotkey,
  buildPermanentPlayerHotkeys,
  findGamePlayerIdByHotkey,
  getDeflectionResultForKey,
  getThrowResultForKey,
  getTrackGameActionForKey,
  hotkeyForDeflectionResult,
  hotkeyForGamePlayer,
} from './hotkeys';
import { DeflectionResult, ThrowResult } from './statistics/constants';
import { throwResultUiOrder } from './gameEvents';

describe('permanent player hotkeys', () => {
  it('maps home slots to asdfwe and away to jkl;io', () => {
    expect(COLUMN_1_HOTKEYS).toEqual(['a', 's', 'd', 'f', 'w', 'e']);
    expect(COLUMN_2_HOTKEYS).toEqual(['j', 'k', 'l', ';', 'i', 'o']);
    expect(assignColumn1Hotkey(0)).toBe('a');
    expect(assignColumn2Hotkey(3)).toBe(';');
  });

  it('keeps the same key for a player after display order changes', () => {
    const players = [
      { gamePlayerId: 'h-bob', playerName: 'Bob', teamHome: true },
      { gamePlayerId: 'h-amy', playerName: 'Amy', teamHome: true },
      { gamePlayerId: 'a-zoe', playerName: 'Zoe', teamHome: false },
      { gamePlayerId: 'a-ned', playerName: 'Ned', teamHome: false },
    ];
    const map = buildPermanentPlayerHotkeys(players);
    // Stable alpha order within side: Amy=a, Bob=s; Ned=j, Zoe=k
    expect(hotkeyForGamePlayer(map, 'h-amy')).toBe('a');
    expect(hotkeyForGamePlayer(map, 'h-bob')).toBe('s');
    expect(hotkeyForGamePlayer(map, 'a-ned')).toBe('j');
    expect(hotkeyForGamePlayer(map, 'a-zoe')).toBe('k');

    // Same map after "elimination sort" would put Bob first in UI — keys unchanged
    expect(findGamePlayerIdByHotkey(map, 's')).toBe('h-bob');
    expect(findGamePlayerIdByHotkey(map, 'a')).toBe('h-amy');
  });
});

describe('result hotkeys', () => {
  it('maps rtyughp to throw results in UI order', () => {
    expect(RESULT_HOTKEYS).toEqual(['r', 't', 'y', 'u', 'g', 'h', 'p']);
    expect(RESULT_HOTKEYS).toHaveLength(throwResultUiOrder.length);
    expect(getThrowResultForKey('r')).toBe(ThrowResult.Hit);
    expect(getThrowResultForKey('t')).toBe(ThrowResult.Dodge);
    expect(getThrowResultForKey('p')).toBe(ThrowResult.Miss);
  });

  it('maps r y u g h to deflection results and skips dodge/miss', () => {
    expect(getDeflectionResultForKey('r')).toBe(DeflectionResult.Hit);
    expect(getDeflectionResultForKey('y')).toBe(DeflectionResult.Block);
    expect(getDeflectionResultForKey('u')).toBe(DeflectionResult.BlockFailed);
    expect(getDeflectionResultForKey('g')).toBe(DeflectionResult.Catch);
    expect(getDeflectionResultForKey('h')).toBe(DeflectionResult.CatchFailed);
    expect(getDeflectionResultForKey('t')).toBeNull();
    expect(getDeflectionResultForKey('p')).toBeNull();
    expect(hotkeyForDeflectionResult(DeflectionResult.Hit)).toBe('r');
    expect(hotkeyForDeflectionResult(DeflectionResult.Block)).toBe('y');
  });
});

describe('recovered none hotkey', () => {
  it('uses m for None recovery', () => {
    expect(RECOVERED_NONE_HOTKEY).toBe('m');
  });
});

describe('undo / redo hotkeys', () => {
  it('maps - and + to undo and redo', () => {
    expect(getTrackGameActionForKey('-')).toBe('undo');
    expect(getTrackGameActionForKey('+')).toBe('redo');
    expect(getTrackGameActionForKey('Add')).toBe('redo');
    expect(getTrackGameActionForKey('Subtract')).toBe('undo');
  });
});
