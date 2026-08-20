import process from 'node:process';
import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is required for production E2E.');

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*-production.spec.js', '**/phase-1-communication.spec.js', '**/phase-2-admin-scheduling.spec.js', '**/p1-02.spec.js', '**/val-01.spec.js', '**/p1-03.spec.js', '**/p1-04.spec.js', '**/ui-wa-01.spec.js', '**/ref-01.spec.js', '**/p2-01.spec.js', '**/p2-02.spec.js', '**/p2-03.spec.js', '**/p2-04.spec.js', '**/p2-05.spec.js', '**/p2-06.spec.js', '**/leg-01.spec.js', '**/leg-02.spec.js', '**/leg-03.spec.js', '**/leg-04.spec.js', '**/leg-05.spec.js', '**/leg-06.spec.js', '**/leg-07.spec.js'],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL,
    bypassCSP: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
