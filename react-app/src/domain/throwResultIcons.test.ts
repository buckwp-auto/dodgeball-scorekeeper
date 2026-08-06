import { describe, expect, it } from 'vitest';
import AirIcon from '@mui/icons-material/Air';
import FrontHandIcon from '@mui/icons-material/FrontHand';
import GppBadIcon from '@mui/icons-material/GppBad';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import ShieldIcon from '@mui/icons-material/Shield';
import SquareFootIcon from '@mui/icons-material/SquareFoot';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import { DeflectionResult, ThrowResult } from './statistics/constants';
import {
  getDeflectionResultIcon,
  getTimelineActionIcon,
  getThrowResultIcon,
  throwResultUiOrder,
} from './throwResultIcons';

describe('throw result icons', () => {
  it('provides a distinct icon component for every throw result', () => {
    const icons = throwResultUiOrder.map((resultId) => getThrowResultIcon(resultId));
    expect(new Set(icons).size).toBe(throwResultUiOrder.length);
  });

  it('uses the requested glyphs for throw results', () => {
    expect(getThrowResultIcon(ThrowResult.Hit)).toBe(TrackChangesIcon);
    expect(getThrowResultIcon(ThrowResult.Block)).toBe(ShieldIcon);
    expect(getThrowResultIcon(ThrowResult.BlockFailed)).toBe(GppBadIcon);
    expect(getThrowResultIcon(ThrowResult.Miss)).toBe(PriorityHighIcon);
    expect(getThrowResultIcon(ThrowResult.Dodge)).toBe(AirIcon);
    expect(getThrowResultIcon(ThrowResult.Catch)).toBe(FrontHandIcon);
  });

  it('maps deflection timeline rows to the angle-measure icon', () => {
    expect(getDeflectionResultIcon(DeflectionResult.Catch)).toBe(
      getThrowResultIcon(ThrowResult.Catch),
    );
    expect(
      getTimelineActionIcon({ kind: 'deflection', resultId: DeflectionResult.Block }),
    ).toBe(SquareFootIcon);
    expect(getTimelineActionIcon({ kind: 'throw', resultId: ThrowResult.Dodge })).toBe(AirIcon);
    expect(getTimelineActionIcon({ kind: 'error' })).toBeTruthy();
    expect(getTimelineActionIcon({ kind: 'finish' })).toBeTruthy();
  });
});
