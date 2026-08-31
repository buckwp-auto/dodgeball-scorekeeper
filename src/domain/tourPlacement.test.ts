import { describe, expect, it, vi } from 'vitest';
import { computeTourArrowOffset, pickTourSide, preferredTourSide } from './tourPlacement';

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect;
}

describe('tourPlacement', () => {
  it('maps step placement hints to card sides', () => {
    expect(preferredTourSide('top-start')).toBe('top');
    expect(preferredTourSide('bottom-start')).toBe('bottom');
    expect(preferredTourSide('left')).toBe('left');
    expect(preferredTourSide('right')).toBe('right');
  });

  it('prefers top when there is no room below the anchor', () => {
    vi.stubGlobal('innerWidth', 1200);
    vi.stubGlobal('innerHeight', 800);
    const anchorRect = rect(20, 550, 1160, 200);
    expect(pickTourSide(anchorRect, 'bottom-start')).toBe('top');
    vi.unstubAllGlobals();
  });

  it('points the arrow toward the anchor center', () => {
    const anchorRect = rect(200, 200, 100, 40);
    const cardRect = rect(100, 260, 320, 180);
    expect(computeTourArrowOffset('bottom', anchorRect, cardRect)).toBe('150px');
  });
});
