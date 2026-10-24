import { expect, test, type Page } from "@playwright/test";

/* =========================================================
   Visual regression scaffold (task 17-g) — chromium baselines.

   GATED: every test self-skips unless GC_VISUAL=1, so the default
   `bunx playwright test` lanes (and CI) stay fast. Baselines are
   generated LOCALLY and committed:

     GC_VISUAL=1 bunx playwright test --update-snapshots

   (only ever on chromium — see the dedicated visual job in
   .github/workflows/e2e.yml; snapshots land in
   tests/e2e/__snapshots__/ which is NOT gitignored.)

   Determinism contract — what we kill before page.goto:
   1. Seeded state: a minimal v5 persist envelope is written to
      localStorage["goalcheck_pro_state"] via addInitScript. A fresh
      browser context has an empty IndexedDB, so the one-time
      localStorage → IDB legacy import (src/lib/goalcheck/idb.ts,
      ensureLegacyImport) copies it in before hydration — same pattern
      proven in tests/unit/migrate-v5.test.ts.
      The envelope contains ONE board, TWO tasks with fixed texts, and
      NO time-dependent values (all epochs frozen in 2000–2023,
      recurrence "none" so applyRecurringResets can never respawn
      anything, no running timer).
   2. Ambient randomness off INSIDE the envelope: settings.reduceEffects
      = true (no particles/ripple/confetti/heavy blur) + particles
      "off" (top-level engine id).
   3. Masks + options: the pomodoro panel (#pomodoroPanel — ring +
      remaining-time text) is masked, animations are disabled, and
      maxDiffPixelRatio 0.03 tolerates sub-pixel font/AA drift.
      Known residual drift (accepted, job is continue-on-error until
      baselines stabilize): the calendar view highlights TODAY, so the
      highlighted cell moves across days/months.
   ========================================================= */

// hard gate — see file header
test.skip(process.env.GC_VISUAL !== "1", "visual baselines generated locally with GC_VISUAL=1");

/** Persisted-storage key — src/lib/goalcheck/types.ts (STORAGE_KEY). */
const STORAGE_KEY = "goalcheck_pro_state";

/* Frozen epochs (never "now") — keeps streaks, XP history and created-at
   labels identical on every run, forever. */
const T_GOAL = 1_700_000_000_000; // 2023-11-14T22:13:20Z
const T_TASK = 1_690_000_000_000; // 2023-07-23T04:26:40Z
const T_HISTORY = "2000-W1"; // iso week key far in the past

const SEED_STATE = {
  theme: "nebula", // DEFAULT_DARK_THEME (src/lib/goalcheck/themes.ts)
  particles: "off" as const, // ambient engine disabled at the source
  activeGoalId: "goal-visual",
  view: "checklist",
  filter: "all",
  layoutMode: "grid",
  goals: [
    {
      id: "goal-visual",
      title: "Visual Regression",
      subtitle: "one board, two fixed tasks",
      media: "🎯",
      createdAt: T_GOAL,
      archived: false, // v5 field
      categories: [
        {
          id: "cat-visual",
          title: "Anchors -", // " - " suffix matches daily-board conventions
          media: "mono:target",
          recurrence: "none", // never respawns → no date drift
          lastResetDate: "2000-01-03",
          lastWeekKey: T_HISTORY,
          items: [
            {
              id: "task-visual-1",
              text: "Write visual baseline notes",
              completed: false,
              priority: "high",
              notes: "",
              status: "todo",
              subtasks: [],
              pomosEstimate: 2,
              pomoCount: 0,
              dependsOn: "",
              dueDate: "",
              timeSpent: 0,
              recurrence: "none",
              respawnedFrom: "",
              completedAt: 0,
              createdAt: T_TASK,
              estimate: 0, // v5 field
              attachments: [], // v5 field
            },
            {
              id: "task-visual-2",
              text: "Ship the signed release",
              completed: true,
              priority: "normal",
              notes: "",
              status: "done",
              subtasks: [],
              pomosEstimate: 1,
              pomoCount: 0,
              dependsOn: "",
              dueDate: "",
              timeSpent: 0,
              recurrence: "none",
              respawnedFrom: "",
              completedAt: T_TASK,
              createdAt: T_TASK,
              estimate: 0,
              attachments: [],
            },
          ],
        },
      ],
    },
  ],
  pomo: {
    mode: "focus",
    focusMinutes: 25,
    running: false, // ring fraction frozen at full time remaining
    endsAt: 0,
    remainingMs: 25 * 60_000,
    attachedTaskId: "",
  },
  rpg: {
    enabled: false, // no aura/XP HUD render at all
    xp: 0,
    level: 1,
    combo: 0,
    skillPoints: 0,
    skills: {},
    aura: "",
    history: { [T_HISTORY]: 4 },
  },
  analytics: { focusSeconds: 0, hourCounts: {}, perGoal: {} },
  settings: {
    rpgEnabled: false,
    heatmapEnabled: false, // heatmap would highlight "today"
    autoParent: false,
    reduceEffects: true, // ambient randomness off (task contract)
    colorMode: "manual", // never follow the OS light/dark setting
    cursorPhysics: "none",
    simSpeed: 1,
    simDensity: 0,
    audioGain: 0,
    audioStream: "lofi",
    chimePack: "glass",
    chimeVolume: 0,
    onboardingDone: true, // no first-run tour
    lastBackupAt: 0,
    backupNudgeDismissedAt: 0,
    syncFileEnabled: false,
    syncFileEncrypted: false,
    streakFreezes: false,
    fontScale: 1,
    lastDoctorScanAt: 0,
    remindersEnabled: false,
    snapshotCadence: "off",
    snapshotsToKeep: 5,
  },
  brandMedia: "mono:rocket-launch",
  habits: [],
  achievements: {},
  customTheme: {},
  reviews: [],
  activeTimer: null, // no live stopwatch chip anywhere
};

