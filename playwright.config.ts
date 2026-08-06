import { defineConfig, devices } from '@playwright/test';

const reactPort = process.env.SCOREKEEPER_REACT_PORT ?? '5180';
const reactBaseUrl = `http://127.0.0.1:${reactPort}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: reactBaseUrl,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', testMatch: /.*\.spec\.ts/ }],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${reactPort}`,
    cwd: './react-app',
    url: `${reactBaseUrl}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
