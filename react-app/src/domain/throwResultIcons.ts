import type { SvgIconComponent } from '@mui/icons-material';
import AirIcon from '@mui/icons-material/Air';
import DoNotTouchIcon from '@mui/icons-material/DoNotTouch';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FrontHandIcon from '@mui/icons-material/FrontHand';
import GppBadIcon from '@mui/icons-material/GppBad';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import ReportIcon from '@mui/icons-material/Report';
import ShieldIcon from '@mui/icons-material/Shield';
import SquareFootIcon from '@mui/icons-material/SquareFoot';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import { DeflectionResult, ThrowResult } from './statistics/constants';
import { throwResultUiOrder as gameEventsOrder } from './gameEvents';
import type { TimelineAction } from './gameEventTimeline';

export const throwResultUiOrder = gameEventsOrder;

const icons: Record<ThrowResult, SvgIconComponent> = {
  [ThrowResult.Hit]: TrackChangesIcon,
  [ThrowResult.Dodge]: AirIcon,
  [ThrowResult.Block]: ShieldIcon,
  [ThrowResult.BlockFailed]: GppBadIcon,
  [ThrowResult.Catch]: FrontHandIcon,
  [ThrowResult.CatchFailed]: DoNotTouchIcon,
  [ThrowResult.Miss]: PriorityHighIcon,
};

/** Deflection result pickers reuse the matching throw-result icons. */
const deflectionIcons: Record<DeflectionResult, SvgIconComponent> = {
  [DeflectionResult.Hit]: icons[ThrowResult.Hit],
  [DeflectionResult.Block]: icons[ThrowResult.Block],
  [DeflectionResult.BlockFailed]: icons[ThrowResult.BlockFailed],
  [DeflectionResult.Catch]: icons[ThrowResult.Catch],
  [DeflectionResult.CatchFailed]: icons[ThrowResult.CatchFailed],
};

export function getThrowResultIcon(resultId: ThrowResult): SvgIconComponent {
  return icons[resultId];
}

export function getDeflectionResultIcon(resultId: DeflectionResult): SvgIconComponent {
  return deflectionIcons[resultId];
}

export function getTimelineActionIcon(action: TimelineAction): SvgIconComponent {
  switch (action.kind) {
    case 'throw':
      return getThrowResultIcon(action.resultId);
    case 'deflection':
      return SquareFootIcon;
    case 'error':
      return ReportIcon;
    case 'finish':
      return EmojiEventsIcon;
    case 'start':
      return PlayArrowIcon;
  }
}
