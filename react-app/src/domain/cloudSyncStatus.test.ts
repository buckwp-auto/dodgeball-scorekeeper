import { describe, expect, it } from 'vitest';
import {
  deriveCloudSyncPresentation,
  saveStatusLabel,
  saveStatusTone,
} from './cloudSyncStatus';

describe('saveStatusLabel', () => {
  it('formats saved with a timestamp', () => {
    const at = '2026-08-08T03:00:00.000Z';
    expect(saveStatusLabel('saved', at)).toBe(
      `Saved ${new Date(at).toLocaleTimeString()}`,
    );
  });

  it('covers transient and error states', () => {
    expect(saveStatusLabel('unsaved', null)).toBe('Unsaved…');
    expect(saveStatusLabel('saving', null)).toBe('Saving…');
    expect(saveStatusLabel('quota', null)).toBe('Quota exceeded');
    expect(saveStatusLabel('error', null)).toBe('Sync error');
    expect(saveStatusLabel('saved', null)).toBe('Saved');
  });
});

describe('saveStatusTone', () => {
  it('maps status to chip tone', () => {
    expect(saveStatusTone('error')).toBe('error');
    expect(saveStatusTone('quota')).toBe('error');
    expect(saveStatusTone('unsaved')).toBe('warning');
    expect(saveStatusTone('saving')).toBe('warning');
    expect(saveStatusTone('saved')).toBe('default');
  });
});

describe('deriveCloudSyncPresentation', () => {
  it('shows local only when firebase is off or unsigned', () => {
    expect(
      deriveCloudSyncPresentation({
        configured: false,
        userDisplayName: null,
        activeLeagueId: null,
        activeLeagueName: null,
        syncStatus: 'local',
        lastSavedAt: null,
        isDirty: false,
      }),
    ).toMatchObject({
      mode: 'local',
      connectionLabel: 'Local only',
      saveLabel: null,
      canSaveNow: false,
    });

    expect(
      deriveCloudSyncPresentation({
        configured: true,
        userDisplayName: null,
        activeLeagueId: null,
        activeLeagueName: null,
        syncStatus: 'local',
        lastSavedAt: null,
        isDirty: false,
      }).mode,
    ).toBe('local');
  });

  it('shows signed-in with no league selected', () => {
    expect(
      deriveCloudSyncPresentation({
        configured: true,
        userDisplayName: 'Will',
        activeLeagueId: null,
        activeLeagueName: null,
        syncStatus: 'local',
        lastSavedAt: null,
        isDirty: false,
      }),
    ).toEqual({
      mode: 'signedInNoLeague',
      connectionLabel: 'Connected as Will, no league selected',
      saveLabel: null,
      saveTone: 'default',
      canSaveNow: false,
    });
  });

  it('shows syncing league with save status and save-now when dirty', () => {
    const view = deriveCloudSyncPresentation({
      configured: true,
      userDisplayName: 'Will',
      activeLeagueId: 'league-1',
      activeLeagueName: 'Spring League',
      syncStatus: 'unsaved',
      lastSavedAt: null,
      isDirty: true,
    });
    expect(view).toEqual({
      mode: 'syncing',
      connectionLabel: 'Syncing to Spring League',
      saveLabel: 'Unsaved…',
      saveTone: 'warning',
      canSaveNow: true,
    });
  });

  it('disables save-now while saving', () => {
    const view = deriveCloudSyncPresentation({
      configured: true,
      userDisplayName: 'Will',
      activeLeagueId: 'league-1',
      activeLeagueName: 'Spring League',
      syncStatus: 'saving',
      lastSavedAt: null,
      isDirty: true,
    });
    expect(view.canSaveNow).toBe(false);
    expect(view.saveLabel).toBe('Saving…');
  });

  it('falls back when league name is missing', () => {
    expect(
      deriveCloudSyncPresentation({
        configured: true,
        userDisplayName: 'Will',
        activeLeagueId: 'league-1',
        activeLeagueName: null,
        syncStatus: 'saved',
        lastSavedAt: null,
        isDirty: false,
      }).connectionLabel,
    ).toBe('Syncing to league');
  });
});
