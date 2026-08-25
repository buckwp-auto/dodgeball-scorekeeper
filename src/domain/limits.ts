/** Shared text limits — enforce in UI, domain, and Firestore rules. */

export const MAX_LEAGUE_NAME = 80;
export const MAX_TEAM_NAME = 80;
export const MAX_PLAYER_NAME = 80;
export const MAX_DISPLAY_NAME = 80;
export const MAX_NOTES = 500;
export const MAX_EMAIL = 254;
export const MAX_IMAGE_URL = 2048;
export const MAX_STORAGE_PATH = 512;
export const MAX_IMAGE_CONTENT_TYPE = 100;

export const WRITES_PER_HOUR = 100;
export const CLOUD_FLUSH_IDLE_MS = 30_000;
export const CLOUD_POLL_MS = 30_000;

export function clampName(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function assertMaxLength(
  value: string,
  max: number,
  label: string,
): void {
  if (value.length > max) {
    throw new Error(`${label} must be at most ${max} characters`);
  }
}
