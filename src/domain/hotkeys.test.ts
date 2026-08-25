import { describe, expect, it } from 'vitest';
import {
  COLUMN_1_HOTKEYS,
  COLUMN_2_HOTKEYS,
  OTHER_OFFENSE_HOTKEYS,
  RECOVERED_NONE_HOTKEY,
  RESULT_HOTKEYS,
  ROSTER_AWAY_HOTKEYS,
  ROSTER_AWAY_OVERFLOW_HOTKEYS,
  ROSTER_HOME_HOTKEYS,
  ROSTER_HOME_OVERFLOW_HOTKEYS,
  applyOtherOffenseHotkey,
  assignColumn1Hotkey,
  assignColumn2Hotkey,
  buildPermanentPlayerHotkeys,
  buildPermanentRosterHotkeys,
  findGamePlayerIdByHotkey,
  findPlayerByHotkey,
  getDeflectionResultForKey,
  getOtherOffenseChoiceForKey,
  getThrowResultForKey,
  getTrackGameActionForKey,
  hotkeyForDeflectionResult,
  hotkeysForTrackGameAction,
  hotkeyForGamePlayer,
  hotkeyForOtherOffenseIndex,
  isOtherOffenseChoiceActive,
  otherOffenseUiOrder,
} from './hotkeys';
import { DeflectionResult, GameEventErrorOffense, ThrowResult } from './statistics/constants';
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

