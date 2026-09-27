import { defineConfig, devices } from '@playwright/test'

const API_PORT = 8001
const WEB_PORT = 5174

/**
 * End-to-end tests run the real stack: FastAPI on a fresh, migrated and seeded database
 * (SQLite by default), plus the Vite dev server proxying /api to it.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'rm -f e2e.db && uv run alembic upgrade head && uv run python -m app.seed --reset && ' +
        `uv run uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: '../backend',
      // Set E2E_DATABASE_URL to run against PostgreSQL (the database is reset and re-seeded).
      env: { DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'sqlite:///./e2e.db' },
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
