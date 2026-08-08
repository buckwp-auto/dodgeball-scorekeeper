"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const scorekeeper_page_1 = require("./helpers/scorekeeper-page");
test_1.test.describe('In-app stats', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await (0, scorekeeper_page_1.clearScorekeeperStorage)(page);
    });
    (0, test_1.test)('opens league stats from the drawer after loading the sample', async ({ page, }) => {
        await (0, scorekeeper_page_1.loadSampleLeague)(page);
        await (0, scorekeeper_page_1.navigateMenu)(page, 'Stats');
        await (0, test_1.expect)(page.getByRole('heading', { name: /stats/i })).toBeVisible();
        await (0, test_1.expect)(page.getByRole('tab', { name: 'Standings' })).toBeVisible();
        await (0, test_1.expect)(page.locator('.sk-stats-standings')).toContainText('The Fellowship');
        await page.getByRole('tab', { name: 'Players' }).click();
        await (0, test_1.expect)(page.locator('.sk-stats-table')).toContainText('Frodo Baggins');
    });
    (0, test_1.test)('opens match stats from the matches list', async ({ page }) => {
        await (0, scorekeeper_page_1.loadSampleLeague)(page);
        await (0, scorekeeper_page_1.navigateMenu)(page, 'Matches');
        await page.getByRole('button', { name: 'See stats' }).first().click();
        await (0, test_1.expect)(page.getByRole('heading', { name: /Match stats/ })).toBeVisible();
        await (0, test_1.expect)(page.locator('.sk-stats-series')).toBeVisible();
        await page.getByRole('tab', { name: 'Players' }).click();
        await (0, test_1.expect)(page.locator('.sk-stats-table')).toBeVisible();
        await (0, test_1.expect)(page.locator('.sk-stats-table tbody tr').first()).toBeVisible();
    });
    (0, test_1.test)('opens game stats from track match', async ({ page }) => {
        await (0, scorekeeper_page_1.loadSampleLeague)(page);
        await (0, scorekeeper_page_1.navigateMenu)(page, 'Matches');
        await page.getByRole('button', { name: / vs\. / }).first().click();
        await (0, test_1.expect)(page.getByRole('heading', { name: 'Match' })).toBeVisible();
        await page.getByRole('button', { name: 'Track Match' }).click();
        await (0, test_1.expect)(page.getByRole('heading', { name: 'Track Match' })).toBeVisible();
        await page.getByRole('button', { name: 'See stats' }).first().click();
        await (0, test_1.expect)(page.getByRole('heading', { name: /Game 1 stats/ })).toBeVisible();
        await (0, test_1.expect)(page.locator('.sk-stats-table')).toBeVisible();
        await page.getByRole('tab', { name: 'Charts' }).click();
        await (0, test_1.expect)(page.locator('.sk-stats-charts')).toBeVisible();
    });
});
