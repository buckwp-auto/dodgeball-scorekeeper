import KeyboardIcon from '@mui/icons-material/Keyboard';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
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

function ActionHints() {
  return (
    <>
      {GAME_ACTION_HOTKEYS.map(({ key, label }) => (
        <Hint key={key} hotkeys={[key]} label={label} />
      ))}
    </>
  );
}

function PlaybackHints() {
  return (
    <>
      <Hint hotkeys={['Space']} label="Play/pause" />
      <Hint hotkeys={['←', '→']} label="Seek 5s" />
      <Hint
        hotkeys={[YOUTUBE_FRAME_BACK_HOTKEY, YOUTUBE_FRAME_FORWARD_HOTKEY]}
        label="Frame step (paused)"
      />
    </>
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
      <ActionHints />
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
          <PlaybackHints />
        </>
      ) : null}
    </Stack>
  );
}

/** Compact reference for tall YouTube chrome — playback + editor actions. */
export function TrackGameHotkeysTooltip() {
  return (
    <Tooltip
      arrow
      placement="bottom-end"
      enterDelay={200}
      leaveDelay={200}
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: 460,
            bgcolor: 'grey.900',
            border: 1,
            borderColor: 'grey.700',
            p: 1.25,
          },
        },
      }}
      title={
        <Stack spacing={1.25} className="sk-youtube-hotkeys-tooltip">
          <Stack spacing={0.5}>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.75 }}>
              Playback
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: 'wrap', rowGap: 0.5, alignItems: 'center' }}
            >
              <PlaybackHints />
            </Stack>
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.75 }}>
              Actions
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: 'wrap', rowGap: 0.5, alignItems: 'center' }}
            >
              <ActionHints />
            </Stack>
          </Stack>
        </Stack>
      }
    >
      <IconButton
        size="small"
        color="inherit"
        aria-label="Hotkeys"
        className="sk-youtube-hotkeys-help"
      >
        <KeyboardIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
