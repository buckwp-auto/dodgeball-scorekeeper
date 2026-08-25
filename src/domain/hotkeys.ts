import { GameEventErrorOffense, DeflectionResult, ThrowResult } from './statistics/constants';
import {
  deflectionResultUiOrder,
  errorOffenseLabels,
  NO_BLOCKING_STARTED_LABEL,
  throwResultUiOrder,
} from './gameEvents';

/** Home / left-side permanent keys (Track Game throw/error; roster slots 1–6) */
export const COLUMN_1_HOTKEYS = ['a', 's', 'd', 'f', 'w', 'e'] as const;
/** Away / right-side permanent keys (Track Game throw/error; roster slots 1–6) */
export const COLUMN_2_HOTKEYS = ['j', 'k', 'l', ';', 'i', 'o'] as const;
/** Extra Match/Game roster keys for home slots 7–12 */
export const ROSTER_HOME_OVERFLOW_HOTKEYS = ['q', '1', '2', '3', '4', '5'] as const;
/** Extra Match/Game roster keys for away slots 7–12 */
export const ROSTER_AWAY_OVERFLOW_HOTKEYS = ['p', '0', '9', '8', '7', '6'] as const;
/** Match/Game roster: Track Game keys, then overflow (up to 12 per side) */
export const ROSTER_HOME_HOTKEYS = [
  ...COLUMN_1_HOTKEYS,
  ...ROSTER_HOME_OVERFLOW_HOTKEYS,
] as const;
/** Match/Game roster: Track Game keys, then overflow (up to 12 per side) */
export const ROSTER_AWAY_HOTKEYS = [
  ...COLUMN_2_HOTKEYS,
  ...ROSTER_AWAY_OVERFLOW_HOTKEYS,
] as const;
/** Result column — order matches throwResultUiOrder (6 throw results). */
export const RESULT_HOTKEYS = ['r', 't', 'y', 'u', 'g', 'h'] as const;
/** Recovered "None" choice (not a player) */
export const RECOVERED_NONE_HOTKEY = 'm';

/** Fixed Other-tab offense keys (stable layout; do not overlap player/result keys). */
export const OTHER_OFFENSE_HOTKEYS = ['1', '2', '3', '4'] as const;

export type OtherOffenseChoice =
  | { kind: 'offense'; offenseId: GameEventErrorOffense }
  | { kind: 'noBlocking' };

export const otherOffenseUiOrder: OtherOffenseChoice[] = [
  { kind: 'offense', offenseId: GameEventErrorOffense.LineOut },
  { kind: 'offense', offenseId: GameEventErrorOffense.WastedBall },
  { kind: 'offense', offenseId: GameEventErrorOffense.BlockIllegal },
  { kind: 'noBlocking' },
];

export function labelForOtherOffenseChoice(choice: OtherOffenseChoice): string {
  if (choice.kind === 'noBlocking') return NO_BLOCKING_STARTED_LABEL;
  return errorOffenseLabels[choice.offenseId];
}

export function hotkeyForOtherOffenseIndex(index: number): string | null {
  return OTHER_OFFENSE_HOTKEYS[index] ?? null;
}

export function getOtherOffenseChoiceForKey(key: string): OtherOffenseChoice | null {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  const index = OTHER_OFFENSE_HOTKEYS.indexOf(
    normalized as (typeof OTHER_OFFENSE_HOTKEYS)[number],
  );
  if (index < 0) return null;
  return otherOffenseUiOrder[index] ?? null;
}

export function isOtherOffenseChoiceActive(
  draft: { offenseId: GameEventErrorOffense | null; noBlockingStarted?: boolean },
  choice: OtherOffenseChoice,
): boolean {
  if (choice.kind === 'noBlocking') return Boolean(draft.noBlockingStarted);
  return !draft.noBlockingStarted && draft.offenseId === choice.offenseId;
}

export function applyOtherOffenseHotkey(
  draft: { offenderGamePlayerId: string; offenseId: GameEventErrorOffense | null; noBlockingStarted?: boolean },
  choice: OtherOffenseChoice,
): typeof draft {
  if (choice.kind === 'noBlocking') {
    return draft.noBlockingStarted
      ? { ...draft, noBlockingStarted: false }
      : { offenderGamePlayerId: '', offenseId: null, noBlockingStarted: true };
  }
  const nextOffense = draft.offenseId === choice.offenseId ? null : choice.offenseId;
  return {
    ...draft,
    noBlockingStarted: false,
    offenseId: nextOffense,
  };
}

export const HOME_PLAYER_HOTKEYS = COLUMN_1_HOTKEYS;
export const AWAY_PLAYER_HOTKEYS = COLUMN_2_HOTKEYS;

export type TrackGameAction =
  | 'addDeflection'
  | 'done'
  | 'addThrow'
  | 'restore'
  | 'insertBelow'
  | 'delete'
  | 'undo'
  | 'redo';

export const GAME_ACTION_HOTKEYS: ReadonlyArray<{
  key: string;
  action: TrackGameAction;
  label: string;
}> = [
  { key: 'z', action: 'addDeflection', label: 'Deflect' },
  { key: 'x', action: 'done', label: 'Done' },
  { key: 'c', action: 'addThrow', label: 'Add team throw' },
  { key: 'v', action: 'restore', label: 'Restore' },
  { key: 'b', action: 'insertBelow', label: 'Insert below' },
  { key: 'n', action: 'delete', label: 'Delete' },
  { key: '-', action: 'undo', label: 'Undo last event' },
  { key: '+', action: 'redo', label: 'Redo last event' },
];

