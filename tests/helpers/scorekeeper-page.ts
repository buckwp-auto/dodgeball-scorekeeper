import { expect, type Locator, type Page } from '@playwright/test';

/** Session storage key for scorekeeper database JSON. */
export const STORAGE_KEY = 'SCOREKEEPER_DATA';
/** Last game/match resume pointer (localStorage). */
export const LAST_SCORING_KEY = 'SCOREKEEPER_LAST_SCORING';
/** Appearance preference (localStorage): system / light / dark. */
export const COLOR_MODE_KEY = 'SCOREKEEPER_COLOR_MODE';
/** Onboarding tour completion (localStorage). */
export const ONBOARDING_COMPLETE_KEY = 'SCOREKEEPER_ONBOARDING_COMPLETE';
/** Matches-list score spoiler (session): revealed match ids. */
export const MATCH_SCORE_REVEALED_KEY = 'SCOREKEEPER_MATCH_SCORE_REVEALED';

export async function clearScorekeeperStorage(page: Page) {
  await page.addInitScript(
    ([dataKey, lastScoringKey, colorModeKey, matchScoreKey, onboardingKey]) => {
      sessionStorage.removeItem(dataKey);
      sessionStorage.removeItem(matchScoreKey);
      localStorage.removeItem(lastScoringKey);
      localStorage.removeItem(colorModeKey);
      localStorage.removeItem(onboardingKey);
    },
    [STORAGE_KEY, LAST_SCORING_KEY, COLOR_MODE_KEY, MATCH_SCORE_REVEALED_KEY, ONBOARDING_COMPLETE_KEY],
  );
}

export async function gotoScorekeeper(page: Page, subPath = '') {
  const path = subPath ? `/${subPath}` : '/';
  await page.goto(path);
  await expect(page.locator('.sk-layout')).toBeVisible({ timeout: 60_000 });
}

export async function loadSampleLeague(page: Page) {
  await gotoScorekeeper(page);
  await page.getByRole('button', { name: 'Load sample league (demo)' }).click();
  await expect(page.getByRole('button', { name: 'League stats' })).toBeVisible({
    timeout: 30_000,
  });
}

export async function navigateMenu(page: Page, menuLabel: string) {
  await page.locator('.sk-menu-link').filter({ hasText: menuLabel }).first().click();
}

export async function addTeam(page: Page, teamName: string) {
  await navigateMenu(page, 'Teams');
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
  const row = page.locator('.form-one-line').first();
  await row.locator('input').fill(teamName);
  await row.locator('input').press('Enter');
  await expect(page.getByRole('button', { name: teamName })).toBeVisible();
}

export async function openTeam(page: Page, teamName: string) {
  await page.getByRole('button', { name: teamName }).click();
  await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
}

export async function addPlayer(page: Page, playerName: string) {
  const input = page.locator('.form-one-line').first().locator('input');
  await input.click();
  await input.fill('');
  await input.pressSequentially(playerName, { delay: 20 });
  await input.press('Enter');
  await expect(page.getByRole('button', { name: playerName })).toBeVisible();
}

/** Select a team in the Home Team or Away Team column on the Matches page. */
export async function selectMatchTeam(
  page: Page,
  side: 'Home Team' | 'Away Team',
  teamName: string,
) {
  const column = page.locator('.form-create .col').filter({ hasText: side });
  const search = column.locator('.bw-input-text-search input');
  await search.fill(teamName);
  await page.waitForTimeout(600);
  await column.locator('.bw-result').filter({ hasText: teamName }).click();
  await expect(column.getByRole('button', { name: teamName })).toBeVisible();
}

export async function createMatch(page: Page, homeTeam: string, awayTeam: string) {
  await navigateMenu(page, 'Matches');
  await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible();
  await selectMatchTeam(page, 'Home Team', homeTeam);
  await selectMatchTeam(page, 'Away Team', awayTeam);
  await page.getByRole('button', { name: 'Add Match' }).click();
  await expect(page.getByRole('heading', { name: 'Match' })).toBeVisible();
}

export async function toggleMatchPlayer(
  page: Page,
  playerName: string,
  _side: 'Home Team' | 'Away Team',
) {
  await page
    .locator('.sk-match')
    .getByRole('button', { name: playerName, exact: true })
    .click();
  await page.waitForTimeout(250);
}

export async function selectMatchRoster(
  page: Page,
  homePlayer: string,
  awayPlayer: string,
) {
  const trackMatch = page.getByRole('button', { name: 'Track Match' });
  const homeBtn = page
    .locator('.sk-match .sk-team')
    .nth(0)
    .getByRole('button', { name: homePlayer, exact: true });
  const awayBtn = page
    .locator('.sk-match .sk-team')
    .nth(1)
    .getByRole('button', { name: awayPlayer, exact: true });

  await expect
    .poll(
      async () => {
        if (await trackMatch.isEnabled()) return true;
        await homeBtn.click();
        await page.waitForTimeout(300);
        if (await trackMatch.isEnabled()) return true;
        await awayBtn.click();
        await page.waitForTimeout(300);
        if (await trackMatch.isEnabled()) return true;
        await homeBtn.click();
        await awayBtn.click();
        await page.waitForTimeout(300);
        return trackMatch.isEnabled();
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

export async function addGame(page: Page) {
  await page.getByRole('button', { name: 'Track Match' }).click();
  await expect(page.getByRole('heading', { name: 'Track Match' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Game' }).click();
  await expect(page.getByRole('heading', { name: /^Game \d+$/ })).toBeVisible();
}

export async function openMatchFromList(page: Page, matchLabel: string) {
  await navigateMenu(page, 'Matches');
  await page.getByRole('button', { name: matchLabel, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match' })).toBeVisible();
}

export async function selectGameRoster(
  page: Page,
  homePlayer: string,
  awayPlayer: string,
) {
  const trackGame = page.getByRole('button', { name: 'Track Game' });
  const homeBtn = page
    .locator('.sk-game .sk-team')
    .nth(0)
    .getByRole('button', { name: homePlayer, exact: true });
  const awayBtn = page
    .locator('.sk-game .sk-team')
    .nth(1)
    .getByRole('button', { name: awayPlayer, exact: true });

  await expect
    .poll(
      async () => {
        if (await trackGame.isEnabled()) return true;
        await homeBtn.click();
        await page.waitForTimeout(300);
        if (await trackGame.isEnabled()) return true;
        await awayBtn.click();
        await page.waitForTimeout(300);
        if (await trackGame.isEnabled()) return true;
        await homeBtn.click();
        await awayBtn.click();
        await page.waitForTimeout(300);
        return trackGame.isEnabled();
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

export function fileInputForExtension(page: Page, extension: string): Locator {
  return page.locator(`input[type="file"][accept="${extension}"]`);
}
