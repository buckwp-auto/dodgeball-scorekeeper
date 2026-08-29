import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { normalizeDatabase } from './database';
import {
  GAME_TRACKING_STEPS,
  gameTrackingAdvanceMet,
  gameTrackingAnchorSelector,
  gameTrackingStepRoute,
  resolveGameTrackingMatchId,
  resolveGameTrackingTargets,
} from './gameTrackingTour';
import { addGameWithAutoRoster } from './rosterAutoSelect';

const fixturePath = path.join(
  process.cwd(),
  'tests',
  'fixtures',
  'league-six-teams.scrkpr',
);

describe('gameTrackingTour', () => {
  it('defines an interactive scoring walkthrough', () => {
    expect(GAME_TRACKING_STEPS.length).toBeGreaterThanOrEqual(15);
    expect(GAME_TRACKING_STEPS[0]?.id).toBe('intro');
    expect(GAME_TRACKING_STEPS.some((step) => step.loadSample)).toBe(true);
    expect(GAME_TRACKING_STEPS.some((step) => step.createGame)).toBe(true);
    expect(GAME_TRACKING_STEPS.filter((step) => step.interactive).length).toBeGreaterThan(5);
  });

  it('resolves a demo match and tour game routes', () => {
    const raw = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    const data = normalizeDatabase(raw);
    const matchId = resolveGameTrackingMatchId(data);
    expect(matchId).toBeTruthy();
    const gameId = addGameWithAutoRoster(data, matchId!);
    const targets = resolveGameTrackingTargets(data, gameId);
    expect(targets?.gameId).toBe(gameId);
    expect(gameTrackingStepRoute('track-game', targets)).toContain(gameId);
    expect(gameTrackingStepRoute('throw-single', targets)).toContain('/events');
  });

  it('tracks advance conditions for scoring milestones', () => {
    const raw = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    const data = normalizeDatabase(raw);
    const matchId = resolveGameTrackingMatchId(data)!;
    const gameId = addGameWithAutoRoster(data, matchId);
    const eventsPath = `/matches/${matchId}/games/${gameId}/events`;

    expect(
      gameTrackingAdvanceMet(data, gameId, 'on-track-game-page', '/matches/1/games/2'),
    ).toBe(false);
    expect(gameTrackingAdvanceMet(data, gameId, 'on-track-game-page', eventsPath)).toBe(true);
  });

  it('builds anchor selectors', () => {
    expect(gameTrackingAnchorSelector('throw-editor')).toBe('[data-tour="throw-editor"]');
    expect(gameTrackingAnchorSelector('nav-matches')).toBe('[data-onboarding="nav-matches"]');
  });

  it('uses top-start placement for roster steps', () => {
    expect(GAME_TRACKING_STEPS.find((step) => step.id === 'match-roster')?.placement).toBe(
      'top-start',
    );
    expect(GAME_TRACKING_STEPS.find((step) => step.id === 'game-roster')?.placement).toBe(
      'top-start',
    );
  });
});
