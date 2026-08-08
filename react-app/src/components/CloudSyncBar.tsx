import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useCloudSyncStatus } from '../hooks/useCloudSyncStatus';

export function CloudSyncBar() {
  const {
    connectionLabel,
    saveCaption,
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
        pt: 1.5,
        pb: 2.5,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Stack spacing={0.75}>
        <Typography
          variant="caption"
          color="text.primary"
          sx={{ lineHeight: 1.3, display: 'block' }}
        >
          {connectionLabel}
        </Typography>
        {saveLabel ? (
          <Stack spacing={0.25}>
            {saveCaption ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ lineHeight: 1.2, display: 'block', fontSize: '0.65rem' }}
              >
                {saveCaption}
              </Typography>
            ) : null}
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Chip
                size="small"
                color={saveTone}
                label={saveLabel}
                sx={{
                  height: 20,
                  minWidth: 0,
                  fontSize: '0.65rem',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
              <Button
                size="small"
                variant="outlined"
                disabled={!canSaveNow}
                onClick={() => void saveNow()}
                sx={{
                  minWidth: 0,
                  flexShrink: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: '0.7rem',
                  whiteSpace: 'nowrap',
                }}
              >
                Save now
              </Button>
            </Stack>
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
