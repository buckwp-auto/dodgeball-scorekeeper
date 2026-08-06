import { describe, expect, it } from 'vitest';
import { getThrowPhaseOneBannerColumns } from './throwEditorLayout';

describe('throw editor phase-one grid', () => {
  it('always renders home and away banner column headers before thrower is chosen', () => {
    expect(getThrowPhaseOneBannerColumns(false)).toEqual(['home', 'away', 'none']);
  });

  it('uses throwing and defending banners after thrower phase', () => {
    expect(getThrowPhaseOneBannerColumns(true)).toEqual(['throwing', 'defending', 'none']);
  });
});
