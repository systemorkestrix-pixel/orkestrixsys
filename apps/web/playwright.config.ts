import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'line',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4174',
    locale: 'ar',
    colorScheme: 'light',
  },
  webServer: {
    command: 'node ../../apps/api/dist/server.js',
    url: 'http://127.0.0.1:4174/api/health',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      PORT: '4174',
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      ORKESTRIX_DATABASE_PATH: './apps/api/data/e2e.sqlite',
      ORKESTRIX_UPLOADS_PATH: './apps/api/uploads/e2e',
      ORKESTRIX_BOOTSTRAP_ADMIN_EMAIL: 'admin@orkestrix.test',
      ORKESTRIX_BOOTSTRAP_ADMIN_PASSWORD: 'e2e-admin-password-2026',
    },
  },
});
