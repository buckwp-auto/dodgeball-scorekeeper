"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const scorekeeper_page_1 = require("./helpers/scorekeeper-page");
const database_1 = require("../react-app/src/domain/database");
const matchGame_1 = require("../react-app/src/domain/matchGame");
const gameEvents_1 = require("../react-app/src/domain/gameEvents");
const hotkeys_1 = require("../react-app/src/domain/hotkeys");
const constants_1 = require("../react-app/src/domain/statistics/constants");
/** A1 hits H1, so H1 is out while the ball he already released is still live. */
function seedGameWithOutHomePlayer() {
    const data = (0, database_1.createEmptyDatabase)();
    const home = (0, database_1.addTeam)(data, 'Home Hawks');
    const away = (0, database_1.addTeam)(data, 'Away Owls');
    const homePlayers = ['H1', 'H2'].map((name) => (0, database_1.addPlayer)(data, home.Id, name));
    const awayPlayers = ['A1', 'A2', 'A3'].map((name) => (0, database_1.addPlayer)(data, away.Id, name));
    const match = (0, database_1.addMatch)(data, home.Id, away.Id);
    for (const player of homePlayers)
        (0, matchGame_1.toggleMatchPlayer)(data, match.Id, player.Id, true);
    for (const player of awayPlayers)
        (0, matchGame_1.toggleMatchPlayer)(data, match.Id, player.Id, false);
    const gameId = (0, matchGame_1.addGame)(data, match.Id);
    for (const player of [...homePlayers, ...awayPlayers]) {
        (0, matchGame_1.toggleGamePlayer)(data, match.Id, gameId, player.Id);
    }
    const infos = (0, gameEvents_1.getGamePlayerInfos)(data, match.Id, gameId);
    const gamePlayerId = (name) => infos.find((row) => row.playerName === name).gamePlayerId;
    (0, gameEvents_1.persistThrowGameEvent)(data, gameId, match.Id, [
        {
            throwerGamePlayerId: gamePlayerId('A1'),
            targetGamePlayerId: gamePlayerId('H1'),
            resultId: constants_1.ThrowResult.Hit,
            deflections: [],
            recoveredId: undefined,
        },
    ], { videoOffsetSeconds: 10 });
    const hotkeys = (0, hotkeys_1.buildPermanentPlayerHotkeys)(infos);
    return {
        data,
        matchId: match.Id,
        gameId,
        hotkeyFor: (name) => hotkeys.get(gamePlayerId(name)),
    };
}
test_1.test.describe('Simultaneous throws', () => {
    (0, test_1.test)('groups a second throw onto the throwing team, even from a player who is out', async ({ page, }) => {
        const { data, matchId, gameId, hotkeyFor } = seedGameWithOutHomePlayer();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error));
        await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), { key: scorekeeper_page_1.STORAGE_KEY, value: (0, database_1.serializeDatabase)(data) });
        await page.goto(`/matches/${matchId}/games/${gameId}/events`);
        await (0, test_1.expect)(page.locator('.sk-editor-grid').first()).toBeVisible();
        // H1 is out but still throwing the ball he released as he was hit
        await (0, test_1.expect)(page.getByRole('button', { name: /H1 \(out\)/ })).toBeVisible();
        await page.keyboard.press(hotkeyFor('H1'));
        await page.keyboard.press(hotkeyFor('A2'));
        await page.keyboard.press((0, hotkeys_1.hotkeyForResult)(constants_1.ThrowResult.Hit));
        await (0, test_1.expect)(page.getByRole('button', { name: 'Add Team Throw' })).toBeVisible();
        await page.keyboard.press('c');
        // Away is defending, so A3's key targets him instead of making him a thrower
        await page.keyboard.press(hotkeyFor('A3'));
        await page.keyboard.press(hotkeyFor('H2'));
        await page.keyboard.press((0, hotkeys_1.hotkeyForResult)(constants_1.ThrowResult.Hit));
        const timeline = page.locator('.sk-game-timeline');
        await (0, test_1.expect)(timeline).toContainText('H1');
        await (0, test_1.expect)(timeline).toContainText('H2');
        await (0, test_1.expect)(timeline).toContainText('A3');
        await (0, test_1.expect)(page.getByText('Group throwers must be on the same team')).toHaveCount(0);
        (0, test_1.expect)(pageErrors).toEqual([]);
    });
});
