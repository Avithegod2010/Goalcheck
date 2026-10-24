import { defineConfig, devices } from "@playwright/test";

/* v4.2 — Playwright golden-path E2E (feature: quality lane).
   Runs the Next dev server (edition defaults to Advance) and drives the
   real UI: onboarding → board → task → views → themes → palette →
   edition switch → encrypted export → report card.
   v4.4 (task 17-g) — two engines + visual lane:
   - chromium stays the default/primary project;
   - webkit (Safari engine) runs the SAME suite as a compat lane;
   - per-project retries (supported since Playwright 1.44, we're on 1.64):
     webkit gets 2 retries because it is the flakiest engine on Linux,
     chromium keeps its existing behavior (1 retry in CI, 0 locally) so
     the fast lane never slows down;
   - tests/e2e/visual.spec.ts is gated behind GC_VISUAL=1 and only ever
     baselined on chromium (see the visual job in .github/workflows/e2e.yml). */

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : 1,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    colorScheme: "dark",
    /* v4.4.1 — emulate prefers-reduced-motion in every browser context.
       Root cause of the Linux-webkit onboarding failure: framer-motion's
       spring on the onboarding panel (y + scale) never settles to a stable
       bounding box under WPE's headless rAF pacing, so Playwright's
       actionability check ("stable") retried the Skip click until timeout.
       The app already wraps every screen in <MotionConfig reducedMotion="user">,
       so honoring the preference here skips transform springs in ALL engines
       — deterministic clicks everywhere, and it doubles as an a11y guarantee
       that the whole golden path works with reduced motion on. */
    reducedMotion: "reduce",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, retries: isCI ? 1 : 0 },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, retries: 2 },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
