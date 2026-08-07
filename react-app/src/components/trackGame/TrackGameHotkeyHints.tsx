import { Stack, Typography } from '@mui/material';
import {
  YOUTUBE_FRAME_BACK_HOTKEY,
  YOUTUBE_FRAME_FORWARD_HOTKEY,
  YOUTUBE_LAYOUT_SMALL_HOTKEY,
  YOUTUBE_LAYOUT_TALL_HOTKEY,
} from '../../domain/youtube';
import { GAME_ACTION_HOTKEYS } from '../../domain/hotkeys';
import { HotkeyBadge } from '../HotkeyBadge';

function Hint({
  hotkeys,
  label,
}: {
  hotkeys: string[];
  label: string;
}) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      {hotkeys.map((hotkey) => (
        <HotkeyBadge key={hotkey} hotkey={hotkey} />
      ))}
      <Typography variant="caption">{label}</Typography>
    </Stack>
  );
}

export function TrackGameHotkeyHints({
  hasYoutube,
}: {
  hasYoutube: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      className="sk-action-hotkeys"
      sx={{
        flexWrap: 'wrap',
        mt: 3,
        pt: 2,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {GAME_ACTION_HOTKEYS.map(({ key, label }) => (
        <Hint key={key} hotkeys={[key]} label={label} />
      ))}
      {hasYoutube ? (
        <>
          <Hint
            hotkeys={[YOUTUBE_LAYOUT_SMALL_HOTKEY]}
            label="Video small"
          />
          <Hint
            hotkeys={[YOUTUBE_LAYOUT_TALL_HOTKEY]}
            label="Video tall"
          />
          <Hint hotkeys={['Space']} label="Play/pause" />
          <Hint hotkeys={['←', '→']} label="Seek 5s" />
          <Hint
            hotkeys={[
              YOUTUBE_FRAME_BACK_HOTKEY,
              YOUTUBE_FRAME_FORWARD_HOTKEY,
            ]}
            label="Frame step (paused)"
          />
        </>
      ) : null}
    </Stack>
  );
}
