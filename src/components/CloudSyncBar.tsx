import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { isOperatingAsAppAdmin } from '../domain/appRoles';
import { useCloudSyncStatus } from '../hooks/useCloudSyncStatus';
import { useAppRole } from '../state/AppRoleContext';
import { useLeague } from '../state/LeagueContext';

export function CloudSyncBar() {
  const {
    connectionLabel,
    leaguePill,
    leaguePillKind,
    saveCaption,
    saveLabel,
    saveTone,
    canSaveNow,
    syncError,
    saveNow,
  } = useCloudSyncStatus();
  const { isAppAdmin } = useAppRole();
  const { activeLeagueId, memberships, accessMode } = useLeague();
  const viewOnly = accessMode === 'view';
  const showOperatorChip =
    !viewOnly &&
    isOperatingAsAppAdmin({
      isAppAdmin,
      membershipStatus: activeLeagueId
        ? memberships[activeLeagueId]?.status
        : null,
    });

  const isCloudPill = leaguePillKind === 'cloud';

  return (
    <Box
      data-onboarding="sync-bar"
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
          variant="body2"
          color="text.primary"
          sx={{ lineHeight: 1.3, display: 'block' }}
        >
          {connectionLabel}
        </Typography>
        {leaguePill ? (
          <Chip
            color={isCloudPill ? 'primary' : 'default'}
            variant={isCloudPill ? 'filled' : 'outlined'}
            label={leaguePill}
            className={
              isCloudPill ? 'sk-cloud-league-pill' : 'sk-local-league-pill'
            }
            title={leaguePill}
            sx={{
              width: '100%',
              height: 32,
              borderRadius: 999,
              fontSize: '0.75rem',
              justifyContent: 'flex-start',
              '& .MuiChip-label': {
                px: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              },
            }}
          />
        ) : null}
        {showOperatorChip ? (
          <Chip
            size="small"
            color="secondary"
            variant="outlined"
            label="App admin"
            className="sk-app-admin-operator-chip"
            sx={{
              width: '100%',
              height: 24,
              fontSize: '0.7rem',
              justifyContent: 'flex-start',
            }}
          />
        ) : null}
        {!isCloudPill ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ lineHeight: 1.2, display: 'block' }}
          >
            (local file)
          </Typography>
        ) : null}
        {saveLabel ? (
          <Stack spacing={0.75}>
            {saveCaption ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ lineHeight: 1.2, display: 'block' }}
              >
                {saveCaption}
              </Typography>
            ) : null}
            <Stack spacing={1} sx={{ alignItems: 'center' }}>
              <Chip
                color={saveTone}
                label={saveLabel}
                sx={{
                  height: 28,
                  minWidth: 0,
                  maxWidth: '100%',
                  alignSelf: 'stretch',
                  fontSize: '0.8rem',
                  justifyContent: 'flex-start',
                  '& .MuiChip-label': {
                    px: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  },
                }}
              />
              <Button
                size="small"
                variant="outlined"
                disabled={!canSaveNow}
                onClick={() => void saveNow()}
                sx={{
                  mt: 0.75,
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: '0.8rem',
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
            variant="body2"
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
