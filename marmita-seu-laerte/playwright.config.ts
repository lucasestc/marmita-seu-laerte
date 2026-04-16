import { defineConfig } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') })

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // keep sequential — concurrent test is sensitive to parallelism
  retries: 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3000',
    // Don't launch a browser for API tests — only for e2e specs that call page.goto()
  },

  projects: [
    {
      name: 'e2e',
      testMatch: 'tests/e2e/**/*.spec.ts',
      use: {
        channel: 'chromium',
      },
    },
    {
      name: 'api',
      testMatch: 'tests/api/**/*.spec.ts',
    },
    {
      name: 'concurrent',
      testMatch: 'tests/concurrent/**/*.spec.ts',
    },
  ],

  // Start the Next.js app before running tests
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][],
      ),
    },
    timeout: 120_000,
  },
})
