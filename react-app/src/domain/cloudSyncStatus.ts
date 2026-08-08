import type { SyncStatus } from '../cloud/leagueTypes';

export type CloudSyncMode = 'local' | 'signedInNoLeague' | 'syncing';

export type CloudSyncSaveTone = 'default' | 'warning' | 'error';

export type CloudSyncPresentationInput = {
  configured: boolean;
  userDisplayName: string | null;
  activeLeagueId: string | null;
  activeLeagueName: string | null;
  syncStatus: SyncStatus;
  lastSavedAt: string | null;
  isDirty: boolean;
};

export type CloudSyncPresentation = {
  mode: CloudSyncMode;
  connectionLabel: string;
  saveLabel: string | null;
  saveTone: CloudSyncSaveTone;
  canSaveNow: boolean;
};

export function saveStatusLabel(
  status: SyncStatus,
  lastSavedAt: string | null,
): string {
  switch (status) {
    case 'unsaved':
      return 'Unsaved…';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return lastSavedAt
        ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
        : 'Saved';
    case 'quota':
      return 'Quota exceeded';
    case 'error':
      return 'Sync error';
    case 'local':
    case 'need-auth':
      return 'Local only';
    default:
      return status;
  }
}

export function saveStatusTone(status: SyncStatus): CloudSyncSaveTone {
  if (status === 'error' || status === 'quota') return 'error';
  if (status === 'unsaved' || status === 'saving') return 'warning';
  return 'default';
}

export function deriveCloudSyncPresentation(
  input: CloudSyncPresentationInput,
): CloudSyncPresentation {
  const {
    configured,
    userDisplayName,
    activeLeagueId,
    activeLeagueName,
    syncStatus,
    lastSavedAt,
    isDirty,
  } = input;

  if (!configured || !userDisplayName) {
    return {
      mode: 'local',
      connectionLabel: 'Local only',
      saveLabel: null,
      saveTone: 'default',
      canSaveNow: false,
    };
  }

  if (!activeLeagueId) {
    return {
      mode: 'signedInNoLeague',
      connectionLabel: `Connected as ${userDisplayName}, no league selected`,
      saveLabel: null,
      saveTone: 'default',
      canSaveNow: false,
    };
  }

  const leagueName = activeLeagueName?.trim() || 'league';
  return {
    mode: 'syncing',
    connectionLabel: `Syncing to ${leagueName}`,
    saveLabel: saveStatusLabel(syncStatus, lastSavedAt),
    saveTone: saveStatusTone(syncStatus),
    canSaveNow: isDirty && syncStatus !== 'saving',
  };
}
