import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDB_NAME, KV_STORE, LEGACY_IMPORT_MARKER } from "@/lib/goalcheck/idb";
import { STORAGE_KEY, STORAGE_VERSION } from "@/lib/goalcheck/types";
import type { GoalCheckState } from "@/lib/goalcheck/types";

/*
 * v4 -> v5 schema migration tests (task 17-a).
 *
 * Layer 1 (pure): migratePersistedState(v4 fixture, 4) — every goal/task
 *   gains the required v5 fields (archived / estimate / attachments) with
 *   their defaults while every pre-existing value survives byte-for-byte.
 * Layer 2 (integration): seed the legacy localStorage payload and rehydrate
 *   the real zustand store — the one-time localStorage -> IDB import runs,
 *   migration applies, and the localStorage backup stays untouched.
 */

const V4_STATE = {
  theme: "sakura",
  particles: "stardust",
  activeGoalId: "goal-1",
  view: "kanban",
  filter: "priority",
  layoutMode: "grid",
  goals: [
    {
      id: "goal-1", title: "Launch", subtitle: "pre-v5 board", media: "🚀", createdAt: 1700000000000,
      categories: [
        {
          id: "cat-1", title: "Build -", media: "mono:tools-wrench", recurrence: "weekdays",
          lastResetDate: "2026-02-09", lastWeekKey: "2026-W6",
          items: [
            {
              id: "t1", text: "Write spec", completed: true, priority: "high", notes: "keep my note",
              status: "done", subtasks: [{ id: "s1", text: "outline", completed: true }],
              pomosEstimate: 2, pomoCount: 5, dependsOn: "", dueDate: "2026-02-10",
              timeSpent: 3600, recurrence: "weekdays", respawnedFrom: "", completedAt: 1770000000000,
              createdAt: 1699000000000,
            },
            {
              id: "t2", text: "Ship it", completed: false, priority: "urgent", notes: "",
              status: "todo", subtasks: [], pomosEstimate: 3, pomoCount: 0, dependsOn: "t1",
              dueDate: "", timeSpent: 0, recurrence: "every:3", respawnedFrom: "t0", completedAt: 0,
              createdAt: 1699000000001,
            },
          ],
        },
      ],
    },
    { id: "goal-2", title: "Keep", subtitle: "", media: "🎯", createdAt: 1, categories: [] },
  ],
  pomo: { mode: "long", focusMinutes: 50, running: false, endsAt: 0, remainingMs: 900000, attachedTaskId: "t2" },
  rpg: { enabled: true, xp: 1234, level: 5, combo: 2, skillPoints: 3, skills: { "xp-boost": true }, aura: "solar", history: { "2026-02-09": 4 } },
  analytics: { focusSeconds: 7200, hourCounts: { "9": 2 }, perGoal: { "goal-1": 600 } },
  settings: {
    rpgEnabled: true, heatmapEnabled: false, autoParent: false, reduceEffects: true,
    colorMode: "system", cursorPhysics: "repel", simSpeed: 1.25, simDensity: 60,
    audioGain: 1.1, audioStream: "rain", chimePack: "marimba", chimeVolume: 0.5,
    onboardingDone: true, lastBackupAt: 1700000001000, backupNudgeDismissedAt: 1700000002000,
    syncFileEnabled: true, syncFileEncrypted: true, streakFreezes: false, fontScale: 1.2,
    lastDoctorScanAt: 1700000003000, remindersEnabled: true, snapshotCadence: "weekly",
    snapshotsToKeep: 8,
  },
  brandMedia: "mono:rocket-launch",
  habits: [{ id: "h1", title: "Read", cadence: "weekly", marks: { "2026-W6": true }, createdAt: 5, freezes: 1 }],
  achievements: { "first-task": 1600000000000 },
  customTheme: { "--gc-accent": "#abcdef" },
  reviews: [{ id: "r1", weekKey: "2026-W6", createdAt: 42, completedCount: 7, carriedOver: ["carry"], focus: ["focus"], note: "note" }],
  activeTimer: { catId: "cat-1", taskId: "t2", startedAt: Date.now() - 1000 },
};

/** Remove the v5 fields so a migrated state can be compared against the raw pre-v5 fixture. */
function stripV5(state: GoalCheckState): unknown {
  return {
    ...state,
    goals: state.goals.map((g) => {
      const { archived, ...restG } = g;
      void archived;
      return {
        ...restG,
        categories: g.categories.map((c) => ({
          ...c,
          items: c.items.map((it) => {
            const { estimate, attachments, ...restT } = it;
            void estimate;
            void attachments;
            return restT;
          }),
        })),
      };
    }),
  };
}

