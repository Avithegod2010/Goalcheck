import { expect, test, type Page } from "@playwright/test";

/* =========================================================
   GoalCheck — golden-path E2E (v4.2 quality lane)
   Every test gets a fresh browser context (own localStorage),
   so each run starts as a brand-new device with seeded demo data.
   ========================================================= */

const HEADER_READY = "More actions";

async function boot(page: Page): Promise<void> {
  await page.goto("/");
  // zustand rehydration renders the real header once hydrated
  await expect(page.getByRole("button", { name: HEADER_READY })).toBeVisible({ timeout: 20_000 });
  // first-run tour (fresh context every time)
  const skip = page.getByRole("button", { name: "Skip" });
  if (await skip.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await skip.click();
  }
}

async function openActionsMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "More actions" }).click();
}

test("loads the workspace and completes the onboarding tour", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/GoalCheck Advance/);
  const welcome = page.getByText("Welcome to GoalCheck Advance");
  await expect(welcome).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(welcome).toBeHidden();
  await page.getByRole("button", { name: HEADER_READY }).waitFor();
});

test("creates a board, adds a task and completes it", async ({ page }) => {
  await boot(page);

  await page.getByRole("button", { name: "Create new board" }).first().click();
  await page.getByPlaceholder(/Device & Daily Tasks/).fill("E2E Sprint Board");
  await page.getByRole("button", { name: "Save Goal Board" }).click();
  await expect(page.getByRole("heading", { name: "E2E Sprint Board" })).toBeVisible();

  const addBox = page.getByRole("textbox", { name: /Add task/ }).first();
  await addBox.fill("Ship the v4.2 release");
  await page.getByRole("button", { name: "Add task" }).first().click();
  /* v4.3: the row also carries "Track time …" and "Deep focus on: …" buttons whose
     accessible names CONTAIN the task text — anchor on the toggle's "N. <text>"
     name so the locator stays strict-mode unique. */
  const task = page.getByRole("button", { name: /^\d+\.\s*Ship the v4\.2 release/ });
  await expect(task).toBeVisible();

  /* the task-name button is the completion toggle (aria-pressed reflects it) */
  await task.click();
  await expect(task).toHaveAttribute("aria-pressed", "true");
});

test("week view renders the 7-day planner", async ({ page }) => {
  await boot(page);
  await page.getByRole("tab", { name: "Week" }).click();
  await expect(page.getByRole("button", { name: "This Week" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");
});

test("high-contrast theme applies for accessibility", async ({ page }) => {
  await boot(page);
  await openActionsMenu(page);
  await page.getByRole("menuitem", { name: "Themes & Atmosphere" }).click();
  await page.getByRole("button", { name: "High Contrast Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-gc-theme", "contrast");
});

test("command palette opens with Ctrl+K", async ({ page }) => {
  await boot(page);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Command input" })).toBeVisible();
});

test("switches edition to Normal and back data stays intact", async ({ page }) => {
  await boot(page);
  await openActionsMenu(page);
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: /Switch to GoalCheck \(Normal\)/ }).click();
  await page.getByRole("button", { name: "Yes, switch to GoalCheck (Normal)" }).click();

  // the app reloads itself into the base edition
  await expect(page).toHaveTitle(/^GoalCheck —/, { timeout: 20_000 });
  expect(await page.evaluate(() => localStorage.getItem("gc_edition_override"))).toBe("base");

  // pro views are gone in the base edition
  await expect(page.getByRole("tab", { name: "Kanban" })).toHaveCount(0);
});

test("encrypted .gcenc export offers a passphrase vault", async ({ page }) => {
  await boot(page);
  await openActionsMenu(page);
  await page.getByRole("menuitem", { name: "Export / Backup" }).click();
  await page.getByRole("tab", { name: "Encrypted (.gcenc)" }).click();
  await expect(page.getByText(/AES-256-GCM vault/)).toBeVisible();
  await expect(page.getByLabel("Vault passphrase")).toBeVisible();
});

test("report card renders a shareable canvas", async ({ page }) => {
  await boot(page);
  await openActionsMenu(page);
  await page.getByRole("menuitem", { name: "Report card" }).click();
  await expect(page.getByLabel(/share card preview/)).toBeVisible();
});

test("mobile viewport keeps the workspace usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await expect(page.getByRole("heading", { name: /MY GOAL BOARDS/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create new board" }).first()).toBeVisible();
  /* desktop-only header buttons stay hidden on mobile */
  await expect(page.getByRole("button", { name: HEADER_READY })).toBeVisible();
});
