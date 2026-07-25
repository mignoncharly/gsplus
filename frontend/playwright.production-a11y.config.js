import process from 'node:process';
import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is required for production accessibility testing.');

export default defineConfig({
  testDir: './e2e',
  testMatch: 'phase-7.spec.js',
  grep: /pass axe/,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL,
    bypassCSP: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-a11y', use: { browserName: 'chromium' } },
  ],
});