/** Same shape zustand persist writes: { state, version } (STORAGE_VERSION = 5). */
const SEED_ENVELOPE = JSON.stringify({ state: SEED_STATE, version: 5 });

/**
 * Visual boot: seed → goto → wait for the hydrated header (golden-path
 * boot pattern from tests/e2e/golden-path.spec.ts), tolerating the
 * onboarding tour even though the seed marks it done (belt & braces —
 * if the tour ever renders, skip it BEFORE the screenshot).
 */
async function bootVisual(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  // MUST run before goto so the very first document has the seeded state
  await page.addInitScript(
    (seed: { key: string; value: string }) => {
      window.localStorage.setItem(seed.key, seed.value);
    },
    { key: STORAGE_KEY, value: SEED_ENVELOPE },
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "More actions" })).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skip.click();
  }
  // let fonts settle + entrance transitions (animations: "disabled" also applies)
  await page.evaluate(() => document.fonts.ready);
}

/** Shared screenshot options — deterministic per the file-header contract. */
function visualOptions(page: Page) {
  return {
    animations: "disabled" as const,
    maxDiffPixelRatio: 0.03,
    mask: [page.locator("#pomodoroPanel")], // ring + ticking remaining-time text
  };
}

test("checklist view — desktop 1280×800", async ({ page }) => {
  await bootVisual(page, { width: 1280, height: 800 });
  await expect(page.getByRole("tab", { name: "Checklist" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /1\.\s*Write visual baseline notes/ })).toBeVisible();
  await expect(page).toHaveScreenshot("checklist-desktop.png", visualOptions(page));
});

test("kanban view — desktop 1280×800", async ({ page }) => {
  await bootVisual(page, { width: 1280, height: 800 });
  await page.getByRole("tab", { name: "Kanban" }).click();
  await expect(page.getByRole("tab", { name: "Kanban" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Write visual baseline notes").first()).toBeVisible();
  await expect(page).toHaveScreenshot("kanban-desktop.png", visualOptions(page));
});

test("calendar view — desktop 1280×800", async ({ page }) => {
  await bootVisual(page, { width: 1280, height: 800 });
  await page.getByRole("tab", { name: "Calendar" }).click();
  await expect(page.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveScreenshot("calendar-desktop.png", visualOptions(page));
  /* NOTE: the highlighted "today" cell moves with the real date —
     accepted residual drift (see file header). */
});

test("settings modal open — desktop 1280×800", async ({ page }) => {
  await bootVisual(page, { width: 1280, height: 800 });
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveScreenshot("settings-modal.png", visualOptions(page));
});

test("checklist view — mobile 375×812", async ({ page }) => {
  await bootVisual(page, { width: 375, height: 812 });
  await expect(page.getByRole("tab", { name: "Checklist" })).toBeVisible();
  await expect(page.getByRole("button", { name: /1\.\s*Write visual baseline notes/ })).toBeVisible();
  await expect(page).toHaveScreenshot("checklist-mobile.png", visualOptions(page));
});
