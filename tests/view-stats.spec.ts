import { expect, test } from '@playwright/test';

const VIEWER_ONBOARDING_KEY = 'SCOREKEEPER_VIEWER_ONBOARDING_COMPLETE';
const SCOREKEEPER_ONBOARDING_KEY = 'SCOREKEEPER_ONBOARDING_COMPLETE';

test.describe('read-only stats viewer shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ([viewerKey, scorekeeperKey]) => {
        window.localStorage.setItem(viewerKey, '1');
        window.localStorage.setItem(scorekeeperKey, '1');
      },
      [VIEWER_ONBOARDING_KEY, SCOREKEEPER_ONBOARDING_KEY],
    );
  });

  test('shows League stats nav without scorekeeper links', async ({ page }) => {
    await page.goto('/view-stats');

    await expect(page.getByRole('heading', { level: 1, name: 'League stats' })).toBeVisible();
    await expect(page.locator('.sk-viewer-nav')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Leagues' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Stats' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Players' })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Overview' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Teams' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Matches' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'League Stat Settings' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Stats' }).click();
    await expect(page).toHaveURL(/\/view-stats\/stats$/);
    await expect(page.locator('.sk-viewer-stats-empty')).toBeVisible();

    await page.getByRole('link', { name: 'Players' }).click();
    await expect(page).toHaveURL(/\/view-stats\/players$/);
    await expect(page.locator('.sk-viewer-players')).toBeVisible();
  });

  test('does not redirect new visitors to the scorekeeper overview', async ({
    page,
  }) => {
    await page.addInitScript((scorekeeperKey) => {
      window.localStorage.removeItem(scorekeeperKey);
    }, SCOREKEEPER_ONBOARDING_KEY);

    await page.goto('/view-stats');
    await page.waitForTimeout(600);

    await expect(page).toHaveURL(/\/view-stats\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: 'League stats' })).toBeVisible();
    await expect(page.locator('.sk-onboarding-tour')).toHaveCount(0);
  });

  test('viewer tour stays inside /view-stats', async ({ page }) => {
    await page.addInitScript((viewerKey) => {
      window.localStorage.removeItem(viewerKey);
    }, VIEWER_ONBOARDING_KEY);

    await page.goto('/view-stats');
    await expect(page.locator('.sk-viewer-onboarding-tour')).toBeVisible({
      timeout: 5000,
    });
    await expect(page).toHaveURL(/\/view-stats/);

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\/view-stats/);
    await expect(page.locator('.sk-viewer-onboarding-tour')).toBeVisible();
  });
});
