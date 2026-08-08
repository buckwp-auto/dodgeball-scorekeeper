"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LAST_SCORING_KEY = exports.STORAGE_KEY = void 0;
exports.clearScorekeeperStorage = clearScorekeeperStorage;
exports.gotoScorekeeper = gotoScorekeeper;
exports.loadSampleLeague = loadSampleLeague;
exports.navigateMenu = navigateMenu;
exports.addTeam = addTeam;
exports.openTeam = openTeam;
exports.addPlayer = addPlayer;
exports.selectMatchTeam = selectMatchTeam;
exports.createMatch = createMatch;
exports.toggleMatchPlayer = toggleMatchPlayer;
exports.selectMatchRoster = selectMatchRoster;
exports.addGame = addGame;
exports.openMatchFromList = openMatchFromList;
exports.selectGameRoster = selectGameRoster;
exports.fileInputForExtension = fileInputForExtension;
const test_1 = require("@playwright/test");
/** Session storage key for scorekeeper database JSON. */
exports.STORAGE_KEY = 'SCOREKEEPER_DATA';
/** Last game/match resume pointer (localStorage). */
exports.LAST_SCORING_KEY = 'SCOREKEEPER_LAST_SCORING';
async function clearScorekeeperStorage(page) {
    await page.addInitScript(([dataKey, lastScoringKey]) => {
        sessionStorage.removeItem(dataKey);
        localStorage.removeItem(lastScoringKey);
    }, [exports.STORAGE_KEY, exports.LAST_SCORING_KEY]);
}
async function gotoScorekeeper(page, subPath = '') {
    const path = subPath ? `/${subPath}` : '/';
    await page.goto(path);
    await (0, test_1.expect)(page.locator('.sk-layout')).toBeVisible({ timeout: 60_000 });
}
async function loadSampleLeague(page) {
    await gotoScorekeeper(page);
    await page.getByRole('button', { name: 'Load sample league (demo)' }).click();
    await (0, test_1.expect)(page.getByRole('button', { name: 'League stats' })).toBeVisible({
        timeout: 30_000,
    });
}
async function navigateMenu(page, menuLabel) {
    await page.locator('.sk-menu-link').filter({ hasText: menuLabel }).first().click();
}
async function addTeam(page, teamName) {
    await navigateMenu(page, 'Teams');
    await (0, test_1.expect)(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
    const row = page.locator('.form-one-line').first();
    await row.locator('input').fill(teamName);
    await row.locator('input').press('Enter');
    await (0, test_1.expect)(page.getByRole('button', { name: teamName })).toBeVisible();
}
async function openTeam(page, teamName) {
    await page.getByRole('button', { name: teamName }).click();
    await (0, test_1.expect)(page.getByRole('heading', { name: 'Team' })).toBeVisible();
}
async function addPlayer(page, playerName) {
    const input = page.locator('.form-one-line').first().locator('input');
    await input.click();
    await input.fill('');
    await input.pressSequentially(playerName, { delay: 20 });
    await input.press('Enter');
    await (0, test_1.expect)(page.getByRole('button', { name: playerName })).toBeVisible();
}
/** Select a team in the Home Team or Away Team column on the Matches page. */
async function selectMatchTeam(page, side, teamName) {
    const column = page.locator('.form-create .col').filter({ hasText: side });
    const search = column.locator('.bw-input-text-search input');
    await search.fill(teamName);
    await page.waitForTimeout(600);
    await column.locator('.bw-result').filter({ hasText: teamName }).click();
    await (0, test_1.expect)(column.getByRole('button', { name: teamName })).toBeVisible();
}
async function createMatch(page, homeTeam, awayTeam) {
    await navigateMenu(page, 'Matches');
    await (0, test_1.expect)(page.getByRole('heading', { name: 'Matches' })).toBeVisible();
    await selectMatchTeam(page, 'Home Team', homeTeam);
    await selectMatchTeam(page, 'Away Team', awayTeam);
    await page.getByRole('button', { name: 'Add Match' }).click();
    await (0, test_1.expect)(page.getByRole('heading', { name: 'Match' })).toBeVisible();
}
async function toggleMatchPlayer(page, playerName, _side) {
    await page
        .locator('.sk-match')
        .getByRole('button', { name: playerName, exact: true })
        .click();
    await page.waitForTimeout(250);
}
async function selectMatchRoster(page, homePlayer, awayPlayer) {
    const trackMatch = page.getByRole('button', { name: 'Track Match' });
    const homeBtn = page
        .locator('.sk-match .sk-team')
        .nth(0)
        .getByRole('button', { name: homePlayer, exact: true });
    const awayBtn = page
        .locator('.sk-match .sk-team')
        .nth(1)
        .getByRole('button', { name: awayPlayer, exact: true });
    await test_1.expect
        .poll(async () => {
        if (await trackMatch.isEnabled())
            return true;
        await homeBtn.click();
        await page.waitForTimeout(300);
        if (await trackMatch.isEnabled())
            return true;
        await awayBtn.click();
        await page.waitForTimeout(300);
        if (await trackMatch.isEnabled())
            return true;
        await homeBtn.click();
        await awayBtn.click();
        await page.waitForTimeout(300);
        return trackMatch.isEnabled();
    }, { timeout: 15_000 })
        .toBe(true);
}
async function addGame(page) {
    await page.getByRole('button', { name: 'Track Match' }).click();
    await (0, test_1.expect)(page.getByRole('heading', { name: 'Track Match' })).toBeVisible();
    await page.getByRole('button', { name: 'Add Game' }).click();
    await (0, test_1.expect)(page.getByRole('heading', { name: 'Game' })).toBeVisible();
}
async function openMatchFromList(page, matchLabel) {
    await navigateMenu(page, 'Matches');
    await page.getByRole('button', { name: matchLabel, exact: true }).click();
    await (0, test_1.expect)(page.getByRole('heading', { name: 'Match' })).toBeVisible();
}
async function selectGameRoster(page, homePlayer, awayPlayer) {
    const trackGame = page.getByRole('button', { name: 'Track Game' });
    const homeBtn = page
        .locator('.sk-game .sk-team')
        .nth(0)
        .getByRole('button', { name: homePlayer, exact: true });
    const awayBtn = page
        .locator('.sk-game .sk-team')
        .nth(1)
        .getByRole('button', { name: awayPlayer, exact: true });
    await test_1.expect
        .poll(async () => {
        if (await trackGame.isEnabled())
            return true;
        await homeBtn.click();
        await page.waitForTimeout(300);
        if (await trackGame.isEnabled())
            return true;
        await awayBtn.click();
        await page.waitForTimeout(300);
        if (await trackGame.isEnabled())
            return true;
        await homeBtn.click();
        await awayBtn.click();
        await page.waitForTimeout(300);
        return trackGame.isEnabled();
    }, { timeout: 15_000 })
        .toBe(true);
}
function fileInputForExtension(page, extension) {
    return page.locator(`input[type="file"][accept="${extension}"]`);
}
