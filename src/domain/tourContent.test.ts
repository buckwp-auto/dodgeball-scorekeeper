import { describe, expect, it } from 'vitest';
import { GAME_TRACKING_STEPS } from './gameTrackingTour';
import { isTourBodyArray, resolveTourBodyHotkey } from './tourContent';

function stepBody(id: string) {
  const step = GAME_TRACKING_STEPS.find((row) => row.id === id);
  expect(step).toBeTruthy();
  return step!.body;
}

describe('tourContent', () => {
  it('resolves hotkey segments for scoring tour steps', () => {
    const teamThrowBody = stepBody('throw-team');
    expect(isTourBodyArray(teamThrowBody)).toBe(true);
    if (!isTourBodyArray(teamThrowBody)) return;
    const addThrow = teamThrowBody.find((segment) => typeof segment !== 'string');
    expect(resolveTourBodyHotkey(addThrow!)).toBe('c');

    const throwSingleBody = stepBody('throw-single');
    if (!isTourBodyArray(throwSingleBody)) throw new Error('expected array body');
    const doneSegment = throwSingleBody.find(
      (segment) => typeof segment !== 'string' && 'action' in segment && segment.action === 'done',
    );
    expect(resolveTourBodyHotkey(doneSegment!)).toBe('x');
    const throwHotkeys = throwSingleBody
      .filter((segment) => typeof segment !== 'string' && 'key' in segment)
      .map((segment) => resolveTourBodyHotkey(segment!));
    expect(throwHotkeys).toEqual(['a', 'j', 'r', ' ', 'ArrowLeft', 'ArrowRight', ',', '.']);

    const deflectionBody = stepBody('throw-deflection');
    if (!isTourBodyArray(deflectionBody)) throw new Error('expected array body');
    const addDeflect = deflectionBody.find((segment) => typeof segment !== 'string');
    expect(resolveTourBodyHotkey(addDeflect!)).toBe('z');

    const otherTabBody = stepBody('other-tab');
    if (!isTourBodyArray(otherTabBody)) throw new Error('expected array body');
    const otherHotkeys = otherTabBody
      .filter((segment) => typeof segment !== 'string')
      .map((segment) => resolveTourBodyHotkey(segment));
    expect(otherHotkeys).toEqual(["'", '1']);

    const finishBody = stepBody('finish-game');
    if (!isTourBodyArray(finishBody)) throw new Error('expected array body');
    const finishKey = finishBody.find((segment) => typeof segment !== 'string');
    expect(resolveTourBodyHotkey(finishKey!)).toBe('\\');

    const timelineBody = stepBody('timeline');
    if (!isTourBodyArray(timelineBody)) throw new Error('expected array body');
    const hotkeySegments = timelineBody.filter((segment) => typeof segment !== 'string');
    expect(hotkeySegments.map((segment) => resolveTourBodyHotkey(segment))).toEqual(['-', '+']);
  });
});
