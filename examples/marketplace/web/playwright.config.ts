import { defineConfig, devices } from '@playwright/test'

/**
 * E2E against the real app with the feed MOCKED (see tests/market.spec.ts) — deterministic, no devnet,
 * no LLM key. Playwright starts the Vite dev server itself.
 */
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://localhost:5173', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
