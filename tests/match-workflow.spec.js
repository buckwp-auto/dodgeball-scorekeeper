"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const scorekeeper_page_1 = require("./helpers/scorekeeper-page");
test_1.test.describe('Match workflow', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await (0, scorekeeper_page_1.clearScorekeeperStorage)(page);
    });
    (0, test_1.test)('creates teams, match, and records history', async ({ page }) => {
        await (0, scorekeeper_page_1.gotoScorekeeper)(page);
        await (0, scorekeeper_page_1.addTeam)(page, 'Home Hawks');
        await (0, scorekeeper_page_1.openTeam)(page, 'Home Hawks');
        await (0, scorekeeper_page_1.addPlayer)(page, 'H1');
        await (0, scorekeeper_page_1.addTeam)(page, 'Away Owls');
        await (0, scorekeeper_page_1.openTeam)(page, 'Away Owls');
        await (0, scorekeeper_page_1.addPlayer)(page, 'A1');
        await (0, scorekeeper_page_1.createMatch)(page, 'Home Hawks', 'Away Owls');
        await (0, scorekeeper_page_1.navigateMenu)(page, 'History');
        await (0, test_1.expect)(page.getByRole('heading', { name: 'History' })).toBeVisible();
        await (0, test_1.expect)(page.locator('.history')).toContainText('Added team (Home Hawks)');
        await (0, test_1.expect)(page.locator('.history')).toContainText('Added team (Away Owls)');
        await (0, test_1.expect)(page.locator('.history')).toContainText('Added match');
    });
});
// Full roster + game event tracking: see selectMatchRoster helper (used when React parity lands).