export type PlayerHotkeySource = {
  gamePlayerId: string;
  playerName: string;
  teamHome: boolean;
};

/** Permanent hotkey map for a game: assigned once by team + stable name order. */
export function buildPermanentPlayerHotkeys(
  players: PlayerHotkeySource[],
): Map<string, string> {
  const map = new Map<string, string>();
  const home = players
    .filter((row) => row.teamHome)
    .sort(
      (a, b) =>
        a.playerName.localeCompare(b.playerName) ||
        a.gamePlayerId.localeCompare(b.gamePlayerId),
    );
  const away = players
    .filter((row) => !row.teamHome)
    .sort(
      (a, b) =>
        a.playerName.localeCompare(b.playerName) ||
        a.gamePlayerId.localeCompare(b.gamePlayerId),
    );
  home.forEach((row, index) => {
    const key = COLUMN_1_HOTKEYS[index];
    if (key) map.set(row.gamePlayerId, key);
  });
  away.forEach((row, index) => {
    const key = COLUMN_2_HOTKEYS[index];
    if (key) map.set(row.gamePlayerId, key);
  });
  return map;
}

/** Match/game roster: keys follow the given visual order (starters, then subs). */
export function buildPermanentRosterHotkeys(
  homePlayers: { Id: string; Name: string }[],
  awayPlayers: { Id: string; Name: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  homePlayers.forEach((row, index) => {
    const key = ROSTER_HOME_HOTKEYS[index];
    if (key) map.set(row.Id, key);
  });
  awayPlayers.forEach((row, index) => {
    const key = ROSTER_AWAY_HOTKEYS[index];
    if (key) map.set(row.Id, key);
  });
  return map;
}

export function hotkeyForGamePlayer(
  map: ReadonlyMap<string, string>,
  gamePlayerId: string,
): string | null {
  return map.get(gamePlayerId) ?? null;
}

export function findGamePlayerIdByHotkey(
  map: ReadonlyMap<string, string>,
  key: string,
): string | null {
  const normalized = key.toLowerCase();
  for (const [id, hotkey] of map) {
    if (hotkey === normalized) return id;
  }
  return null;
}

export function assignColumn1Hotkey(index: number): string | null {
  return COLUMN_1_HOTKEYS[index] ?? null;
}

export function assignColumn2Hotkey(index: number): string | null {
  return COLUMN_2_HOTKEYS[index] ?? null;
}

export function assignHomePlayerHotkey(index: number): string | null {
  return assignColumn1Hotkey(index);
}

export function assignAwayPlayerHotkey(index: number): string | null {
  return assignColumn2Hotkey(index);
}

export function assignResultHotkey(index: number): string | null {
  return RESULT_HOTKEYS[index] ?? null;
}

export function hotkeyForResult(resultId: ThrowResult): string | null {
  const index = throwResultUiOrder.indexOf(resultId);
  return index >= 0 ? assignResultHotkey(index) : null;
}

export function getThrowResultForKey(key: string): ThrowResult | null {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  const index = RESULT_HOTKEYS.indexOf(
    normalized as (typeof RESULT_HOTKEYS)[number],
  );
  if (index < 0) return null;
  return throwResultUiOrder[index] ?? null;
}

/** Same keys as throw results, skipping Dodge (`T`) and Miss (`P`). */
export function hotkeyForDeflectionResult(resultId: DeflectionResult): string | null {
  return hotkeyForResult(resultId as unknown as ThrowResult);
}

export function getDeflectionResultForKey(key: string): DeflectionResult | null {
  const throwResult = getThrowResultForKey(key);
  if (throwResult === null) return null;
  if (
    throwResult === ThrowResult.Dodge ||
    throwResult === ThrowResult.Miss
  ) {
    return null;
  }
  return deflectionResultUiOrder.includes(throwResult as unknown as DeflectionResult)
    ? (throwResult as unknown as DeflectionResult)
    : null;
}

export function getTrackGameActionForKey(key: string): TrackGameAction | null {
  if (key === '+' || key === 'Add') return 'redo';
  if (key === '-' || key === '_' || key === 'Subtract') return 'undo';
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  return GAME_ACTION_HOTKEYS.find((row) => row.key === normalized)?.action ?? null;
}

export function hotkeyForPlayerIndex(teamHome: boolean, indexOnSide: number): string | null {
  return teamHome ? assignColumn1Hotkey(indexOnSide) : assignColumn2Hotkey(indexOnSide);
}

export function formatHotkeyLabel(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}

export function findPlayerByHotkey<H extends { Id: string }, A extends { Id: string }>(
  homePlayers: H[],
  awayPlayers: A[],
  key: string,
  hotkeyMap?: ReadonlyMap<string, string>,
): { player: H | A; teamHome: boolean } | null {
  const map =
    hotkeyMap ??
    buildPermanentRosterHotkeys(
      homePlayers.map((row) => ({ Id: row.Id, Name: (row as { Name?: string }).Name ?? row.Id })),
      awayPlayers.map((row) => ({ Id: row.Id, Name: (row as { Name?: string }).Name ?? row.Id })),
    );
  const normalized = key.toLowerCase();
  for (const player of homePlayers) {
    if (map.get(player.Id) === normalized) {
      return { player, teamHome: true };
    }
  }
  for (const player of awayPlayers) {
    if (map.get(player.Id) === normalized) {
      return { player, teamHome: false };
    }
  }
  return null;
}
