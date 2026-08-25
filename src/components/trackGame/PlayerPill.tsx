import { Box } from '@mui/material';
import { playerPillStyles, type ColorSurface } from '../../domain/timelineColors';

export type PlayerPillProps = {
  name: string;
  teamHome: boolean;
  playerId: string;
  surface?: ColorSurface;
  eliminated?: boolean;
};

export function PlayerPill({
  name,
  teamHome,
  playerId,
  surface = 'dark',
  eliminated = false,
}: PlayerPillProps) {
  const styles = playerPillStyles(teamHome, playerId, surface);
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: 0.15,
        mx: 0.15,
        borderRadius: 999,
        fontSize: '0.8rem',
        fontWeight: 650,
        lineHeight: 1.25,
        border: '1px solid',
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderColor: styles.borderColor,
        whiteSpace: 'nowrap',
        verticalAlign: 'baseline',
        opacity: eliminated ? 0.5 : 1,
      }}
    >
      {name}
    </Box>
  );
}
