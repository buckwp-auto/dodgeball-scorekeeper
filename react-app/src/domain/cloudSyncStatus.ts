import type { SyncStatus } from '../cloud/leagueTypes';

export type CloudSyncMode = 'local' | 'signedInNoLeague' | 'syncing';

export type CloudSyncSaveTone = 'default' | 'warning' | 'error';

export type CloudSyncLeaguePillKind = 'cloud' | 'local';

export type CloudSyncPresentationInput = {
  configured: boolean;
  userDisplayName: string | null;
  activeLeagueId: string | null;
  activeLeagueName: string | null;
  /** Display name for a file/sample league when no cloud league is open. */
  localLeagueLabel: string | null;
  syncStatus: SyncStatus;
  lastSavedAt: string | null;
  isDirty: boolean;
};

export type CloudSyncPresentation = {
  mode: CloudSyncMode;
  connectionLabel: string;
  /** Open league name (cloud or local file), shown as a pill in the sidebar. */
  leaguePill: string | null;
  /** Distinguishes filled cloud pill from outlined local-file pill. */
  leaguePillKind: CloudSyncLeaguePillKind | null;
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

function localPill(localLeagueLabel: string | null): {
  leaguePill: string | null;
  leaguePillKind: CloudSyncLeaguePillKind | null;
} {
  const label = localLeagueLabel?.trim() || null;
  return label
    ? { leaguePill: label, leaguePillKind: 'local' }
    : { leaguePill: null, leaguePillKind: null };
}

export function deriveCloudSyncPresentation(
  input: CloudSyncPresentationInput,
): CloudSyncPresentation {
  const {
    configured,
    userDisplayName,
    activeLeagueId,
    activeLeagueName,
    localLeagueLabel,
    syncStatus,
    lastSavedAt,
    isDirty,
  } = input;

  if (!configured || !userDisplayName) {
    const pill = localPill(localLeagueLabel);
    return {
      mode: 'local',
      connectionLabel: pill.leaguePill ? 'Local league' : 'Local only',
      leaguePill: pill.leaguePill,
      leaguePillKind: pill.leaguePillKind,
      saveCaption: null,
      saveLabel: null,
      saveTone: 'default',
      canSaveNow: false,
    };
  }

  if (!activeLeagueId) {
    const pill = localPill(localLeagueLabel);
    return {
      mode: 'signedInNoLeague',
      connectionLabel: `Connected as ${userDisplayName}, no cloud league selected`,
      leaguePill: pill.leaguePill,
      leaguePillKind: pill.leaguePillKind,
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
    leaguePillKind: 'cloud',
    saveCaption,
    saveLabel,
    saveTone: saveStatusTone(syncStatus),
    canSaveNow: isDirty && syncStatus !== 'saving',
  };
}
