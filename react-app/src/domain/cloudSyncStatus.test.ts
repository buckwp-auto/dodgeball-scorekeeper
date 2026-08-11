import { describe, expect, it } from 'vitest';
import {
  deriveCloudSyncPresentation,
  saveStatusPresentation,
  saveStatusTone,
} from './cloudSyncStatus';

describe('saveStatusPresentation', () => {
  it('puts last-saved caption above time-only chip label', () => {
    const at = '2026-08-08T03:00:00.000Z';
    expect(saveStatusPresentation('saved', at)).toEqual({
      saveCaption: 'Last saved',
      saveLabel: new Date(at).toLocaleTimeString(),
    });
  });

  it('covers transient and error states', () => {
    expect(saveStatusPresentation('unsaved', null)).toEqual({
      saveCaption: null,
      saveLabel: 'Unsaved…',
    });
    expect(saveStatusPresentation('saving', null)).toEqual({
      saveCaption: null,
      saveLabel: 'Saving…',
    });
    expect(saveStatusPresentation('quota', null)).toEqual({
      saveCaption: null,
      saveLabel: 'Quota exceeded',
    });
    expect(saveStatusPresentation('error', null)).toEqual({
      saveCaption: null,
      saveLabel: 'Sync error',
    });
    expect(saveStatusPresentation('saved', null)).toEqual({
      saveCaption: null,
      saveLabel: 'Saved',
    });
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

const baseLocal = {
  configured: false as const,
  userDisplayName: null,
  activeLeagueId: null,
  activeLeagueName: null,
  localLeagueLabel: null,
  syncStatus: 'local' as const,
  lastSavedAt: null,
  isDirty: false,
};

describe('deriveCloudSyncPresentation', () => {
  it('shows local only when firebase is off or unsigned', () => {
    expect(deriveCloudSyncPresentation(baseLocal)).toMatchObject({
      mode: 'local',
      connectionLabel: 'Local only',
      leaguePill: null,
      leaguePillKind: null,
      saveCaption: null,
      saveLabel: null,
      canSaveNow: false,
    });

    expect(
      deriveCloudSyncPresentation({
        ...baseLocal,
        configured: true,
      }).mode,
    ).toBe('local');
  });

  it('shows a local-file league name in the sync bar', () => {
    expect(
      deriveCloudSyncPresentation({
        ...baseLocal,
        localLeagueLabel: 'Spring League',
      }),
    ).toMatchObject({
      mode: 'local',
      connectionLabel: 'Local league',
      leaguePill: 'Spring League',
      leaguePillKind: 'local',
    });
  });

  it('shows signed-in with no league selected', () => {
    expect(
      deriveCloudSyncPresentation({
        configured: true,
        userDisplayName: 'Will',
        activeLeagueId: null,
        activeLeagueName: null,
        localLeagueLabel: null,
        syncStatus: 'local',
        lastSavedAt: null,
        isDirty: false,
      }),
    ).toEqual({
      mode: 'signedInNoLeague',
      connectionLabel: 'Connected as Will, no league selected',
      leaguePill: null,
      leaguePillKind: null,
      saveCaption: null,
      saveLabel: null,
      saveTone: 'default',
      canSaveNow: false,
    });
  });

  it('keeps a local-file name when signed in with no cloud league', () => {
    expect(
      deriveCloudSyncPresentation({
        configured: true,
        userDisplayName: 'Will',
        activeLeagueId: null,
        activeLeagueName: null,
        localLeagueLabel: 'Demo Night',
        syncStatus: 'local',
        lastSavedAt: null,
        isDirty: false,
      }),
    ).toMatchObject({
      mode: 'signedInNoLeague',
      leaguePill: 'Demo Night',
      leaguePillKind: 'local',
    });
  });

  it('shows syncing league with save status and save-now when dirty', () => {
    const view = deriveCloudSyncPresentation({
      configured: true,
      userDisplayName: 'Will',
      activeLeagueId: 'league-1',
      activeLeagueName: 'Spring League',
      localLeagueLabel: 'Ignored local name',
      syncStatus: 'unsaved',
      lastSavedAt: null,
      isDirty: true,
    });
    expect(view).toEqual({
      mode: 'syncing',
      connectionLabel: 'Syncing',
      leaguePill: 'Spring League',
      leaguePillKind: 'cloud',
      saveCaption: null,
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
      localLeagueLabel: null,
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
        localLeagueLabel: null,
        syncStatus: 'saved',
        lastSavedAt: null,
        isDirty: false,
      }).leaguePill,
    ).toBe('League');
  });
});
