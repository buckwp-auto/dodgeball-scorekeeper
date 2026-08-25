import { WRITES_PER_HOUR } from '../domain/limits';

/** Kept free of Firebase imports so callers can catch it without loading the SDK. */
export class QuotaExceededError extends Error {
  constructor() {
    super(`Write quota exceeded (${WRITES_PER_HOUR} per hour)`);
    this.name = 'QuotaExceededError';
  }
}
