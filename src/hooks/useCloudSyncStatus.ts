import { useCallback, useMemo } from 'react';
import {
  deriveCloudSyncPresentation,
  type CloudSyncPresentation,
} from '../domain/cloudSyncStatus';
import { useAuth } from '../state/AuthContext';
import { useDatabase } from '../state/DatabaseContext';
import { useLeague } from '../state/LeagueContext';

export type CloudSyncStatus = CloudSyncPresentation & {
  syncError: string | null;
  saveNow: () => Promise<void>;
};

export function useCloudSyncStatus(): CloudSyncStatus {
  const { configured, user } = useAuth();
  const { localLeagueLabel } = useDatabase();
  const {
    leagues,
    activeLeagueId,
    accessMode,
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
  const viewOnly = accessMode === 'view';

  const presentation = useMemo(
    () =>
      deriveCloudSyncPresentation({
        configured,
        userDisplayName,
        activeLeagueId,
        activeLeagueName,
        localLeagueLabel: viewOnly ? null : localLeagueLabel,
        syncStatus: viewOnly ? 'saved' : syncStatus,
        lastSavedAt: viewOnly ? null : lastSavedAt,
        isDirty: viewOnly ? false : isDirty,
      }),
    [
      configured,
      userDisplayName,
      activeLeagueId,
      activeLeagueName,
      localLeagueLabel,
      syncStatus,
      lastSavedAt,
      isDirty,
      viewOnly,
    ],
  );

  const handleSaveNow = useCallback(async () => {
    if (viewOnly) return;
    await saveNow();
  }, [saveNow, viewOnly]);

  return {
    ...presentation,
    connectionLabel: viewOnly
      ? configured
        ? userDisplayName
          ? `Viewing as ${userDisplayName}`
          : 'Viewing (signed in)'
        : 'Local only'
      : presentation.connectionLabel,
    saveCaption: viewOnly ? null : presentation.saveCaption,
    saveLabel: viewOnly ? 'Read-only' : presentation.saveLabel,
    saveTone: viewOnly ? 'default' : presentation.saveTone,
    canSaveNow: viewOnly ? false : presentation.canSaveNow,
    syncError: viewOnly ? null : syncError,
    saveNow: handleSaveNow,
  };
}
