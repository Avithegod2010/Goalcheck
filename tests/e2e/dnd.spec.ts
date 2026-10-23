import { expect, test, type Locator, type Page } from "@playwright/test";

/* =========================================================
   GoalCheck — v4.3 drag-and-drop E2E (kanban move, calendar
   reschedule, checklist reorder).

   Drag techniques, verified empirically against this repo's
   "chromium" project (Playwright 1.64 → chromium headless shell):

   • Kanban uses @dnd-kit (DndContext + PointerSensor, 6px
     activation constraint) → real mouse input works. The pointer
     is driven manually: hover() scrolls the source into view,
     then stepped page.mouse moves (viewport coordinates) so the
     sensor activates and collision detection sees a pointer path.
     A single-jump locator.dragTo activates the sensor but is
     unreliable for the final collision, so it is not used.

   • Calendar + Checklist use native HTML5 DnD. The headless
     shell does NOT synthesize dragstart/dragover/drop from mouse
     input (crbug.com/1129455 — locator.dragTo silently does
     nothing on draggable elements), so those surfaces are driven
     by dispatching a real DragEvent sequence with ONE shared
     DataTransfer: the components' React handlers run unchanged
     (onDragStart setData → onDrop getData) and the store actions
     do the rest.

   All assertions are store-driven (kanban column contents,
   calendar day cells, row order), never pixel positions.
   ========================================================= */

const HEADER_READY = "More actions";

/* ---------- shared setup (mirrors golden-path helpers) ---------- */

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

/** New board (blank template seeds "Xyz"/"Pyq"/"Call & sync notes") + tasks in its first category. */
async function createBoardWithTasks(page: Page, board: string, tasks: string[]): Promise<void> {
  await page.getByRole("button", { name: "Create new board" }).first().click();
  await page.getByPlaceholder(/Device & Daily Tasks/).fill(board);
  await page.getByRole("button", { name: "Save Goal Board" }).click();
  await expect(page.getByRole("heading", { name: board })).toBeVisible();
  for (const task of tasks) {
    const addBox = page.getByRole("textbox", { name: /Add task/ }).first();
    await addBox.fill(task);
    await page.getByRole("button", { name: "Add task" }).first().click();
    await expect(page.getByRole("button", { name: new RegExp(`^\\d+\\.\\s*${task}`) })).toBeVisible();
  }
}

/* ---------- drag drivers ---------- */

/** Real-mouse drag for the @dnd-kit kanban (PointerSensor). */
async function mouseDrag(page: Page, source: Locator, target: Locator): Promise<void> {
  await source.hover(); // scrolls into view, pointer sits on the source
  await page.mouse.down();
  const s = await source.boundingBox(); // viewport-relative
  if (!s) throw new Error("mouseDrag: source bounding box unavailable");
  await page.mouse.move(s.x + s.width / 2 + 14, s.y + s.height / 2, { steps: 4 }); // > 6px activation
  const t = await target.boundingBox();
  if (!t) throw new Error("mouseDrag: target bounding box unavailable");
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 18 }); // stepped path → collision
  await page.mouse.up();
}

/**
 * Native HTML5 DnD for the headless shell: one DataTransfer shared across a
 * dispatchEvent'd dragstart → dragenter → dragover → drop → dragend sequence.
 * React's synthetic handlers receive them via bubbling exactly like a user drag.
 */
async function html5Drag(page: Page, source: Locator, target: Locator): Promise<void> {
  const src = await source.elementHandle();
  const dst = await target.elementHandle();
  await page.evaluate(([s, d]) => {
    if (!s || !d) throw new Error("html5Drag: source/target element not found");
    const dt = new DataTransfer();
    const opts: DragEventInit = { bubbles: true, cancelable: true, dataTransfer: dt };
    s.dispatchEvent(new DragEvent("dragstart", opts));
    d.dispatchEvent(new DragEvent("dragenter", opts));
    d.dispatchEvent(new DragEvent("dragover", opts));
    d.dispatchEvent(new DragEvent("drop", opts));
    s.dispatchEvent(new DragEvent("dragend", opts));
  }, [src, dst]);
}

/* ---------- calendar helpers ---------- */