function wipeIdb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(IDB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => setTimeout(resolve, 50);
  });
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  await wipeIdb();
});

async function freshMigrate() {
  vi.resetModules();
  const mod = await import("@/lib/goalcheck/store");
  return mod.migratePersistedState;
}

async function freshStore() {
  vi.resetModules();
  const mod = await import("@/lib/goalcheck/store");
  return mod.useStore;
}

describe("migratePersistedState — v4 fixture -> v5", () => {
  it("applies the three v5 defaults to every goal/task", async () => {
    const migrate = await freshMigrate();
    const migrated = migrate(V4_STATE, 4);

    expect(migrated.goals).toHaveLength(2);
    for (const g of migrated.goals) {
      expect(g.archived).toBe(false);
      for (const c of g.categories) {
        for (const t of c.items) {
          expect(t.estimate).toBe(0);
          expect(t.attachments).toEqual([]);
        }
      }
    }
    expect(migrated.goals[0].categories[0].items).toHaveLength(2);
  });

  it("preserves all pre-v5 data byte-for-byte (v5 fields aside)", async () => {
    const migrate = await freshMigrate();
    const migrated = migrate(V4_STATE, 4);
    expect(stripV5(migrated)).toEqual(V4_STATE);
  });

  it("keeps v4.3 smart recurrence on tasks AND categories", async () => {
    const migrate = await freshMigrate();
    const migrated = migrate(V4_STATE, 4);
    expect(migrated.goals[0].categories[0].recurrence).toBe("weekdays");
    expect(migrated.goals[0].categories[0].items[0].recurrence).toBe("weekdays");
    expect(migrated.goals[0].categories[0].items[1].recurrence).toBe("every:3");
  });

  it("preserves v4 settings stored inside the settings object", async () => {
    const migrate = await freshMigrate();
    const s = migrate(V4_STATE, 4).settings;
    expect(s.heatmapEnabled).toBe(false);
    expect(s.autoParent).toBe(false);
    expect(s.syncFileEncrypted).toBe(true);
    expect(s.streakFreezes).toBe(false);
    expect(s.fontScale).toBe(1.2);
    expect(s.lastDoctorScanAt).toBe(1700000003000);
    expect(s.remindersEnabled).toBe(true);
    expect(s.snapshotCadence).toBe("weekly");
    expect(s.snapshotsToKeep).toBe(8);
    expect(s.onboardingDone).toBe(true);
  });

  it("preserves pomo preferences from v4 envelopes (never resurrects a running timer)", async () => {
    const migrate = await freshMigrate();
    const p = migrate({ ...V4_STATE, pomo: { ...V4_STATE.pomo, running: true, endsAt: 123 } }, 4).pomo;
    expect(p.mode).toBe("long");
    expect(p.focusMinutes).toBe(50);
    expect(p.remainingMs).toBe(900000);
    expect(p.attachedTaskId).toBe("t2");
    expect(p.running).toBe(false);
    expect(p.endsAt).toBe(0);
  });

  it("passes v5 values through untouched (idempotent on already-migrated data)", async () => {
    const migrate = await freshMigrate();
    const meta = { id: "att_x", name: "proof.png", mime: "image/png", size: 1234, addedAt: 77 };
    // deep-clone: never mutate the shared V4_STATE fixture from other tests
    const withV5 = JSON.parse(JSON.stringify(V4_STATE)) as typeof V4_STATE & { goals: Record<string, unknown>[] };
    withV5.goals[0] = { ...withV5.goals[0], archived: true };
    (withV5.goals[0].categories[0].items[0] as Record<string, unknown>).estimate = 7;
    (withV5.goals[0].categories[0].items[0] as Record<string, unknown>).attachments = [meta];
    const migrated = migrate(withV5, 4);
    expect(migrated.goals[0].archived).toBe(true);
    expect(migrated.goals[0].categories[0].items[0].estimate).toBe(7);
    expect(migrated.goals[0].categories[0].items[0].attachments).toEqual([meta]);
    expect(migrated.goals[1].archived).toBe(false);
  });

  it("still migrates the legacy v0/v1 flat shape with the v5 defaults", async () => {
    const migrate = await freshMigrate();
    const legacyV1 = {
      theme: "sakura", view: "kanban", activeGoalId: "goal-1",
      goals: [{
        id: "goal-1", title: "Old", subtitle: "", media: "🎯", createdAt: 123,
        categories: [{
          id: "cat-1", title: "Daily -", media: "📌", recurrence: "daily",
          lastResetDate: "2020-01-01", lastWeekKey: "2020-W1",
          items: [{ id: "t1", text: "Legacy", completed: false, priority: "normal", notes: "", status: "todo" }],
        }],
      }],
      rpg: { enabled: true, xp: 9, level: 1, combo: 0, skillPoints: 1, skills: {}, aura: "", history: {} },
    };
    const migrated = migrate(legacyV1, 1);
    expect(migrated.goals[0].title).toBe("Old");
    expect(migrated.goals[0].archived).toBe(false);
    expect(migrated.goals[0].categories[0].items[0]).toMatchObject({ text: "Legacy", estimate: 0, attachments: [] });
    expect(migrated.rpg.xp).toBe(9);
  });
});

