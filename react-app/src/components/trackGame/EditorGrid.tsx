import { Box, Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import {
  playerPillStyles,
  teamHeaderStyles,
} from '../../domain/timelineColors';
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

export function TeamBanner({ name, teamHome }: { name: string; teamHome: boolean }) {
  const styles = teamHeaderStyles(teamHome, 'light');
  return (
    <Typography
      variant="subtitle2"
      sx={{
        fontWeight: 700,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        border: '1px solid',
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderColor: styles.borderColor,
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
  playerId,
  teamHome,
  onClick,
}: {
  children: string;
  selected?: boolean;
  hotkey?: string | null;
  startIcon?: ReactNode;
  eliminated?: boolean;
  playerId?: string;
  teamHome?: boolean;
  onClick: () => void;
}) {
  const pill =
    playerId !== undefined && teamHome !== undefined
      ? playerPillStyles(teamHome, playerId, 'light')
      : null;

  return (
    <Button
      type="button"
      variant={selected || pill ? 'contained' : 'outlined'}
      size="large"
      fullWidth
      disabled={false}
      onClick={onClick}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        opacity: eliminated ? 0.45 : 1,
        ...(pill
          ? {
              bgcolor: selected ? pill.borderColor : pill.backgroundColor,
              color: pill.color,
              border: '1px solid',
              borderColor: pill.borderColor,
              boxShadow: 'none',
              '&:hover': {
                bgcolor: pill.borderColor,
                borderColor: pill.borderColor,
                boxShadow: 'none',
                color: pill.color,
              },
            }
          : {
              bgcolor: eliminated ? 'action.disabledBackground' : undefined,
              color: eliminated ? 'text.disabled' : undefined,
            }),
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
  playerId,
  teamHome,
  onClick,
}: {
  children: string;
  hotkey?: string | null;
  playerId?: string;
  teamHome?: boolean;
  onClick: () => void;
}) {
  const pill =
    playerId !== undefined && teamHome !== undefined
      ? playerPillStyles(teamHome, playerId, 'light')
      : null;

  return (
    <Button
      type="button"
      variant="contained"
      color={pill ? undefined : 'secondary'}
      size="large"
      fullWidth
      onClick={onClick}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        ...(pill
          ? {
              bgcolor: pill.borderColor,
              color: pill.color,
              border: '1px solid',
              borderColor: pill.borderColor,
              boxShadow: 'none',
              '&:hover': {
                bgcolor: pill.color,
                color: pill.backgroundColor,
                borderColor: pill.color,
                boxShadow: 'none',
              },
            }
          : null),
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {hotkey ? <HotkeyBadge hotkey={hotkey} /> : null}
        <span>{children}</span>
      </Stack>
    </Button>
  );
}
