import { test, expect } from '@playwright/test';
import { ONBOARDING_COMPLETE_KEY } from '../src/domain/onboarding';
import { STORAGE_KEY } from './helpers/scorekeeper-page';
import {
  addMatch,
  addPlayer,
  addTeam,
  createEmptyDatabase,
  serializeDatabase,
} from '../src/domain/database';
import {
  addGame,
  toggleGamePlayer,
  toggleMatchPlayer,
} from '../src/domain/matchGame';
import {
  getGamePlayerInfos,
  persistThrowGameEvent,
} from '../src/domain/gameEvents';
import { ThrowResult } from '../src/domain/statistics/constants';

function seedGameWithThrow() {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home Hawks');
  const away = addTeam(data, 'Away Owls');
  const h1 = addPlayer(data, home.Id, 'Alex');
  const a1 = addPlayer(data, away.Id, 'Casey');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  const gameId = addGame(data, match.Id);
  toggleGamePlayer(data, match.Id, gameId, h1.Id);
  toggleGamePlayer(data, match.Id, gameId, a1.Id);

  const infos = getGamePlayerInfos(data, match.Id, gameId);
  persistThrowGameEvent(data, gameId, match.Id, [
    {
      throwerGamePlayerId: infos.find((row) => row.playerName === 'Alex')!.gamePlayerId,
      targetGamePlayerId: infos.find((row) => row.playerName === 'Casey')!.gamePlayerId,
      resultId: ThrowResult.Hit,
      deflections: [],
      recoveredId: undefined,
    },
  ]);

  return { data, matchId: match.Id, gameId };
}

test.describe('Timeline highlights', () => {
  test('stars an event and lists it on the Highlights page', async ({ page }) => {
    const { data, matchId, gameId } = seedGameWithThrow();
    await page.addInitScript(
      ({ storageKey, value, onboardingKey }) => {
        sessionStorage.setItem(storageKey, value);
        localStorage.setItem(onboardingKey, '1');
      },
      {
        storageKey: STORAGE_KEY,
        value: serializeDatabase(data),
        onboardingKey: ONBOARDING_COMPLETE_KEY,
      },
    );
    await page.goto(`/matches/${matchId}/games/${gameId}/events`);
    await expect(page.locator('.sk-game-timeline')).toContainText('Alex threw at Casey');

    await page.getByRole('button', { name: 'Star highlight' }).first().click();
    await expect(page.getByRole('button', { name: 'Remove highlight' })).toBeVisible();

    await page.locator('.sk-menu-link').filter({ hasText: 'Highlights' }).first().click();
    await expect(page.getByRole('heading', { name: 'Highlights' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Home Hawks vs. Away Owls' })).toBeVisible();
    await expect(page.locator('.sk-game-timeline')).toContainText('Alex threw at Casey');

    await page.getByRole('button', { name: 'Remove highlight' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Are you sure?');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.sk-game-timeline')).toContainText('Alex threw at Casey');

    await page.getByRole('button', { name: 'Remove highlight' }).click();
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Star events on a game timeline')).toBeVisible();

    await page.goto(`/matches/${matchId}/games/${gameId}/events`);
    await page.getByRole('button', { name: 'Star highlight' }).first().click();
    await page.locator('.sk-menu-link').filter({ hasText: 'Highlights' }).first().click();
    await expect(page.locator('.sk-game-timeline')).toContainText('Alex threw at Casey');

    await page.getByRole('button', { name: /Alex threw at Casey/ }).click();
    await expect(page).toHaveURL(new RegExp(`/matches/${matchId}/games/${gameId}/events\\?event=`));
    await expect(page.locator('.sk-game-timeline')).toContainText('Alex threw at Casey');
  });
});
