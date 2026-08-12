import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests, covering what jsdom structurally cannot.
 *
 * jsdom has no layout engine, so it cannot answer the questions that carry the most risk in this
 * module: does elementFromPoint resolve the element the cursor is visually over, does that survive
 * a CSS transform, and does the cursor overlay stay out of its own way. Those are exactly the bugs
 * that would waste an evening on a tablet, so they are checked here against real Chromium first.
 *
 * The built bundle is what is tested, not the source, because the bundle is what ships.
 */
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] === undefined ? 'list' : [['list'], ['github']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /*
         * ⚠️ Honours PLAYWRIGHT_CHANNEL, exactly as the live Foundry harnesses in scripts/ do, and
         * it did not until 2026-08-13. Without it a machine with Chrome installed but no downloaded
         * Chromium could run every harness and not this suite, which is the confusing half of a
         * split: the same command works for one runner and fails for the other with a message about
         * a missing headless_shell.exe.
         *
         * Unset, Playwright uses its own bundled build, which is what CI does and should keep doing.
         */
        ...(process.env['PLAYWRIGHT_CHANNEL'] === undefined
          ? {}
          : { channel: process.env['PLAYWRIGHT_CHANNEL'] }),
      },
    },
  ],
  // Serves the repo root, so the fixture can load the real dist output over http rather than
  // file://, which module imports require.
  webServer: {
    command: 'npx http-server . -p 4173 --silent -c-1',
    url: 'http://127.0.0.1:4173/tests/browser/fixtures/foundry-stub.html',
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 60_000,
  },
});
