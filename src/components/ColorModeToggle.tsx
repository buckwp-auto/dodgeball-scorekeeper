import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import { useId, useState, type MouseEvent, type ReactElement } from 'react';
import type { ColorModePreference } from '../domain/colorMode';
import { useColorMode } from '../state/ColorModeContext';

const OPTIONS: {
  value: ColorModePreference;
  label: string;
  icon: ReactElement;
}[] = [
  { value: 'system', label: 'System', icon: <BrightnessAutoIcon fontSize="small" /> },
  { value: 'light', label: 'Light', icon: <LightModeOutlinedIcon fontSize="small" /> },
  { value: 'dark', label: 'Dark', icon: <DarkModeOutlinedIcon fontSize="small" /> },
];

export function ColorModeToggle() {
  const { preference, setPreference } = useColorMode();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuId = useId();
  const open = Boolean(anchorEl);
  const current = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[0];

  return (
    <>
      <IconButton
        className="sk-color-mode"
        size="small"
        aria-label={`Color mode: ${current.label}`}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open ? 'true' : undefined}
        onClick={(event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}
      >
        {current.icon}
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{ list: { dense: true, 'aria-label': 'Color mode' } }}
      >
        {OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === preference}
            onClick={() => {
              setPreference(option.value);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
