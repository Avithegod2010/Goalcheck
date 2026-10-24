import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { STORAGE_KEY, STORAGE_VERSION } from "@/lib/goalcheck/types";
import { isoWeekKey, localDateKey } from "@/lib/goalcheck/logic";

/*
 * Schema migration tests — the lossless base<->Advance promise.
 *
 * Since the v5 storage engine the workspace lives in IndexedDB
 * ("goalcheck-idb" → kv store). These tests exercise the REAL browser
 * upgrade path end-to-end:
 *   pre-v5 localStorage payload → one-time ensureLegacyImport() copy
 *   → zustand async rehydration from IDB → migrate → v5 defaults.
 * fake-indexeddb provides a fresh IndexedDB per test; the localStorage
 * seeding simulates the payload left behind by the previous app version.
 */

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  // fresh fake IndexedDB per test so the one-time legacy-import marker never leaks
  (globalThis as { indexedDB: unknown }).indexedDB = new IDBFactory();
});

async function freshStore() {
  vi.resetModules();
  const mod = await import("@/lib/goalcheck/store");
  return mod.useStore;
}

/* Async-storage rehydration: rehydrate() plus the _hydrated flag contract. */
async function rehydrated(store: {
  persist: { rehydrate(): Promise<void> };
  getState(): { _hydrated: boolean };
}): Promise<void> {
  await store.persist.rehydrate();
  await vi.waitFor(() => {
    if (!store.getState()._hydrated) throw new Error("store not hydrated yet");
  }, { timeout: 5_000 });
}

/* A realistic legacy v1 payload from the original single-file HTML app. */
const LEGACY_V1 = {
  theme: "sakura",
  view: "kanban",
  layoutMode: "grid",
  activeGoalId: "goal-1",
  goals: [
    {
      id: "goal-1", title: "My Goals", subtitle: "legacy import", media: "🎯", createdAt: 123,
      categories: [
        {
          id: "cat-1", title: "Daily -", media: "📌", recurrence: "none",
          lastResetDate: "2020-01-01", lastWeekKey: "2020-W1",
          items: [
            { id: "t1", text: "Legacy task", completed: true, priority: "high", notes: "keep my note", status: "done" },
            { id: "t2", text: "Open task", completed: false },
          ],
        },
      ],
    },
  ],
  rpg: { enabled: true, xp: 123, level: 4, combo: 2, skillPoints: 2, skills: { "xp-boost": true }, aura: "neon", history: { "2020-01-01": 3 } },
  analytics: { focusSeconds: 3600, hourCounts: { "9": 4 }, perGoal: { "goal-1": 60 } },
  heatmapEnabled: false,
  autoParent: false,
  cursorPhysics: "repel",
  simSpeed: 1.25,
  settings: { reduceEffects: true, colorMode: "system", onboardingDone: true },
  habits: [{ id: "h1", title: "Read", cadence: "daily", marks: { "2020-01-01": true }, createdAt: 5 }],
  achievements: { "first-task": 1600000000000 },
  customTheme: { "--gc-accent": "#ffffff" },
  brandMedia: "mono:rocket-launch",
};

function seedEnvelope(state: unknown, version: number) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));
}

