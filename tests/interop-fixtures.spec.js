"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const test_1 = require("@playwright/test");
const scorekeeper_page_1 = require("./helpers/scorekeeper-page");
const fixturesDir = path_1.default.join(process.cwd(), 'tests', 'fixtures');
function fixturePath(name) {
    return path_1.default.join(fixturesDir, name);
}
function matchLabelFromFixture(name) {
    const raw = (0, fs_1.readFileSync)(fixturePath(name), 'utf-8');
    const data = JSON.parse(raw);
    const teams = new Map(data.Tables.Team.map((team) => [team.Id, team.Name]));
    const match = data.Tables.Match[0];
    return `${teams.get(match.TeamIdHome)} vs. ${teams.get(match.TeamIdAway)}`;
}
test_1.test.describe('Interop fixtures (.scrkpr)', () => {
    (0, test_1.test)('loads reference fixture in app', async ({ page }) => {
        await (0, scorekeeper_page_1.gotoScorekeeper)(page);
        await (0, scorekeeper_page_1.navigateMenu)(page, 'Overview');
        await page.getByRole('button', { name: 'Load from file', exact: true }).click();
        await (0, scorekeeper_page_1.fileInputForExtension)(page, '.scrkpr').setInputFiles(fixturePath('interop-basic.scrkpr'));
        await (0, scorekeeper_page_1.navigateMenu)(page, 'Teams');
        await (0, test_1.expect)(page.getByRole('button', { name: 'Home Hawks' })).toBeVisible();
        await (0, test_1.expect)(page.getByRole('button', { name: 'Away Owls' })).toBeVisible();
        await (0, scorekeeper_page_1.openTeam)(page, 'Home Hawks');
        await (0, test_1.expect)(page.getByRole('button', { name: 'H1' })).toBeVisible();
        await (0, scorekeeper_page_1.navigateMenu)(page, 'Matches');
        await (0, test_1.expect)(page.getByRole('button', { name: matchLabelFromFixture('interop-basic.scrkpr') })).toBeVisible();
    });
    (0, test_1.test)('CSV matches golden for basic fixture', async ({ page }) => {
        const golden = (0, fs_1.readFileSync)(fixturePath('interop-basic.golden.csv'), 'utf-8');
        const fixtureJson = (0, fs_1.readFileSync)(fixturePath('interop-basic.scrkpr'), 'utf-8');
        await page.addInitScript(({ key, json }) => {
            sessionStorage.setItem(key, json);
        }, { key: scorekeeper_page_1.STORAGE_KEY, json: fixtureJson });
        await (0, scorekeeper_page_1.gotoScorekeeper)(page);
        await (0, scorekeeper_page_1.navigateMenu)(page, 'Matches');
        await page.getByRole('button', { name: matchLabelFromFixture('interop-basic.scrkpr') }).click();
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download Match Statistics' }).click();
        const download = await downloadPromise;
        const csvPath = path_1.default.join(fixturesDir, '.tmp-react-basic.csv');
        await download.saveAs(csvPath);
        const actual = (0, fs_1.readFileSync)(csvPath, 'utf-8');
        (0, test_1.expect)(actual).toBe(golden);
    });
    (0, test_1.test)('loads reference throw fixture', async ({ page }) => {
        await (0, scorekeeper_page_1.gotoScorekeeper)(page);
        await (0, scorekeeper_page_1.navigateMenu)(page, 'Overview');
        await page.getByRole('button', { name: 'Load from file', exact: true }).click();
        await (0, scorekeeper_page_1.fileInputForExtension)(page, '.scrkpr').setInputFiles(fixturePath('interop-with-throw.scrkpr'));
        await (0, scorekeeper_page_1.navigateMenu)(page, 'Matches');
        await page
            .getByRole('button', { name: matchLabelFromFixture('interop-with-throw.scrkpr') })
            .click();
        await (0, test_1.expect)(page.getByRole('button', { name: 'Track Match' })).toBeEnabled();
    });
    (0, test_1.test)('CSV matches golden for throw fixture', async ({ page }) => {
        const golden = (0, fs_1.readFileSync)(fixturePath('interop-with-throw.golden.csv'), 'utf-8');
        const fixtureJson = (0, fs_1.readFileSync)(fixturePath('interop-with-throw.scrkpr'), 'utf-8');
        await page.addInitScript(({ key, json }) => {
            sessionStorage.setItem(key, json);
        }, { key: scorekeeper_page_1.STORAGE_KEY, json: fixtureJson });
        await (0, scorekeeper_page_1.gotoScorekeeper)(page);
        await (0, scorekeeper_page_1.navigateMenu)(page, 'Matches');
        await page
            .getByRole('button', { name: matchLabelFromFixture('interop-with-throw.scrkpr') })
            .click();
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download Match Statistics' }).click();
        const download = await downloadPromise;
        const csvPath = path_1.default.join(fixturesDir, '.tmp-react-throw.csv');
        await download.saveAs(csvPath);
        const actual = (0, fs_1.readFileSync)(csvPath, 'utf-8');
        (0, test_1.expect)(actual).toBe(golden);
    });
});
