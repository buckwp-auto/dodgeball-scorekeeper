import { Chip } from '@mui/material';
import { formatHotkeyLabel } from '../domain/hotkeys';

const SERIF_I_FACE = "Georgia, 'Times New Roman', serif";

export function HotkeyBadge({ hotkey }: { hotkey: string | null }) {
  if (!hotkey) return null;
  const serifI = hotkey.toLowerCase() === 'i';
  return (
    <Chip
      size="small"
      label={formatHotkeyLabel(hotkey)}
      sx={{
        minWidth: 28,
        height: 22,
        fontWeight: 700,
        bgcolor: 'grey.100',
        color: 'grey.900',
        ...(serifI ? { fontFamily: SERIF_I_FACE } : null),
        '& .MuiChip-label': {
          color: 'grey.900',
          ...(serifI ? { fontFamily: SERIF_I_FACE } : null),
        },
      }}
      className="sk-hotkey-badge"
    />
  );
}
