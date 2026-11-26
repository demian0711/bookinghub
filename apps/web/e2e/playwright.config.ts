import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: ['booking.spec.ts', 'staff.spec.ts', 'admin.spec.ts'],
  workers: 1,
  timeout: 60000,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../playwright-report', open: 'never' }],
  ],
  outputDir: '../test-results',
  use: {
    baseURL: process.env.E2E_ORIGIN,
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    locale: 'vi-VN',
    timezoneId: 'America/Los_Angeles',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
