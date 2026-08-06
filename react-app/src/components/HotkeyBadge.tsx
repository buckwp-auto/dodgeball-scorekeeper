import { Chip } from '@mui/material';
import { formatHotkeyLabel } from '../domain/hotkeys';

export function HotkeyBadge({ hotkey }: { hotkey: string | null }) {
  if (!hotkey) return null;
  return (
    <Chip
      size="small"
      label={formatHotkeyLabel(hotkey)}
      sx={{ minWidth: 28, height: 22, fontWeight: 700 }}
      className="sk-hotkey-badge"
    />
  );
}
