import { Box, Button, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { createContext, useContext, type ReactNode } from 'react';
import {
  playerPillStyles,
  teamHeaderStyles,
  type ColorSurface,
} from '../../domain/timelineColors';
import { HotkeyBadge } from '../HotkeyBadge';

export type EditorDensity = 'comfortable' | 'compact';

const EditorDensityContext = createContext<EditorDensity>('comfortable');

export function EditorDensityProvider({
  density,
  children,
}: {
  density: EditorDensity;
  children: ReactNode;
}) {
  return (
    <EditorDensityContext.Provider value={density}>{children}</EditorDensityContext.Provider>
  );
}

export function useEditorDensity(): EditorDensity {
  return useContext(EditorDensityContext);
}

function useEditorColorSurface(): ColorSurface {
  return useTheme().palette.mode === 'dark' ? 'dark' : 'light';
}

export function EditorGrid({ children }: { children: ReactNode }) {
  const density = useEditorDensity();
  const compact = density === 'compact';
  return (
    <Box
      className="sk-editor-grid"
      sx={{
        display: 'grid',
        gridTemplateColumns: '35% 35% 1fr',
        gap: compact ? 0.25 : 0.5,
        // Stretch choice stacks so 6 player buttons can fill the 7-result column height
        alignItems: 'stretch',
        ...(compact ? { minHeight: '100%' } : null),
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
        gap: 0.5,
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
  const density = useEditorDensity();
  return (
    <Typography
      variant={density === 'compact' ? 'caption' : 'subtitle2'}
      sx={{ fontWeight: 700, gridColumn, lineHeight: density === 'compact' ? 1.2 : undefined }}
    >
      {children}
    </Typography>
  );
}

export function TeamBanner({ name, teamHome }: { name: string; teamHome: boolean }) {
  const surface = useEditorColorSurface();
  const styles = teamHeaderStyles(teamHome, surface);
  const density = useEditorDensity();
  const compact = density === 'compact';
  return (
    <Typography
      variant={compact ? 'caption' : 'subtitle2'}
      sx={{
        fontWeight: 700,
        px: compact ? 0.5 : 1,
        py: compact ? 0.4 : 0.75,
        minHeight: compact ? 28 : 36,
        display: 'flex',
        alignItems: 'center',
        mb: compact ? 0.5 : 0.75,
        borderRadius: 1,
        border: '1px solid',
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderColor: styles.borderColor,
        boxSizing: 'border-box',
      }}
    >
      {name}
    </Typography>
  );
}

/** Spacer matching TeamBanner height so the result column aligns with player rows. */
export function TeamBannerSpacer() {
  const density = useEditorDensity();
  const compact = density === 'compact';
  return (
    <Box
      aria-hidden
      sx={{
        minHeight: compact ? 28 : 36,
        mb: compact ? 0.5 : 0.75,
      }}
    />
  );
}

export function EditorChoiceStack({
  pending,
  children,
  gridColumn,
  distribute,
}: {
  pending?: boolean;
  children: ReactNode;
  gridColumn?: string | number;
  /** Grow child buttons to fill the grid row (6 players vs 7 results). */
  distribute?: boolean;
}) {
  const density = useEditorDensity();
  const compact = density === 'compact';
  return (
    <Box
      sx={{
        gridColumn,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 0.25 : 0.5,
        borderLeft: pending ? '4px solid' : '4px solid transparent',
        borderColor: pending ? 'error.main' : 'transparent',
        pl: pending ? (compact ? 0.5 : 1) : 0,
        minHeight: compact ? 28 : 40,
        ...(distribute
          ? {
              '& > *': {
                flex: '1 1 auto',
                minHeight: compact ? 32 : 44,
              },
            }
          : null),
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
  const density = useEditorDensity();
  const compact = density === 'compact';
  const surface = useEditorColorSurface();
  const pill =
    playerId !== undefined && teamHome !== undefined
      ? playerPillStyles(teamHome, playerId, surface)
      : null;

  return (
    <Button
      type="button"
      variant={selected || pill ? 'contained' : 'outlined'}
      size={compact ? 'small' : 'medium'}
      fullWidth
      disabled={false}
      onClick={onClick}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
        py: compact ? 0.35 : 1,
        minHeight: compact ? 32 : 44,
        fontSize: compact ? '0.75rem' : undefined,
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
      <Stack
        direction="row"
        spacing={compact ? 0.5 : 1}
        sx={{ alignItems: 'center', width: '100%' }}
      >
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
  const density = useEditorDensity();
  const compact = density === 'compact';
  const surface = useEditorColorSurface();
  const pill =
    playerId !== undefined && teamHome !== undefined
      ? playerPillStyles(teamHome, playerId, surface)
      : null;

  return (
    <Button
      type="button"
      variant="contained"
      color={pill ? undefined : 'secondary'}
      size={compact ? 'small' : 'medium'}
      fullWidth
      onClick={onClick}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
        py: compact ? 0.35 : 1,
        minHeight: compact ? 32 : 44,
        fontSize: compact ? '0.75rem' : undefined,
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
      <Stack direction="row" spacing={compact ? 0.5 : 1} sx={{ alignItems: 'center' }}>
        {hotkey ? <HotkeyBadge hotkey={hotkey} /> : null}
        <span>{children}</span>
      </Stack>
    </Button>
  );
}
