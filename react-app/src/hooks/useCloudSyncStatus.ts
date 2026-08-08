import { useCallback, useMemo } from 'react';
import {
  deriveCloudSyncPresentation,
  type CloudSyncPresentation,
} from '../domain/cloudSyncStatus';
import { useAuth } from '../state/AuthContext';
import { useLeague } from '../state/LeagueContext';

export type CloudSyncStatus = CloudSyncPresentation & {
  syncError: string | null;
  saveNow: () => Promise<void>;
};

export function useCloudSyncStatus(): CloudSyncStatus {
  const { configured, user } = useAuth();
  const {
    leagues,
    activeLeagueId,
    syncStatus,
    lastSavedAt,
    syncError,
    isDirty,
    saveNow,
  } = useLeague();

  const userDisplayName = user
    ? user.displayName?.trim() || user.email || 'signed-in user'
    : null;
  const activeLeagueName =
    leagues.find((row) => row.id === activeLeagueId)?.name ?? null;

  const presentation = useMemo(
    () =>
      deriveCloudSyncPresentation({
        configured,
        userDisplayName,
        activeLeagueId,
        activeLeagueName,
        syncStatus,
        lastSavedAt,
        isDirty,
      }),
    [
      configured,
      userDisplayName,
      activeLeagueId,
      activeLeagueName,
      syncStatus,
      lastSavedAt,
      isDirty,
    ],
  );

  const handleSaveNow = useCallback(async () => {
    await saveNow();
  }, [saveNow]);

  return {
    ...presentation,
    syncError,
    saveNow: handleSaveNow,
  };
}