describe('match / game roster hotkeys', () => {
  it('uses Track Game keys then overflow keys up to 12 per side', () => {
    expect(ROSTER_HOME_OVERFLOW_HOTKEYS).toEqual(['q', '1', '2', '3', '4', '5']);
    expect(ROSTER_AWAY_OVERFLOW_HOTKEYS).toEqual(['p', '0', '9', '8', '7', '6']);
    expect([...ROSTER_HOME_HOTKEYS]).toEqual([
      'a',
      's',
      'd',
      'f',
      'w',
      'e',
      'q',
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    expect([...ROSTER_AWAY_HOTKEYS]).toEqual([
      'j',
      'k',
      'l',
      ';',
      'i',
      'o',
      'p',
      '0',
      '9',
      '8',
      '7',
      '6',
    ]);
  });

  it('assigns the first six like Track Game and overflow keys after that', () => {
    const home = ['Amy', 'Bob', 'Cara', 'Dee', 'Eve', 'Fay', 'Gia', 'Hana'].map(
      (Name, index) => ({ Id: `h-${index}`, Name }),
    );
    const away = ['Ned', 'Zoe'].map((Name, index) => ({ Id: `a-${index}`, Name }));
    const map = buildPermanentRosterHotkeys(home, away);
    expect(map.get('h-0')).toBe('a');
    expect(map.get('h-1')).toBe('s');
    expect(map.get('h-5')).toBe('e');
    expect(map.get('h-6')).toBe('q');
    expect(map.get('h-7')).toBe('1');
    expect(map.get('a-0')).toBe('j');
    expect(map.get('a-1')).toBe('k');

    expect(findPlayerByHotkey(home, away, 'q', map)?.player.Id).toBe('h-6');
    expect(findPlayerByHotkey(home, away, '1', map)?.player.Id).toBe('h-7');
    expect(findPlayerByHotkey(home, away, 'a', map)?.player.Id).toBe('h-0');
  });

  it('reassigns keys when visual order changes (subs last)', () => {
    const amy = { Id: 'h-amy', Name: 'Amy' };
    const pat = { Id: 'h-pat', Name: 'Pat' };
    const zoe = { Id: 'h-zoe', Name: 'Zoe' };
    const startersThenSubs = buildPermanentRosterHotkeys([amy, zoe, pat], []);
    expect(startersThenSubs.get('h-amy')).toBe('a');
    expect(startersThenSubs.get('h-zoe')).toBe('s');
    expect(startersThenSubs.get('h-pat')).toBe('d');

    const afterAmyBecomesSub = buildPermanentRosterHotkeys([zoe, amy, pat], []);
    expect(afterAmyBecomesSub.get('h-zoe')).toBe('a');
    expect(afterAmyBecomesSub.get('h-amy')).toBe('s');
    expect(afterAmyBecomesSub.get('h-pat')).toBe('d');
  });
});

describe('result hotkeys', () => {
  it('maps rtyugh to throw results in UI order', () => {
    expect(RESULT_HOTKEYS).toEqual(['r', 't', 'y', 'u', 'g', 'h']);
    expect(RESULT_HOTKEYS).toHaveLength(throwResultUiOrder.length);
    expect(getThrowResultForKey('r')).toBe(ThrowResult.Hit);
    expect(getThrowResultForKey('t')).toBe(ThrowResult.Dodge);
    expect(getThrowResultForKey('u')).toBe(ThrowResult.Disarm);
    expect(getThrowResultForKey('h')).toBe(ThrowResult.Miss);
  });

  it('maps r y u g to deflection results and skips dodge/miss', () => {
    expect(getDeflectionResultForKey('r')).toBe(DeflectionResult.Hit);
    expect(getDeflectionResultForKey('y')).toBe(DeflectionResult.Block);
    expect(getDeflectionResultForKey('u')).toBe(DeflectionResult.Disarm);
    expect(getDeflectionResultForKey('g')).toBe(DeflectionResult.Catch);
    expect(getDeflectionResultForKey('h')).toBeNull();
    expect(getDeflectionResultForKey('t')).toBeNull();
    expect(hotkeyForDeflectionResult(DeflectionResult.Hit)).toBe('r');
    expect(hotkeyForDeflectionResult(DeflectionResult.Block)).toBe('y');
    expect(hotkeyForDeflectionResult(DeflectionResult.Disarm)).toBe('u');
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

describe('done hotkeys', () => {
  it('maps X and Enter to done', () => {
    expect(getTrackGameActionForKey('x')).toBe('done');
    expect(getTrackGameActionForKey('X')).toBe('done');
    expect(getTrackGameActionForKey('Enter')).toBe('done');
    expect(hotkeysForTrackGameAction('done')).toEqual(['x', 'Enter']);
  });
});

describe('other tab offense hotkeys', () => {
  it('maps 1-4 to fixed offense choices in UI order', () => {
    expect(OTHER_OFFENSE_HOTKEYS).toEqual(['1', '2', '3', '4']);
    expect(otherOffenseUiOrder).toHaveLength(4);
    expect(hotkeyForOtherOffenseIndex(0)).toBe('1');
    const choice2 = getOtherOffenseChoiceForKey('2');
    expect(choice2?.kind).toBe('offense');
    expect(choice2?.kind === 'offense' ? choice2.offenseId : null).toBe(
      GameEventErrorOffense.WastedBall,
    );
    expect(getOtherOffenseChoiceForKey('4')?.kind).toBe('noBlocking');
  });

  it('leaves no digit free for an Other-tab switch key', () => {
    const occupied = new Set<string>([
      ...ROSTER_HOME_OVERFLOW_HOTKEYS,
      ...ROSTER_AWAY_OVERFLOW_HOTKEYS,
      ...OTHER_OFFENSE_HOTKEYS,
    ]);
    for (const digit of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(occupied.has(digit)).toBe(true);
    }
  });

  it('toggles offense choices without shifting hotkey slots', () => {
    const draft = { offenderGamePlayerId: 'gp-1', offenseId: null as GameEventErrorOffense | null };
    const lineOut = otherOffenseUiOrder[0]!;
    const next = applyOtherOffenseHotkey(draft, lineOut);
    expect(next.offenseId).toBe(GameEventErrorOffense.LineOut);
    expect(isOtherOffenseChoiceActive(next, lineOut)).toBe(true);
    expect(isOtherOffenseChoiceActive(next, otherOffenseUiOrder[1]!)).toBe(false);

    const cleared = applyOtherOffenseHotkey(next, lineOut);
    expect(cleared.offenseId).toBeNull();
  });

  it('toggles no-blocking started and clears offender fields', () => {
    const draft = {
      offenderGamePlayerId: 'gp-1',
      offenseId: GameEventErrorOffense.LineOut,
      noBlockingStarted: false,
    };
    const noBlocking = otherOffenseUiOrder[3]!;
    const started = applyOtherOffenseHotkey(draft, noBlocking);
    expect(started).toEqual({
      offenderGamePlayerId: '',
      offenseId: null,
      noBlockingStarted: true,
    });
    const cleared = applyOtherOffenseHotkey(started, noBlocking);
    expect(cleared.noBlockingStarted).toBe(false);
  });
});
