import { readFileSync } from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import {
  fileInputForExtension,
  gotoScorekeeper,
  navigateMenu,
  openTeam,
  STORAGE_KEY,
} from './helpers/scorekeeper-page';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

function fixturePath(name: string) {
  return path.join(fixturesDir, name);
}

function matchLabelFromFixture(name: string): string {
  const raw = readFileSync(fixturePath(name), 'utf-8');
  const data = JSON.parse(raw) as {
    Tables: {
      Team: { Id: string; Name: string }[];
      Match: { TeamIdHome: string; TeamIdAway: string }[];
    };
  };
  const teams = new Map(data.Tables.Team.map((team) => [team.Id, team.Name]));
  const match = data.Tables.Match[0];
  return `${teams.get(match.TeamIdHome)} vs. ${teams.get(match.TeamIdAway)}`;
}

test.describe('Interop fixtures (.scrkpr)', () => {
  test('loads reference fixture in app', async ({ page }) => {
    await gotoScorekeeper(page);
    await navigateMenu(page, 'Overview');
    await page.getByRole('button', { name: 'Load from file', exact: true }).click();
    await fileInputForExtension(page, '.scrkpr').setInputFiles(fixturePath('interop-basic.scrkpr'));

    await navigateMenu(page, 'Teams');
    await expect(page.getByRole('button', { name: 'Home Hawks' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Away Owls' })).toBeVisible();
    await openTeam(page, 'Home Hawks');
    await expect(page.getByRole('button', { name: 'H1' })).toBeVisible();

    await navigateMenu(page, 'Matches');
    await expect(
      page.getByRole('button', {
        name: matchLabelFromFixture('interop-basic.scrkpr'),
        exact: true,
      }),
    ).toBeVisible();
  });

  test('CSV matches golden for basic fixture', async ({ page }) => {
    const golden = readFileSync(fixturePath('interop-basic.golden.csv'), 'utf-8');
    const fixtureJson = readFileSync(fixturePath('interop-basic.scrkpr'), 'utf-8');

    await page.addInitScript(
      ({ key, json }) => {
        sessionStorage.setItem(key, json);
      },
      { key: STORAGE_KEY, json: fixtureJson },
    );

    await gotoScorekeeper(page);
    await navigateMenu(page, 'Matches');
    await page.getByRole('button', {
      name: matchLabelFromFixture('interop-basic.scrkpr'),
      exact: true,
    }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Match Statistics' }).click();
    const download = await downloadPromise;
    const csvPath = path.join(fixturesDir, '.tmp-react-basic.csv');
    await download.saveAs(csvPath);
    const actual = readFileSync(csvPath, 'utf-8');
    expect(actual).toBe(golden);
  });

  test('loads reference throw fixture', async ({ page }) => {
    await gotoScorekeeper(page);
    await navigateMenu(page, 'Overview');
    await page.getByRole('button', { name: 'Load from file', exact: true }).click();
    await fileInputForExtension(page, '.scrkpr').setInputFiles(
      fixturePath('interop-with-throw.scrkpr'),
    );

    await navigateMenu(page, 'Matches');
    await page
      .getByRole('button', {
        name: matchLabelFromFixture('interop-with-throw.scrkpr'),
        exact: true,
      })
      .click();
    await expect(page.getByRole('button', { name: 'Track Match' })).toBeEnabled();
  });

  test('CSV matches golden for throw fixture', async ({ page }) => {
    const golden = readFileSync(fixturePath('interop-with-throw.golden.csv'), 'utf-8');
    const fixtureJson = readFileSync(fixturePath('interop-with-throw.scrkpr'), 'utf-8');

    await page.addInitScript(
      ({ key, json }) => {
        sessionStorage.setItem(key, json);
      },
      { key: STORAGE_KEY, json: fixtureJson },
    );

    await gotoScorekeeper(page);
    await navigateMenu(page, 'Matches');
    await page
      .getByRole('button', {
        name: matchLabelFromFixture('interop-with-throw.scrkpr'),
        exact: true,
      })
      .click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Match Statistics' }).click();
    const download = await downloadPromise;
    const csvPath = path.join(fixturesDir, '.tmp-react-throw.csv');
    await download.saveAs(csvPath);
    const actual = readFileSync(csvPath, 'utf-8');
    expect(actual).toBe(golden);
  });
});
