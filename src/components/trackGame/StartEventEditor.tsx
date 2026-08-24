import { Stack, Typography } from '@mui/material';
import { VideoTimestampEditor } from './VideoTimestampEditor';

export function StartEventEditor({
  videoOffsetSeconds,
  onCommitOffset,
  onSetFromPlayer,
  canSetFromPlayer,
}: {
  videoOffsetSeconds: number | null | undefined;
  onCommitOffset: (seconds: number | null) => void;
  onSetFromPlayer?: () => void;
  canSetFromPlayer?: boolean;
}) {
  return (
    <Stack spacing={2} sx={{ maxWidth: 420 }}>
      <Typography variant="h6">Game start</Typography>
      <Typography variant="body2" color="text.secondary">
        Mark where this game begins on the match video. Other event times are offsets on the same
        timeline.
      </Typography>
      <VideoTimestampEditor
        label="Start timestamp"
        valueSeconds={videoOffsetSeconds}
        onCommit={onCommitOffset}
        onSetFromPlayer={onSetFromPlayer}
        canSetFromPlayer={canSetFromPlayer}
      />
    </Stack>
  );
}
