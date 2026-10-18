import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/lib/goalcheck/types";
import { isoWeekKey, localDateKey, makeTask } from "@/lib/goalcheck/logic";
import type { GoalBoard, Task } from "@/lib/goalcheck/types";

/*
 * Store action tests — recurring respawn, dependency locks, RPG
 * integration and the Phase 2 quota-safe storage wrapper.
 */

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function freshStore() {
  vi.resetModules();
  const mod = await import("@/lib/goalcheck/store");
  return mod.useStore;
}

function boardWith(items: Task[], recurrence: "none" | "daily" | "weekly" = "none"): GoalBoard {
  return {
    id: "goal-x", title: "Board", subtitle: "", media: "mono:target-radar", createdAt: 1,
    categories: [{
      id: "cat-x", title: "C -", media: "mono:clipboard-check", recurrence,
      lastResetDate: localDateKey(new Date()), lastWeekKey: isoWeekKey(new Date()), items,
    }],
  };
}

describe("recurring task respawn (v4)", () => {
  it("respawns a daily clone after the due date on completion", async () => {
    const useStore = await freshStore();
    const t = makeTask("Water plants", { recurrence: "daily", dueDate: "2026-01-10" });
    useStore.setState({ goals: [boardWith([t])], activeGoalId: "goal-x" });

    useStore.getState().toggleTask("cat-x", t.id);

    const items = useStore.getState().goals[0].categories[0].items;
    expect(items).toHaveLength(2);
    const original = items.find((i) => i.id === t.id)!;
    const clone = items.find((i) => i.id !== t.id)!;
    expect(original.completed).toBe(true);
    expect(clone).toMatchObject({
      text: "Water plants",
      completed: false,
      status: "todo",
      recurrence: "daily",
      dueDate: "2026-01-11", // due + 1 day
      respawnedFrom: t.id,
    });
  });

  it("respawns a weekly clone +7 days and keeps priority/notes", async () => {
    const useStore = await freshStore();
    const t = makeTask("Weekly review", { recurrence: "weekly", dueDate: "2026-01-10", priority: "high", notes: "deep dive" });
    useStore.setState({ goals: [boardWith([t])], activeGoalId: "goal-x" });

    useStore.getState().toggleTask("cat-x", t.id);
    const clone = useStore.getState().goals[0].categories[0].items.find((i) => i.respawnedFrom === t.id)!;
    expect(clone.dueDate).toBe("2026-01-17"); // due + 7 days
    expect(clone.priority).toBe("high");
    expect(clone.notes).toBe("deep dive");
  });

  it("removes the untouched respawn when the original is unchecked again", async () => {
    const useStore = await freshStore();
    const t = makeTask("Stretch", { recurrence: "daily" });
    useStore.setState({ goals: [boardWith([t])], activeGoalId: "goal-x" });

    useStore.getState().toggleTask("cat-x", t.id); // complete -> clone appears
    expect(useStore.getState().goals[0].categories[0].items).toHaveLength(2);

    useStore.getState().toggleTask("cat-x", t.id); // uncheck -> clone removed
    const items = useStore.getState().goals[0].categories[0].items;
    expect(items).toHaveLength(1);
    expect(items[0].completed).toBe(false);
  });

  it("leaves non-recurring tasks alone", async () => {
    const useStore = await freshStore();
    const t = makeTask("One shot");
    useStore.setState({ goals: [boardWith([t])], activeGoalId: "goal-x" });

    useStore.getState().toggleTask("cat-x", t.id);
    const items = useStore.getState().goals[0].categories[0].items;
    expect(items).toHaveLength(1);
    expect(items[0].completed).toBe(true);
  });
});

describe("dependency locks", () => {
  it("blocks completing a task whose prerequisite is open", async () => {
    const useStore = await freshStore();
    const a = makeTask("Install SDK");
    const b = makeTask("Build app", { dependsOn: a.id });
    useStore.setState({ goals: [boardWith([a, b])], activeGoalId: "goal-x" });

    useStore.getState().toggleTask("cat-x", b.id);
    expect(useStore.getState().goals[0].categories[0].items.find((i) => i.id === b.id)!.completed).toBe(false);

    useStore.getState().toggleTask("cat-x", a.id); // prereq done
    useStore.getState().toggleTask("cat-x", b.id);
    expect(useStore.getState().goals[0].categories[0].items.find((i) => i.id === b.id)!.completed).toBe(true);
  });
});

