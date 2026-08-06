import { DeflectionResult, ThrowResult } from './statistics/constants';

/** Hues reserved for result row tones — team pills stay clear of these. */
export const RESULT_HUES = {
  hit: 0,
  catch: 145,
  dodge: 48,
  block: 210,
} as const;

/** Team hues outside result colors (violet / orange). */
export const TEAM_HUES = {
  home: 275,
  away: 28,
} as const;

/** How far individual player hues may drift from the team base. */
export const PLAYER_HUE_SPREAD = 8;

export type ColorSurface = 'dark' | 'light';

export type TimelineRowTone =
  | 'hit'
  | 'catch'
  | 'dodge'
  | 'block'
  | 'miss'
  | 'error'
  | 'finish'
  | 'neutral';

export type HueStyles = {
  backgroundColor: string;
  color: string;
  borderColor: string;
};

export function toneForThrowResult(resultId: ThrowResult): TimelineRowTone {
  switch (resultId) {
    case ThrowResult.Hit:
    case ThrowResult.BlockFailed:
    case ThrowResult.CatchFailed:
      return 'hit';
    case ThrowResult.Catch:
      return 'catch';
    case ThrowResult.Dodge:
      return 'dodge';
    case ThrowResult.Block:
      return 'block';
    case ThrowResult.Miss:
      return 'miss';
  }
}

export function toneForDeflectionResult(resultId: DeflectionResult): TimelineRowTone {
  switch (resultId) {
    case DeflectionResult.Hit:
    case DeflectionResult.BlockFailed:
    case DeflectionResult.CatchFailed:
      return 'hit';
    case DeflectionResult.Catch:
      return 'catch';
    case DeflectionResult.Block:
      return 'block';
  }
}

/** Unsaturated row fills for non-eliminations; stronger red/green for hit/catch. */
export function rowBackgroundForTone(tone: TimelineRowTone, selected: boolean): string {
  const boost = selected ? 6 : 0;
  switch (tone) {
    case 'hit':
      return `hsl(${RESULT_HUES.hit} 58% ${26 + boost}%)`;
    case 'catch':
      return `hsl(${RESULT_HUES.catch} 42% ${22 + boost}%)`;
    case 'dodge':
      return `hsl(${RESULT_HUES.dodge} 32% ${20 + boost}%)`;
    case 'block':
      return `hsl(${RESULT_HUES.block} 28% ${20 + boost}%)`;
    case 'miss':
      return `hsl(0 0% ${18 + boost}%)`;
    case 'error':
      return `hsl(18 28% ${20 + boost}%)`;
    case 'finish':
      return `hsl(200 18% ${18 + boost}%)`;
    case 'neutral':
      return selected ? 'hsl(190 35% 22%)' : 'transparent';
  }
}

export function teamHue(teamHome: boolean): number {
  return teamHome ? TEAM_HUES.home : TEAM_HUES.away;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export type PlayerColorVars = {
  hueOffset: number;
  /** Percentage-point shift applied to background lightness. */
  lightnessDelta: number;
  /** Percentage-point shift applied to background saturation. */
  saturationDelta: number;
};

/**
 * Stable per-player tweaks kept tight so teammates stay close in-family and
 * pill text/background contrast remains WCAG-friendly.
 */
export function playerColorVars(playerId: string): PlayerColorVars {
  const hash = hashString(playerId);
  const hueOffset = (hash % (PLAYER_HUE_SPREAD * 2 + 1)) - PLAYER_HUE_SPREAD;
  // 5 lightness rungs at 4pp → ±8%
  const lightnessDelta = (((hash >>> 8) % 5) - 2) * 4;
  // 3 saturation rungs at 3pp → ±3%
  const saturationDelta = (((hash >>> 16) % 3) - 1) * 3;
  return { hueOffset, lightnessDelta, saturationDelta };
}

/** @deprecated prefer playerColorVars — kept for callers that only need hue. */
export function playerHueOffset(playerId: string, spread = PLAYER_HUE_SPREAD): number {
  if (spread === PLAYER_HUE_SPREAD) return playerColorVars(playerId).hueOffset;
  const range = spread * 2 + 1;
  return hashString(playerId) % range - spread;
}

export function playerHue(teamHome: boolean, playerId: string): number {
  return teamHue(teamHome) + playerColorVars(playerId).hueOffset;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stylesForHue(hue: number, surface: ColorSurface): HueStyles {
  return stylesForPlayerHue(hue, surface, { hueOffset: 0, lightnessDelta: 0, saturationDelta: 0 });
}

function stylesForPlayerHue(
  hue: number,
  surface: ColorSurface,
  vars: PlayerColorVars,
): HueStyles {
  if (surface === 'light') {
    // Keep backgrounds light and text dark so contrast stays ~AA for pill labels.
    const saturation = clamp(44 + vars.saturationDelta, 38, 52);
    const lightness = clamp(88 + vars.lightnessDelta, 82, 92);
    return {
      backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
      color: `hsl(${hue} 48% 24%)`,
      borderColor: `hsl(${hue} ${clamp(saturation - 6, 30, 48)}% 58%)`,
    };
  }

  // Dark timeline pills: dark fill + light text.
  const saturation = clamp(40 + vars.saturationDelta, 34, 48);
  const lightness = clamp(28 + vars.lightnessDelta, 22, 34);
  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    color: `hsl(${hue} 40% 94%)`,
    borderColor: `hsl(${hue} ${clamp(saturation - 4, 28, 44)}% 44%)`,
  };
}

export function teamHeaderStyles(
  teamHome: boolean,
  surface: ColorSurface = 'light',
): HueStyles {
  return stylesForHue(teamHue(teamHome), surface);
}

export function playerPillStyles(
  teamHome: boolean,
  playerId: string,
  surface: ColorSurface = 'dark',
): HueStyles {
  const vars = playerColorVars(playerId);
  return stylesForPlayerHue(teamHue(teamHome) + vars.hueOffset, surface, vars);
}
