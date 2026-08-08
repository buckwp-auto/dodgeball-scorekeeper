"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const scorekeeper_page_1 = require("./helpers/scorekeeper-page");
test_1.test.describe('Match statistics CSV', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await (0, scorekeeper_page_1.clearScorekeeperStorage)(page);
    });
    (0, test_1.test)('downloads CSV with statistics column headers', async ({ page }) => {
        await (0, scorekeeper_page_1.gotoScorekeeper)(page);
        await (0, scorekeeper_page_1.addTeam)(page, 'Stat Home');
        await (0, scorekeeper_page_1.openTeam)(page, 'Stat Home');
        await (0, scorekeeper_page_1.addPlayer)(page, 'Pat');
        await (0, scorekeeper_page_1.addTeam)(page, 'Stat Away');
        await (0, scorekeeper_page_1.openTeam)(page, 'Stat Away');
        await (0, scorekeeper_page_1.addPlayer)(page, 'Quinn');
        await (0, scorekeeper_page_1.createMatch)(page, 'Stat Home', 'Stat Away');
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download Match Statistics' }).click();
        const download = await downloadPromise;
        (0, test_1.expect)(download.suggestedFilename()).toMatch(/Statistics\.csv$/);
        const tempDir = await promises_1.default.mkdtemp(path_1.default.join(os_1.default.tmpdir(), 'stats-'));
        const filePath = path_1.default.join(tempDir, 'stats.csv');
        await download.saveAs(filePath);
        const csv = await promises_1.default.readFile(filePath, 'utf-8');
        (0, test_1.expect)(csv).toContain('"Team"');
        (0, test_1.expect)(csv).toContain('"Player"');
        (0, test_1.expect)(csv).toContain('********** Matches');
        (0, test_1.expect)(csv).toContain('********** Kills (Direct) (Individual)');
    });
});
