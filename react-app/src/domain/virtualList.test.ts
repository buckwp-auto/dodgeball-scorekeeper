import { describe, expect, it } from 'vitest';
import { getVirtualWindow } from './virtualList';

describe('timeline virtualization window', () => {
  it('returns only indices visible in the scroll viewport', () => {
    const window = getVirtualWindow({
      scrollTop: 100,
      viewportHeight: 96,
      itemHeight: 32,
      itemCount: 20,
    });
    expect(window.startIndex).toBe(3);
    expect(window.endIndex).toBe(5);
    expect(window.offsetY).toBe(96);
  });
});
