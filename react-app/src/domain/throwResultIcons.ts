import type { SvgIconComponent } from '@mui/icons-material';
import BlockIcon from '@mui/icons-material/Block';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { ThrowResult } from './statistics/constants';
import { throwResultUiOrder as gameEventsOrder } from './gameEvents';

export const throwResultUiOrder = gameEventsOrder;

const icons: Record<ThrowResult, SvgIconComponent> = {
  [ThrowResult.Hit]: SportsKabaddiIcon,
  [ThrowResult.Dodge]: DirectionsRunIcon,
  [ThrowResult.Block]: BlockIcon,
  [ThrowResult.BlockFailed]: WarningAmberIcon,
  [ThrowResult.Catch]: CheckCircleIcon,
  [ThrowResult.CatchFailed]: CancelIcon,
  [ThrowResult.Miss]: CloseIcon,
};

export function getThrowResultIcon(resultId: ThrowResult): SvgIconComponent {
  return icons[resultId];
}