describe("RPG integration", () => {
  it("awards XP, bumps the heatmap history and unlocks first-task on completion", async () => {
    const useStore = await freshStore();
    const t = makeTask("Do a thing");
    // a second open task keeps the board below 100% so the
    // one-off "Board Mastered" +100 bonus does not fire
    useStore.setState({ goals: [boardWith([t, makeTask("Keep board open")])], activeGoalId: "goal-x" });

    useStore.getState().toggleTask("cat-x", t.id);
    const s = useStore.getState();
    expect(s.rpg.xp).toBe(10); // normal priority, combo 1 -> x1 multiplier
    expect((s.rpg.history[localDateKey(new Date())] || 0)).toBeGreaterThanOrEqual(1);
    expect(s.achievements["first-task"]).toBeGreaterThan(0);
  });

  it("halfs the combo on uncheck only with the combo-keeper skill", async () => {
    const useStore = await freshStore();
    useStore.setState({ rpg: { ...useStore.getState().rpg, combo: 10, skills: { "combo-keeper": true } } });

    useStore.getState().internalOnTaskUnchecked();
    expect(useStore.getState().rpg.combo).toBe(5);
  });

  it("resets the combo on uncheck without the skill", async () => {
    const useStore = await freshStore();
    useStore.setState({ rpg: { ...useStore.getState().rpg, combo: 10 } });

    useStore.getState().internalOnTaskUnchecked();
    expect(useStore.getState().rpg.combo).toBe(0);
  });
});

describe("applyRecurringResets (recurring categories)", () => {
  it("resets stale daily categories on demand", async () => {
    const useStore = await freshStore();
    useStore.setState({
      goals: [boardWith([makeTask("A", { completed: true, status: "done" })], "daily")],
      activeGoalId: "goal-x",
    });
    useStore.setState({
      goals: useStore.getState().goals.map((g) => ({
        ...g,
        categories: g.categories.map((c) => ({ ...c, lastResetDate: "2020-01-01" })),
      })),
    });

    useStore.getState().applyRecurringResets();
    const cat = useStore.getState().goals[0].categories[0];
    expect(cat.lastResetDate).toBe(localDateKey(new Date()));
    expect(cat.items.every((i) => !i.completed && i.status === "todo")).toBe(true);
  });

  it("resets stale weekly categories on demand", async () => {
    const useStore = await freshStore();
    useStore.setState({
      goals: [boardWith([makeTask("B", { completed: true, status: "done" })], "weekly")],
      activeGoalId: "goal-x",
    });
    useStore.setState({
      goals: useStore.getState().goals.map((g) => ({
        ...g,
        categories: g.categories.map((c) => ({ ...c, lastWeekKey: "2020-W1" })),
      })),
    });

    useStore.getState().applyRecurringResets();
    const cat = useStore.getState().goals[0].categories[0];
    expect(cat.lastWeekKey).toBe(isoWeekKey(new Date()));
    expect(cat.items.every((i) => !i.completed)).toBe(true);
  });

  it("does not touch categories already reset this period", async () => {
    const useStore = await freshStore();
    useStore.setState({
      goals: [boardWith([makeTask("C", { completed: true, status: "done" })], "daily")],
      activeGoalId: "goal-x", // lastResetDate = today via boardWith()
    });

    useStore.getState().applyRecurringResets();
    const cat = useStore.getState().goals[0].categories[0];
    expect(cat.items[0].completed).toBe(true); // untouched
  });
});

describe("quota-safe storage (Phase 2 resilience)", () => {
  it("prunes the largest embedded image and retries when the quota is hit", async () => {
    const useStore = await freshStore();
    const bigImage = "data:image/png;base64," + "A".repeat(4000);
    useStore.setState({ brandMedia: bigImage });

    const realSetItem = Storage.prototype.setItem.bind(localStorage);
    let quotaThrown = false;
    const writtenKeys: string[] = [];
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (!quotaThrown) {
        quotaThrown = true;
        const err = new Error("exceeded");
        err.name = "QuotaExceededError";
        throw err;
      }
      writtenKeys.push(key);
      return realSetItem(key, value);
    });

    const prunedEvent = new Promise<void>((resolve) =>
      window.addEventListener("gc-storage-quota", () => resolve(), { once: true }),
    );

    useStore.getState().completeOnboarding(); // triggers a persist write
    await prunedEvent;

    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { state: { brandMedia: string } };
    expect(envelope.state.brandMedia).toBe("mono:image-pic"); // pruned to the fallback
    expect(writtenKeys).toContain(STORAGE_KEY);
    expect(quotaThrown).toBe(true);
  });

  it("broadcasts gc-storage-quota-failed when nothing can be pruned and the quota is still hit", async () => {
    const useStore = await freshStore();
    useStore.setState({ brandMedia: "mono:rocket-launch" }); // nothing prunable

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const err = new Error("still full");
      err.name = "QuotaExceededError";
      throw err;
    });

    const failedEvent = new Promise<void>((resolve) =>
      window.addEventListener("gc-storage-quota-failed", () => resolve(), { once: true }),
    );

    useStore.getState().completeOnboarding();
    await failedEvent;
    // the wrapper swallows the error so the UI action never crashes
    expect(useStore.getState().settings.onboardingDone).toBe(true);
  });
});
