import { describe, expect, it } from 'vitest';
import { ThrowResult } from './statistics/constants';
import { getThrowResultIcon, throwResultUiOrder } from './throwResultIcons';

describe('throw result icons', () => {
  it('provides a distinct MUI icon component name for every throw result', () => {
    for (const resultId of throwResultUiOrder) {
      const icon = getThrowResultIcon(resultId);
      expect(icon, `missing icon for ${ThrowResult[resultId]}`).toBeTruthy();
    }
  });
});
