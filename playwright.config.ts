import { defineConfig } from '@playwright/test';
import 'dotenv/config';

// Set PLAYWRIGHT_BASE_URL=http://localhost:8080 for Docker testing
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const useDevServer = baseURL.includes('5173');

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  timeout: 180_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  // Only start dev server when testing against dev (not Docker)
  ...(useDevServer
    ? {
        webServer: {
          command: 'npm run dev',
          port: 5173,
          reuseExistingServer: true,
          timeout: 30_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      }
    : {}),
});
