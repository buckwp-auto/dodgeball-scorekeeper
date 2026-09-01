import { Box } from '@mui/material';

export function TrackGameTallResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
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
        gridColumn: 2,
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
