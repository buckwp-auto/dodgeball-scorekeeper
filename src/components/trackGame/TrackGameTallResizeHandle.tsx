import { Box } from '@mui/material';

export function TrackGameTallResizeHandle({
  onPointerDown,
  gridColumn = 2,
}: {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  gridColumn?: number;
}) {
  return (
    <Box
      className="sk-track-game-tall-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize scoring panel"
      title="Drag to resize scoring panel"
      onPointerDown={onPointerDown}
      sx={{
        gridColumn,
        gridRow: '1 / -1',
        width: 6,
        cursor: 'col-resize',
        justifySelf: 'center',
        alignSelf: 'stretch',
        touchAction: 'none',
        bgcolor: 'transparent',
        borderLeft: 1,
        borderRight: 1,
        borderColor: 'divider',
        transition: 'background-color 120ms ease',
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    />
  );
}
