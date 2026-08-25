import { test, expect } from '@playwright/test';
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
import { getGamePlayerInfos } from '../src/domain/gameEvents';
import { buildPermanentPlayerHotkeys } from '../src/domain/hotkeys';

function seedOneVOneGame() {
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
  const hotkeys = buildPermanentPlayerHotkeys(infos);
  const gamePlayerId = (name: string) =>
    infos.find((row) => row.playerName === name)!.gamePlayerId;
  return {
    data,
    matchId: match.Id,
    gameId,
    throwerKey: hotkeys.get(gamePlayerId('Alex'))!,
    targetKey: hotkeys.get(gamePlayerId('Casey'))!,
  };
}

test.describe('Wipe finish prompt', () => {
  test('requires Done after last elimination before Finish', async ({ page }) => {
    const { data, matchId, gameId, throwerKey, targetKey } = seedOneVOneGame();
    await page.addInitScript(
      ({ key, value }) => sessionStorage.setItem(key, value),
      { key: STORAGE_KEY, value: serializeDatabase(data) },
    );
    await page.goto(`/matches/${matchId}/games/${gameId}/events`);
    await expect(page.getByRole('button', { name: 'Throw', exact: true })).toBeVisible();

    await page.keyboard.press(throwerKey);
    await page.keyboard.press(targetKey);
    await page.keyboard.press('r');

    await expect(
      page.getByText('All players on one team are out — press Done (X or Enter) to finish.'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'throw', exact: true })).toBeVisible();
    await expect(page.getByText('confirm the winner with Enter.')).toHaveCount(0);
    await expect(page.getByText('Game Complete!')).toHaveCount(0);

    await page.getByPlaceholder('m:ss').first().click();
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('All players on one team are out — press Done (X or Enter) to finish.'),
    ).toBeVisible();
    await expect(page.getByText('confirm the winner with Enter.')).toHaveCount(0);

    await page.locator('body').click();
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('All players on one team are out — confirm the winner with Enter.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Home Hawks', exact: true })).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.getByText('Game Complete!')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Game 2', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Track Game' })).toBeVisible();
  });
});
