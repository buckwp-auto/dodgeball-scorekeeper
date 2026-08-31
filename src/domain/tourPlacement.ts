import type { TourPlacement } from './gameTrackingTour';

export type TourCardSide = 'top' | 'bottom' | 'left' | 'right';

const ESTIMATED_CARD_WIDTH = 320;
const ESTIMATED_CARD_HEIGHT = 200;
const GAP = 12;
const OVERLAP_PADDING = 12;
const PREFERENCE_BONUS = 1000;

export function preferredTourSide(placement?: TourPlacement): TourCardSide {
  switch (placement) {
    case 'top-start':
    case 'top':
      return 'top';
    case 'bottom-start':
    case 'bottom':
      return 'bottom';
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    default:
      return 'right';
  }
}

function makeRect(x: number, y: number, width: number, height: number): DOMRect {
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect;
}

function estimatedCardRect(
  side: TourCardSide,
  anchorRect: DOMRect,
  cardWidth: number,
  cardHeight: number,
): DOMRect {
  switch (side) {
    case 'top':
      return makeRect(
        anchorRect.left,
        anchorRect.top - GAP - cardHeight,
        cardWidth,
        cardHeight,
      );
    case 'bottom':
      return makeRect(
        anchorRect.left,
        anchorRect.bottom + GAP,
        cardWidth,
        cardHeight,
      );
    case 'left':
      return makeRect(
        anchorRect.left - GAP - cardWidth,
        anchorRect.top,
        cardWidth,
        cardHeight,
      );
    case 'right':
      return makeRect(
        anchorRect.right + GAP,
        anchorRect.top,
        cardWidth,
        cardHeight,
      );
  }
}

function rectsOverlap(a: DOMRect, b: DOMRect, padding: number): boolean {
  return (
    a.left < b.right + padding &&
    a.right > b.left - padding &&
    a.top < b.bottom + padding &&
    a.bottom > b.top - padding
  );
}

function freeSpaceOnSide(side: TourCardSide, anchorRect: DOMRect): number {
  const vw = globalThis.innerWidth ?? 0;
  const vh = globalThis.innerHeight ?? 0;
  switch (side) {
    case 'top':
      return anchorRect.top;
    case 'bottom':
      return vh - anchorRect.bottom;
    case 'left':
      return anchorRect.left;
    case 'right':
      return vw - anchorRect.right;
  }
}

export function pickTourSide(
  anchorRect: DOMRect,
  preferred?: TourPlacement,
  cardWidth = ESTIMATED_CARD_WIDTH,
  cardHeight = ESTIMATED_CARD_HEIGHT,
): TourCardSide {
  const sides: TourCardSide[] = ['top', 'bottom', 'left', 'right'];
  const preferredSide = preferredTourSide(preferred);

  let bestSide = preferredSide;
  let bestScore = -Infinity;

  for (const side of sides) {
    const cardRect = estimatedCardRect(side, anchorRect, cardWidth, cardHeight);
    if (rectsOverlap(cardRect, anchorRect, OVERLAP_PADDING)) continue;

    const neededSpace =
      side === 'top' || side === 'bottom' ? cardHeight + GAP : cardWidth + GAP;
    const space = freeSpaceOnSide(side, anchorRect);
    if (space < neededSpace) continue;

    const score = space + (side === preferredSide ? PREFERENCE_BONUS : 0);
    if (score > bestScore) {
      bestScore = score;
      bestSide = side;
    }
  }

  return bestSide;
}

export function tourSideToPopperPlacement(side: TourCardSide): TourPlacement {
  switch (side) {
    case 'top':
      return 'top-start';
    case 'bottom':
      return 'bottom-start';
    case 'left':
      return 'left';
    case 'right':
      return 'right';
  }
}

export function tourSideArrowClass(side: TourCardSide): string {
  switch (side) {
    case 'top':
      return 'sk-onboarding-tour-card--above';
    case 'bottom':
      return 'sk-onboarding-tour-card--below';
    case 'left':
      return 'sk-onboarding-tour-card--right';
    case 'right':
      return 'sk-onboarding-tour-card--left';
  }
}

/** Pixel offset for the arrow along the card edge facing the anchor. */
export function computeTourArrowOffset(
  side: TourCardSide,
  anchorRect: DOMRect,
  cardRect: DOMRect,
): string {
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;
  const min = 16;
  const maxH = Math.max(min, cardRect.width - min);
  const maxV = Math.max(min, cardRect.height - min);

  if (side === 'top' || side === 'bottom') {
    const offset = anchorCenterX - cardRect.left;
    return `${Math.min(Math.max(offset, min), maxH)}px`;
  }

  const offset = anchorCenterY - cardRect.top;
  return `${Math.min(Math.max(offset, min), maxV)}px`;
}
