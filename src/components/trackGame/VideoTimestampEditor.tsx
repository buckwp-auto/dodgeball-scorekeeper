import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { formatVideoTime, parseVideoTime } from '../../domain/youtube';

/** Editable video timestamp (m:ss / h:mm:ss / seconds) with optional “from player”. */
export function VideoTimestampEditor({
  valueSeconds,
  onCommit,
  onSetFromPlayer,
  canSetFromPlayer,
  dense = false,
  label = 'Timestamp',
}: {
  valueSeconds: number | null | undefined;
  onCommit: (seconds: number | null) => void;
  onSetFromPlayer?: () => void;
  canSetFromPlayer?: boolean;
  dense?: boolean;
  label?: string;
}) {
  const [text, setText] = useState(() => formatVideoTime(valueSeconds));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(formatVideoTime(valueSeconds));
    setInvalid(false);
  }, [valueSeconds]);

  const commitText = () => {
    if (!text.trim()) {
      setInvalid(false);
      onCommit(null);
      setText('');
      return;
    }
    const parsed = parseVideoTime(text);
    if (parsed === null) {
      setInvalid(true);
      setText(formatVideoTime(valueSeconds));
      return;
    }
    setInvalid(false);
    onCommit(parsed);
    setText(formatVideoTime(parsed));
  };

  return (
    <Stack
      direction={dense ? 'row' : 'column'}
      spacing={dense ? 0.75 : 1}
      sx={{ alignItems: dense ? 'center' : 'stretch' }}
    >
      {!dense ? (
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
      ) : null}
      <TextField
        size="small"
        label={dense ? undefined : 'Video time'}
        placeholder="m:ss"
        value={text}
        error={invalid}
        helperText={invalid ? 'Use m:ss, h:mm:ss, or seconds' : dense ? undefined : ' '}
        onChange={(event) => {
          setText(event.target.value);
          setInvalid(false);
        }}
        onBlur={commitText}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
          // Don’t let Track Game hotkeys steal typing
          event.stopPropagation();
        }}
        sx={{
          width: dense ? 96 : 160,
          '& input': { fontVariantNumeric: 'tabular-nums' },
        }}
      />
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
        {canSetFromPlayer && onSetFromPlayer ? (
          <Button size="small" variant="outlined" onClick={onSetFromPlayer}>
            From video
          </Button>
        ) : null}
        {valueSeconds !== null && valueSeconds !== undefined ? (
          <Button size="small" color="inherit" onClick={() => onCommit(null)}>
            Clear
          </Button>
        ) : null}
      </Stack>
      {dense && (valueSeconds === null || valueSeconds === undefined) ? (
        <Box component="span" sx={{ typography: 'caption', color: 'text.secondary' }}>
          no time
        </Box>
      ) : null}
    </Stack>
  );
}
