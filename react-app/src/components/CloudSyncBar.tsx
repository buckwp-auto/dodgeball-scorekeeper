import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useCloudSyncStatus } from '../hooks/useCloudSyncStatus';

export function CloudSyncBar() {
  const {
    connectionLabel,
    saveLabel,
    saveTone,
    canSaveNow,
    syncError,
    saveNow,
  } = useCloudSyncStatus();

  return (
    <Box
      sx={{
        px: 0.5,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Stack spacing={0.75}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1.3, display: 'block' }}
        >
          {connectionLabel}
        </Typography>
        {saveLabel ? (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Chip size="small" color={saveTone} label={saveLabel} />
            <Button
              size="small"
              variant="outlined"
              disabled={!canSaveNow}
              onClick={() => void saveNow()}
              sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: '0.7rem' }}
            >
              Save now
            </Button>
          </Stack>
        ) : null}
        {syncError ? (
          <Typography
            variant="caption"
            color="error"
            sx={{ lineHeight: 1.3, display: 'block' }}
          >
            {syncError}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
