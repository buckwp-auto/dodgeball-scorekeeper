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
  /** Selected cloud league, shown as a pill in the sidebar. */
  leaguePill: string | null;
  saveCaption: string | null;
  saveLabel: string | null;
  saveTone: CloudSyncSaveTone;
  canSaveNow: boolean;
};

export type SaveStatusPresentation = {
  saveCaption: string | null;
  saveLabel: string;
};

export function saveStatusPresentation(
  status: SyncStatus,
  lastSavedAt: string | null,
): SaveStatusPresentation {
  switch (status) {
    case 'unsaved':
      return { saveCaption: null, saveLabel: 'Unsaved…' };
    case 'saving':
      return { saveCaption: null, saveLabel: 'Saving…' };
    case 'saved':
      return lastSavedAt
        ? {
            saveCaption: 'Last saved',
            saveLabel: new Date(lastSavedAt).toLocaleTimeString(),
          }
        : { saveCaption: null, saveLabel: 'Saved' };
    case 'quota':
      return { saveCaption: null, saveLabel: 'Quota exceeded' };
    case 'error':
      return { saveCaption: null, saveLabel: 'Sync error' };
    case 'local':
    case 'need-auth':
      return { saveCaption: null, saveLabel: 'Local only' };
    default:
      return { saveCaption: null, saveLabel: status };
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
      leaguePill: null,
      saveCaption: null,
      saveLabel: null,
      saveTone: 'default',
      canSaveNow: false,
    };
  }

  if (!activeLeagueId) {
    return {
      mode: 'signedInNoLeague',
      connectionLabel: `Connected as ${userDisplayName}, no league selected`,
      leaguePill: null,
      saveCaption: null,
      saveLabel: null,
      saveTone: 'default',
      canSaveNow: false,
    };
  }

  const leagueName = activeLeagueName?.trim() || 'League';
  const { saveCaption, saveLabel } = saveStatusPresentation(
    syncStatus,
    lastSavedAt,
  );
  return {
    mode: 'syncing',
    connectionLabel: 'Syncing',
    leaguePill: leagueName,
    saveCaption,
    saveLabel,
    saveTone: saveStatusTone(syncStatus),
    canSaveNow: isDirty && syncStatus !== 'saving',
  };
}
