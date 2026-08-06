export function getVirtualWindow({
  scrollTop,
  viewportHeight,
  itemHeight,
  itemCount,
  overscan = 0,
}: {
  scrollTop: number;
  viewportHeight: number;
  itemHeight: number;
  itemCount: number;
  overscan?: number;
}): { startIndex: number; endIndex: number; offsetY: number } {
  if (itemCount === 0) {
    return { startIndex: 0, endIndex: -1, offsetY: 0 };
  }
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
  const endIndex = Math.min(itemCount - 1, startIndex + visibleCount - 1);
  const offsetY = startIndex * itemHeight;
  return { startIndex, endIndex, offsetY };
}
