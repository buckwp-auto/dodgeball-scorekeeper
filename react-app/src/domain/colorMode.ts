export const COLOR_MODE_KEY = 'SCOREKEEPER_COLOR_MODE';

export type ColorModePreference = 'system' | 'light' | 'dark';
export type ResolvedColorMode = 'light' | 'dark';

export function isColorModePreference(value: string): value is ColorModePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function loadColorModePreference(): ColorModePreference {
  try {
    const raw = localStorage.getItem(COLOR_MODE_KEY);
    if (isColorModePreference(raw ?? '')) return raw as ColorModePreference;
  } catch {
    /* ignore quota / private mode */
  }
  return 'system';
}

export function saveColorModePreference(preference: ColorModePreference): void {
  try {
    localStorage.setItem(COLOR_MODE_KEY, preference);
  } catch {
    /* ignore quota / private mode */
  }
}

export function resolveColorMode(
  preference: ColorModePreference,
  systemPrefersDark: boolean,
): ResolvedColorMode {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}
