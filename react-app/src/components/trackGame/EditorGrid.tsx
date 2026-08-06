import { Box, Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { HotkeyBadge } from '../HotkeyBadge';

export function EditorGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      className="sk-editor-grid"
      sx={{
        display: 'grid',
        gridTemplateColumns: '35% 35% 1fr',
        gap: 1,
        alignItems: 'start',
      }}
    >
      {children}
    </Box>
  );
}

export function EditorGridFinish({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 1,
        maxWidth: 480,
      }}
    >
      {children}
    </Box>
  );
}

export function EditorLabel({
  children,
  gridColumn,
}: {
  children: ReactNode;
  gridColumn?: string | number;
}) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, gridColumn }}>
      {children}
    </Typography>
  );
}

export function TeamBanner({ name }: { name: string }) {
  return (
    <Typography
      variant="subtitle2"
      color="primary"
      sx={{
        fontWeight: 700,
        px: 1,
        py: 0.5,
        bgcolor: 'action.hover',
        borderRadius: 1,
      }}
    >
      {name}
    </Typography>
  );
}

export function EditorChoiceStack({
  pending,
  children,
  gridColumn,
}: {
  pending?: boolean;
  children: ReactNode;
  gridColumn?: string | number;
}) {
  return (
    <Box
      sx={{
        gridColumn,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        borderLeft: pending ? '4px solid' : '4px solid transparent',
        borderColor: pending ? 'error.main' : 'transparent',
        pl: pending ? 1 : 0,
        minHeight: 40,
      }}
    >
      {children}
    </Box>
  );
}

export function EditorChoiceButton({
  children,
  selected,
  hotkey,
  startIcon,
  eliminated,
  onClick,
}: {
  children: string;
  selected?: boolean;
  hotkey?: string | null;
  startIcon?: ReactNode;
  eliminated?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={selected ? 'contained' : 'outlined'}
      size="large"
      fullWidth
      disabled={false}
      onClick={onClick}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        opacity: eliminated ? 0.45 : 1,
        bgcolor: eliminated ? 'action.disabledBackground' : undefined,
        color: eliminated ? 'text.disabled' : undefined,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: '100%' }}>
        {hotkey ? <HotkeyBadge hotkey={hotkey} /> : null}
        {startIcon}
        <span>{children}</span>
      </Stack>
    </Button>
  );
}

export function EditorChipButton({
  children,
  hotkey,
  onClick,
}: {
  children: string;
  hotkey?: string | null;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="contained"
      color="secondary"
      size="large"
      fullWidth
      onClick={onClick}
      sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {hotkey ? <HotkeyBadge hotkey={hotkey} /> : null}
        <span>{children}</span>
      </Stack>
    </Button>
  );
}
