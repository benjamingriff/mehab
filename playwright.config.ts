import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
export default defineConfig({
  testDir: 'tests',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:8081',
    viewport: { width: 390, height: 844 },
    headless: true,
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ??
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'npm run dev:web',
      url: 'http://localhost:8081',
      reuseExistingServer: true,
      timeout: 90000,
    },
  ],
  reporter: 'list',
});
