import { test, expect } from '@playwright/test';
import {
  addPlayer,
  addTeam,
  clearScorekeeperStorage,
  createMatch,
  gotoScorekeeper,
  loadSampleLeague,
  navigateMenu,
  openTeam,
} from './helpers/scorekeeper-page';

test.describe('In-app stats', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
  });

  test('opens league stats from the drawer after loading the sample', async ({
    page,
  }) => {
    await loadSampleLeague(page);
    await navigateMenu(page, 'Stats');
    await expect(page.getByRole('heading', { name: /stats/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Standings' })).toBeVisible();
    await expect(page.locator('.sk-stats-standings')).toContainText('The Fellowship');
    await page.getByRole('tab', { name: 'Players' }).click();
    await expect(page.locator('.sk-stats-table')).toContainText('Frodo Baggins');
    await expect(page.locator('.sk-stats-table')).toContainText('Elu%');
    await page.getByRole('tab', { name: 'Leaderboards' }).click();
    await expect(page.locator('.sk-stats-leaderboard')).toBeVisible();
    await expect(page.locator('.sk-stats-leaderboard-qualifiers')).toContainText('15 games');
    await expect(page.locator('.sk-stats-leaderboard-qualifiers')).toContainText('2 matches');
    await expect(page.locator('.sk-stats-leaderboard-qualifiers')).toContainText('20 throws');
    await expect(page.locator('.sk-stats-leaderboard-podium')).toBeVisible();
    await expect(page.locator('.sk-stats-leaderboard-table')).toBeVisible();
    await expect(page.locator('.sk-stats-leaderboard-table tbody tr')).toHaveCount(5);
    await page.getByRole('button', { name: 'Catch %' }).click();
    await expect(page.locator('.sk-stats-leaderboard-table')).toContainText('Catch %');

    await navigateMenu(page, 'League Stat Settings');
    await expect(page.getByRole('heading', { name: 'League Stat Settings' })).toBeVisible();
    await expect(page.getByLabel('Min games')).toHaveValue('15');
    await expect(page.getByLabel('Min matches')).toHaveValue('2');
    await expect(page.getByLabel('Min throws')).toHaveValue('20');
    await expect(page.getByLabel('Min targets')).toHaveValue('20');
    await expect(page.getByLabel('Players per team per game')).toHaveValue('6');
  });

  test('stats dropdowns navigate to match, game, and player pages', async ({
    page,
  }) => {
    await loadSampleLeague(page);
    await navigateMenu(page, 'Stats');
    await expect(page.locator('.sk-stats-scope')).toBeVisible();

    await page.getByLabel('Match').click();
    await page.getByRole('option', { name: / vs\. / }).first().click();
    await expect(page.getByRole('heading', { name: /Match stats/ })).toBeVisible();

    await page.getByLabel('Game').click();
    await page.getByRole('option', { name: 'Game 1', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Game 1 stats/ })).toBeVisible();

    await page.getByLabel('Player').click();
    await page.getByRole('option', { name: /Frodo Baggins/ }).click();
    await expect(page.getByRole('heading', { name: 'Frodo Baggins', level: 1 })).toBeVisible();
  });

  test('opens match stats from the matches list', async ({ page }) => {
    await loadSampleLeague(page);
    await navigateMenu(page, 'Matches');
    await page.getByRole('button', { name: 'See stats' }).first().click();
    await expect(page.getByRole('heading', { name: /Match stats/ })).toBeVisible();
    await expect(page.locator('.sk-stats-series')).toBeVisible();
    await page.getByRole('tab', { name: 'Players' }).click();
    await expect(page.locator('.sk-stats-table')).toBeVisible();
    await expect(page.locator('.sk-stats-table tbody tr').first()).toBeVisible();
  });

  test('opens game stats from track match', async ({ page }) => {
    await loadSampleLeague(page);
    await navigateMenu(page, 'Matches');
    await page.getByRole('button', { name: / vs\. / }).first().click();
    await expect(page.getByRole('heading', { name: 'Match' })).toBeVisible();
    await page.getByRole('button', { name: 'Track Match' }).click();
    await expect(page.getByRole('heading', { name: 'Track Match' })).toBeVisible();
    await page.getByRole('button', { name: 'See stats' }).first().click();
    await expect(page.getByRole('heading', { name: /Game 1 stats/ })).toBeVisible();
    await expect(page.locator('.sk-stats-table')).toBeVisible();
    await page.getByRole('tab', { name: 'Charts' }).click();
    await expect(page.locator('.sk-stats-charts')).toBeVisible();
  });

  test('links a cross-team sub and toggles sub stats on league rollups', async ({
    page,
  }) => {
    await gotoScorekeeper(page);
    await addTeam(page, 'Home Hawks');
    await openTeam(page, 'Home Hawks');
    await addPlayer(page, 'H1');
    await addPlayer(page, 'Alex');
    await addTeam(page, 'Away Owls');
    await openTeam(page, 'Away Owls');
    await addPlayer(page, 'Casey');
    await createMatch(page, 'Home Hawks', 'Away Owls');

    const homeTeam = page.locator('.sk-match .sk-team').nth(0);
    await homeTeam.getByRole('button', { name: 'Alex', exact: true }).click();

    const awayTeam = page.locator('.sk-match .sk-team').nth(1);
    await awayTeam.getByLabel('Add player').click();
    await awayTeam.getByLabel('Add player').fill('Alex');
    await expect(page.getByRole('option', { name: /Alex · Home Hawks/ })).toBeVisible();
    await page.getByRole('option', { name: /Alex · Home Hawks/ }).click();
    await expect(awayTeam.getByRole('button', { name: 'Alex', exact: true })).toBeVisible();
    await expect(
      awayTeam.locator('.sk-player').filter({ hasText: 'Alex' }).locator('.sk-player-sub'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Track Match' }).click();
    await page.getByRole('button', { name: 'Add Game' }).click();
    await expect(page.getByRole('heading', { name: /^Game \d+$/ })).toBeVisible();

    await navigateMenu(page, 'Stats');
    await page.getByRole('tab', { name: 'Players' }).click();
    const alexRow = page.locator('.sk-stats-table tbody tr').filter({ hasText: 'Alex' });
    await expect(alexRow).toHaveCount(1);
    await expect(alexRow.locator('.sk-stats-player-sub')).toContainText('Alex*');
    expect(Number(await alexRow.locator('td').nth(2).textContent())).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Exclude sub stats' }).click();
    await expect(page.locator('.sk-stats-table tbody tr').filter({ hasText: 'Alex' })).toHaveCount(
      0,
    );
  });
});