describe("v5 rehydration — store + IDB integration", () => {
  it("rehydrates a v4 envelope from localStorage via the one-time IDB import", async () => {
    const legacyEnvelope = JSON.stringify({ state: V4_STATE, version: 4 });
    localStorage.setItem(STORAGE_KEY, legacyEnvelope);
    const useStore = await freshStore();
    await Promise.resolve(useStore.persist.rehydrate());
    const s = useStore.getState();

    // hydration contract intact
    expect(s._hydrated).toBe(true);

    // v5 fields applied, data preserved
    expect(s.goals[0].archived).toBe(false);
    const items = s.goals[0].categories[0].items;
    expect(items[0]).toMatchObject({ text: "Write spec", estimate: 0, attachments: [], notes: "keep my note" });
    expect(s.goals[0].categories[0].recurrence).toBe("weekdays");
    expect(s.settings.fontScale).toBe(1.2);
    expect(s.settings.heatmapEnabled).toBe(false);
    expect(s.pomo.focusMinutes).toBe(50);

    // the migrated v5 envelope was written back into IDB kv (recurring resets
    // touch state post-hydration) + the marker was written
    const idb = await import("@/lib/goalcheck/idb");
    const kvEnvelope = JSON.parse((await idb.idbGet<string>(KV_STORE, STORAGE_KEY))!) as { version: number; state: GoalCheckState };
    expect(kvEnvelope.version).toBe(STORAGE_VERSION);
    expect(kvEnvelope.state.goals[0].archived).toBe(false);
    expect(kvEnvelope.state.goals[0].categories[0].items[0].estimate).toBe(0);
    expect(kvEnvelope.state.goals[0].categories[0].items[0].text).toBe("Write spec");
    expect(await idb.idbGet(KV_STORE, LEGACY_IMPORT_MARKER)).toBeTruthy();

    // belt-and-braces: the localStorage backup is NOT deleted
    expect(localStorage.getItem(STORAGE_KEY)).toBe(legacyEnvelope);
  });

  it("runs the legacy import exactly once across store re-creations", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: V4_STATE, version: 4 }));
    const first = await freshStore();
    await Promise.resolve(first.persist.rehydrate());
    expect(first.getState().theme).toBe("sakura");

    // new module registry (like a second page load), same IDB store
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { ...V4_STATE, theme: "tampered" }, version: 4 }));
    const second = await freshStore();
    await Promise.resolve(second.persist.rehydrate());
    expect(second.getState().theme).toBe("sakura"); // served from IDB, not the re-seeded LS copy
  });

  it("rehydrates a current-version (v5) envelope untouched through IDB", async () => {
    // build a real v5 state with the migrator, then flag one board archived
    const migrate = await freshMigrate();
    const v5State = migrate(V4_STATE, 4);
    v5State.goals[0] = { ...v5State.goals[0], archived: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: v5State, version: STORAGE_VERSION }));
    const useStore = await freshStore();
    await Promise.resolve(useStore.persist.rehydrate());
    const s = useStore.getState();
    expect(s._hydrated).toBe(true);
    expect(s.theme).toBe("sakura");
    expect(s.goals[0].archived).toBe(true); // no migrate on current version — pass-through
    expect(s.goals[0].categories[0].items[0].estimate).toBe(0);
    expect(s.goals[0].categories[0].items[0].attachments).toEqual([]);
  });

  it("fresh installs hydrate the default demo workspace with v5 fields", async () => {
    const useStore = await freshStore();
    await Promise.resolve(useStore.persist.rehydrate());
    const s = useStore.getState();
    expect(s._hydrated).toBe(true);
    expect(s.goals.length).toBeGreaterThan(0);
    for (const g of s.goals) {
      expect(typeof g.archived).toBe("boolean");
      for (const c of g.categories) {
        for (const t of c.items) {
          expect(t.estimate).toBe(0);
          expect(t.attachments).toEqual([]);
        }
      }
    }
  });
});
