import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { isoWeekKey, localDateKey } from "@/lib/goalcheck/logic";
import type { GoalBoard } from "@/lib/goalcheck/types";

/*
 * Edition clamp tests — the base edition must never leak pro-only
 * state (views, particle engines, pro themes), and both editions
 * must share the same storage key by design (lossless upgrade).
 */

const ENV_BACKUP = process.env.NEXT_PUBLIC_GC_EDITION;

afterAll(() => {
  process.env.NEXT_PUBLIC_GC_EDITION = ENV_BACKUP;
});

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  // fresh fake IndexedDB per test (v5 storage engine) — legacy import marker must not leak
  (globalThis as { indexedDB: unknown }).indexedDB = new IDBFactory();
});

async function importEditions(edition?: "base" | "pro") {
  vi.resetModules();
  if (edition) process.env.NEXT_PUBLIC_GC_EDITION = edition;
  else delete process.env.NEXT_PUBLIC_GC_EDITION;
  return import("@/lib/goalcheck/editions");
}

async function importThemes(edition?: "base" | "pro") {
  vi.resetModules();
  if (edition) process.env.NEXT_PUBLIC_GC_EDITION = edition;
  else delete process.env.NEXT_PUBLIC_GC_EDITION;
  return import("@/lib/goalcheck/themes");
}

async function importStore(edition?: "base" | "pro") {
  vi.resetModules();
  if (edition) process.env.NEXT_PUBLIC_GC_EDITION = edition;
  else delete process.env.NEXT_PUBLIC_GC_EDITION;
  const mod = await import("@/lib/goalcheck/store");
  return mod.useStore;
}

function boardWithKanbanState(): Record<string, unknown> {
  return {
    theme: "sakura",       // pro light theme
    view: "kanban",        // pro-only view
    particles: "fire",     // pro-only engine
    activeGoalId: "goal-1",
    goals: [{
      id: "goal-1", title: "G", subtitle: "", media: "m", createdAt: 1,
      categories: [{
        id: "cat-1", title: "C -", media: "m", recurrence: "none",
        lastResetDate: localDateKey(new Date()), lastWeekKey: isoWeekKey(new Date()), items: [],
      }],
    }] satisfies GoalBoard[],
  };
}

describe("Advance (pro) edition", () => {
  it("exposes every feature", async () => {
    const editions = await importEditions("pro");
    expect(editions.EDITION).toBe("pro");
    expect(editions.APP_NAME).toBe("GoalCheck Advance");
    expect(editions.hasFeature("views.advanced")).toBe(true);
    expect(editions.hasFeature("rpg")).toBe(true);
    expect(editions.hasFeature("habits")).toBe(true);
    expect(editions.hasFeature("particles")).toBe(true);
    expect(editions.themeAvailable("sakura")).toBe(true);
  });

  it("keeps pro themes through the clamp", async () => {
    const themes = await importThemes("pro");
    expect(themes.clampThemeForEdition("sakura")).toBe("sakura");
    expect(themes.clampThemeForEdition("cyberpunk")).toBe("cyberpunk");
  });
});

describe("GoalCheck (base) edition", () => {
  it("hides every pro-only feature and keeps the base name", async () => {
    const editions = await importEditions("base");
    expect(editions.EDITION).toBe("base");
    expect(editions.APP_NAME).toBe("GoalCheck");
    expect(editions.hasFeature("views.advanced")).toBe(false);
    expect(editions.hasFeature("rpg")).toBe(false);
    expect(editions.hasFeature("particles")).toBe(false);
    expect(editions.hasFeature("audio-studio")).toBe(false);
    expect(editions.hasFeature("command-palette")).toBe(false);
    expect(editions.hasFeature("habits")).toBe(false);
    expect(editions.hasFeature("achievements")).toBe(false);
    expect(editions.hasFeature("due-dates")).toBe(false);
    expect(editions.hasFeature("recurring-tasks")).toBe(false);
    expect(editions.themeAvailable("sakura")).toBe(false);
    expect(editions.themeAvailable("nordic")).toBe(true); // base light theme
  });

  it("clamps pro themes to the nearest base default", async () => {
    const themes = await importThemes("base");
    expect(themes.clampThemeForEdition("sakura")).toBe(themes.DEFAULT_LIGHT_THEME); // light -> nordic
    expect(themes.clampThemeForEdition("cyberpunk")).toBe(themes.DEFAULT_DARK_THEME); // dark -> nebula
    expect(themes.clampThemeForEdition("nordic")).toBe("nordic"); // base themes untouched
    expect(themes.clampThemeForEdition("nebula")).toBe("nebula");
  });

  it("clamps pro-only persisted state on migration (view/particles/theme)", async () => {
    localStorage.setItem(
      "goalcheck_pro_state",
      JSON.stringify({ state: boardWithKanbanState(), version: 1 }),
    );
    const useStore = await importStore("base");
    await useStore.persist.rehydrate();
    await vi.waitFor(() => expect(useStore.getState()._hydrated).toBe(true), { timeout: 5_000 });
    const s = useStore.getState();

    expect(s.view).toBe("checklist");  // kanban clamped
    expect(s.particles).toBe("off");   // engine disabled in base
    expect(s.theme).toBe("nordic");    // sakura (light) -> nordic
    // user data still intact despite the clamps
    expect(s.goals[0].title).toBe("G");
    expect(s.activeGoalId).toBe("goal-1");
  });

  it("shares the storage key with Advance by design", async () => {
    const editions = await importEditions("base");
    // Both editions read the same key so base->Advance upgrades keep every byte.
    expect(editions.SHARED_STORAGE_NOTE).toContain("never loses data");
    const { STORAGE_KEY } = await import("@/lib/goalcheck/types");
    expect(STORAGE_KEY).toBe("goalcheck_pro_state");
  });
});