function daysFromToday(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

/** Local YYYY-MM-DD (matches the store's localDateKey format). */
function isoDate(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
}

/** Current count in the calendar's "No date (N)" unscheduled pool.
    NOTE: innerText comes back UPPERCASED (the heading is CSS-uppercased),
    so match case-insensitively. */
async function poolCount(page: Page): Promise<number> {
  const heading = await page.locator("p", { hasText: /no date \(\d+\)/i }).innerText();
  const m = /no date \((\d+)\)/i.exec(heading);
  if (!m) throw new Error(`poolCount: unexpected heading ${JSON.stringify(heading)}`);
  return Number(m[1]);
}

/** The chips container inside the unscheduled pool (drops bubble to the pool's onDrop). */
function unscheduledPool(page: Page): Locator {
  return page.locator("p", { hasText: /no date \(\d+\)/i }).locator("..");
}

/* ---------- checklist helper ---------- */

/** Ordered row labels of the first category ("1. Xyz", …). */
async function rowOrder(page: Page): Promise<string[]> {
  const texts = await page
    .locator('ul[aria-label="Tasks"]')
    .first()
    .getByRole("button", { name: /^\d+\.\s/ })
    .allInnerTexts();
  return texts.map((s) => s.replace(/\s+/g, " ").trim());
}

/** Waits until the checklist grid actually rendered its rows (hydration can lag the header). */
async function waitForRows(page: Page): Promise<void> {
  await expect(page.locator('ul[aria-label="Tasks"]').first().getByRole("button", { name: /^\d+\.\s/ }).first()).toBeVisible();
}

/* =========================================================
   1. Kanban — @dnd-kit pointer drag across columns
   ========================================================= */

test("kanban: dragging a card from To Do to In Progress moves and persists it", async ({ page }) => {
  await boot(page);
  await createBoardWithTasks(page, "DnD Kanban Board", ["DnD Kanban Card"]);
  await page.getByRole("tab", { name: "Kanban" }).click();

  const card = page.getByText("DnD Kanban Card");
  const todo = page.locator('[aria-label="To Do"]');
  const doing = page.locator('[aria-label="In Progress"]');
  await expect(card).toBeVisible(); // kanban view is code-split; waits for the chunk
  await expect(todo.getByText("DnD Kanban Card")).toBeVisible();

  await mouseDrag(page, card, doing);

  await expect(doing.getByText("DnD Kanban Card")).toBeVisible();
  await expect(todo.getByText("DnD Kanban Card")).toHaveCount(0);

  /* status ("doing") lives in the task → survives a reload */
  await boot(page);
  await page.getByRole("tab", { name: "Kanban" }).click();
  await expect(page.locator('[aria-label="In Progress"]').getByText("DnD Kanban Card")).toBeVisible();
});

/* =========================================================
   2. Calendar — HTML5 chip drags (reschedule / schedule / unschedule)
   ========================================================= */

test("calendar: dragging a chip to another day reschedules it (survives reload)", async ({ page }) => {
  const d1 = daysFromToday(2);
  const d2 = daysFromToday(4);

  await boot(page);
  await createBoardWithTasks(page, "DnD Calendar Board", ["DnD Cal Chip"]);

  /* give the task a due date through the advanced task editor */
  await page.locator("li", { hasText: "DnD Cal Chip" }).getByRole("button", { name: "Advanced task edit" }).click();
  await page.getByLabel("Task due date").fill(isoDate(d1));
  await page.getByRole("button", { name: "Save Changes" }).click();

  await page.getByRole("tab", { name: "Calendar" }).click();
  const cell1 = page.getByRole("gridcell", { name: d1.toDateString() });
  const cell2 = page.getByRole("gridcell", { name: d2.toDateString() });
  await expect(cell1).toBeVisible();
  await expect(cell2).toBeVisible();
  await expect(cell1.getByText("DnD Cal Chip")).toBeVisible();

  await html5Drag(page, cell1.getByText("DnD Cal Chip"), cell2);

  await expect(cell2.getByText("DnD Cal Chip")).toBeVisible();
  await expect(cell1.getByText("DnD Cal Chip")).toHaveCount(0);

  /* dueDate lives in the task → survives a reload */
  await boot(page);
  await page.getByRole("tab", { name: "Calendar" }).click();
  await expect(page.getByRole("gridcell", { name: d2.toDateString() }).getByText("DnD Cal Chip")).toBeVisible();
});

test("calendar: dragging an unscheduled chip onto a day schedules it", async ({ page }) => {
  const d1 = daysFromToday(2);

  await boot(page);
  await createBoardWithTasks(page, "DnD Pool Board", ["DnD Pool Chip"]);
  await page.getByRole("tab", { name: "Calendar" }).click();

  /* fresh board → the new task (plus template tasks) sits in the "No date" pool */
  const cell1 = page.getByRole("gridcell", { name: d1.toDateString() });
  await expect(page.getByText("DnD Pool Chip")).toBeVisible();
  await expect(cell1).toBeVisible();
  const before = await poolCount(page);

  await html5Drag(page, page.getByText("DnD Pool Chip"), cell1);

  await expect(cell1.getByText("DnD Pool Chip")).toBeVisible();
  await expect(page.getByText(`No date (${before - 1})`)).toBeVisible();
});

test("calendar: dropping a chip in the pool clears its due date", async ({ page }) => {
  const d1 = daysFromToday(2);

  await boot(page);
  await createBoardWithTasks(page, "DnD Unschedule Board", ["DnD Unsched Chip"]);

  await page.locator("li", { hasText: "DnD Unsched Chip" }).getByRole("button", { name: "Advanced task edit" }).click();
  await page.getByLabel("Task due date").fill(isoDate(d1));
  await page.getByRole("button", { name: "Save Changes" }).click();

  await page.getByRole("tab", { name: "Calendar" }).click();
  const cell1 = page.getByRole("gridcell", { name: d1.toDateString() });
  await expect(cell1.getByText("DnD Unsched Chip")).toBeVisible();
  const before = await poolCount(page);

  await html5Drag(page, cell1.getByText("DnD Unsched Chip"), unscheduledPool(page));

  await expect(cell1.getByText("DnD Unsched Chip")).toHaveCount(0);
  await expect(page.getByText(`No date (${before + 1})`)).toBeVisible();
  await expect(page.getByText("DnD Unsched Chip")).toBeVisible(); // back in the pool
});

/* =========================================================
   3. Checklist — HTML5 row reorder
   ========================================================= */

test("checklist: dragging a row onto another reorders tasks (survives reload)", async ({ page }) => {
  await boot(page);
  await createBoardWithTasks(page, "DnD Checklist Board", ["DnD Alpha", "DnD Beta"]);

  const rows = page.locator('ul[aria-label="Tasks"]').first().locator("> li");
  await waitForRows(page);
  await page.waitForTimeout(600); // let framer-motion entry animations settle
  const orderBefore = await rowOrder(page);
  expect(orderBefore.find((s) => s.includes("DnD Beta"))).toBeTruthy();

  /* drop fires with clientY 0 → the row inserts ABOVE its target.
     Under full-suite load the first dispatch can land mid-render, so
     retry the drag until the store reflects the move (max 3). */
  const betaAboveXyz = async (): Promise<boolean> => {
    const o = await rowOrder(page);
    const beta = o.findIndex((s) => s.includes("DnD Beta"));
    const xyz = o.findIndex((s) => s.includes("Xyz"));
    return beta >= 0 && xyz >= 0 && beta < xyz;
  };
  for (let attempt = 0; attempt < 3 && !(await betaAboveXyz()); attempt++) {
    await html5Drag(page, rows.filter({ hasText: "DnD Beta" }), rows.filter({ hasText: "Xyz" }));
    await expect.poll(betaAboveXyz, { timeout: 8_000 }).toBe(true);
  }
  expect(await betaAboveXyz()).toBe(true);
  const order = await rowOrder(page);
  const beta = order.findIndex((s) => s.includes("DnD Beta"));
  const xyz = order.findIndex((s) => s.includes("Xyz"));
  const alpha = order.findIndex((s) => s.includes("DnD Alpha"));
  expect(beta).toBeLessThan(xyz); // Beta jumped above the first row
  expect(alpha).toBeGreaterThan(xyz); // everything else shifted down one

  /* ordering lives in the store → survives a reload */
  await boot(page);
  await waitForRows(page);
  const reloaded = await rowOrder(page);
  expect(reloaded.findIndex((s) => s.includes("DnD Beta"))).toBeLessThan(
    reloaded.findIndex((s) => s.includes("Xyz"))
  );
});