describe("schema migration v1 -> v5 (IndexedDB engine)", () => {
  it("migrates a legacy v1 envelope and preserves every piece of user data", async () => {
    seedEnvelope(LEGACY_V1, 1);
    const useStore = await freshStore();
    await rehydrated(useStore);
    const s = useStore.getState();

    // goals + tasks survive, fields normalized to the current shape
    expect(s.goals).toHaveLength(1);
    expect(s.goals[0].title).toBe("My Goals");
    expect(s.goals[0].categories[0].items[0]).toMatchObject({
      text: "Legacy task", completed: true, status: "done", priority: "high", notes: "keep my note",
    });
    expect(s.goals[0].categories[0].items[1]).toMatchObject({
      text: "Open task", completed: false, status: "todo", priority: "normal",
    });

    // RPG / analytics preserved
    expect(s.rpg.xp).toBe(123);
    expect(s.rpg.level).toBe(4);
    expect(s.rpg.skills["xp-boost"]).toBe(true);
    expect(s.rpg.history["2020-01-01"]).toBe(3);
    expect(s.analytics.focusSeconds).toBe(3600);
    expect(s.analytics.hourCounts["9"]).toBe(4);
    expect(s.analytics.perGoal["goal-1"]).toBe(60);

    // settings preserved (incl. legacy top-level fallbacks)
    expect(s.settings.reduceEffects).toBe(true);
    expect(s.settings.colorMode).toBe("system");
    expect(s.settings.onboardingDone).toBe(true);
    expect(s.settings.heatmapEnabled).toBe(false);
    expect(s.settings.autoParent).toBe(false);
    expect(s.settings.cursorPhysics).toBe("repel");
    expect(s.settings.simSpeed).toBe(1.25);

    // v4 collections preserved
    expect(s.habits[0]).toMatchObject({ id: "h1", title: "Read", cadence: "daily" });
    expect(s.achievements["first-task"]).toBe(1600000000000);
    expect(s.customTheme["--gc-accent"]).toBe("#ffffff");
    expect(s.brandMedia).toBe("mono:rocket-launch");
    expect(s.activeGoalId).toBe("goal-1");
    expect(s._hydrated).toBe(true);
  });

  it("keeps pro-only theme/view under the Advance edition", async () => {
    seedEnvelope(LEGACY_V1, 1);
    const useStore = await freshStore();
    await rehydrated(useStore);
    const s = useStore.getState();
    expect(s.theme).toBe("sakura");   // exists + pro -> kept
    expect(s.view).toBe("kanban");    // pro view -> kept
    expect(s.particles).toBe("fire"); // default pro engine
  });

  it("falls back to the first goal when the stored activeGoalId no longer exists", async () => {
    seedEnvelope({ ...LEGACY_V1, activeGoalId: "deleted-goal" }, 1);
    const useStore = await freshStore();
    await rehydrated(useStore);
    expect(useStore.getState().activeGoalId).toBe("goal-1");
  });

  it("rehydrates a v4 envelope and applies the v5 defaults without touching existing data", async () => {
    seedEnvelope(
      {
        goals: [{
          id: "goal-1", title: "V4 Board", subtitle: "", media: "m", createdAt: 1,
          categories: [{
            id: "c1", title: "C -", media: "m", recurrence: "none",
            lastResetDate: "2020-01-01", lastWeekKey: "2020-W1",
            items: [{ id: "t1", text: "Old task", completed: false }],
          }],
        }],
        activeGoalId: "goal-1",
        theme: "nebula",
        rpg: { enabled: true, xp: 7, level: 1, combo: 0, skillPoints: 1, skills: {}, aura: "", history: {} },
        settings: { onboardingDone: true },
      },
      4,
    );
    const useStore = await freshStore();
    await rehydrated(useStore);
    const s = useStore.getState();
    expect(s.goals[0].title).toBe("V4 Board");        // untouched
    expect(s.rpg.xp).toBe(7);                          // untouched
    expect(s.settings.onboardingDone).toBe(true);      // untouched
    expect(s.view).toBe("checklist");                  // untouched default, no kanban leak
    // v5 defaults applied on top of the v4 payload
    expect(s.goals[0].archived).toBe(false);
    const t = s.goals[0].categories[0].items[0];
    expect(t.text).toBe("Old task");
    expect(t.estimate).toBe(0);
    expect(t.attachments).toEqual([]);
  });

  it("writes back to IndexedDB with the current schema version + keeps the localStorage backup", async () => {
    seedEnvelope(LEGACY_V1, 1);
    const useStore = await freshStore();
    await rehydrated(useStore);

    useStore.getState().completeOnboarding(); // triggers a persist write
    const { idbGet, KV_STORE } = await import("@/lib/goalcheck/idb");
    const raw = await idbGet<string>(KV_STORE, STORAGE_KEY);
    expect(raw).toBeTruthy();
    const envelope = JSON.parse(raw!) as { version: number; state: Record<string, unknown> };
    expect(envelope.version).toBe(STORAGE_VERSION);
    expect(envelope.state.settings).toMatchObject({ onboardingDone: true });
    // transient UI state must never be persisted
    expect(envelope.state.searchQuery).toBeUndefined();
    expect(envelope.state.editingTaskId).toBeUndefined();
    expect(envelope.state._hydrated).toBeUndefined();
    // belt-and-braces: the pre-v5 localStorage copy is never deleted
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it("recurring categories reset on rehydrate when the stored day/week is stale", async () => {
    const today = localDateKey(new Date());
    const week = isoWeekKey(new Date());
    seedEnvelope(
      {
        goals: [{
          id: "goal-1", title: "Rec", subtitle: "", media: "m", createdAt: 1,
          categories: [
            { id: "c-daily", title: "Daily -", media: "m", recurrence: "daily", lastResetDate: "2020-01-01", lastWeekKey: week,
              items: [{ id: "t1", text: "A", completed: true, status: "done" }] },
            { id: "c-weekly", title: "Weekly -", media: "m", recurrence: "weekly", lastResetDate: today, lastWeekKey: "2020-W1",
              items: [{ id: "t2", text: "B", completed: true, status: "done" }] },
          ],
        }],
        activeGoalId: "goal-1",
      },
      1,
    );
    const useStore = await freshStore();
    await rehydrated(useStore);
    const cats = useStore.getState().goals[0].categories;
    // daily category reset to today + all items open again
    expect(cats[0].lastResetDate).toBe(today);
    expect(cats[0].items.every((i) => !i.completed && i.status === "todo")).toBe(true);
    // weekly category reset to this ISO week
    expect(cats[1].lastWeekKey).toBe(week);
    expect(cats[1].items.every((i) => !i.completed)).toBe(true);
  });

  it("exportWorkspace produces a versioned envelope importWorkspace accepts", async () => {
    seedEnvelope(LEGACY_V1, 1);
    const useStore = await freshStore();
    await rehydrated(useStore);

    const json = useStore.getState().exportWorkspace();
    const parsed = JSON.parse(json) as { app: string; edition: string; version: number; state: Record<string, unknown> };
    expect(parsed.version).toBe(STORAGE_VERSION);
    expect(parsed.edition).toBe("pro");
    expect(Array.isArray(parsed.state.goals)).toBe(true);
    expect(parsed.state.searchQuery).toBeUndefined();

    expect(useStore.getState().importWorkspace(json)).toBe(true);
    expect(useStore.getState().importWorkspace("not json at all")).toBe(false);
    expect(useStore.getState().importWorkspace("{}")).toBe(false);
  });
});
