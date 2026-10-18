"use client";

/* =========================================================
   GoalCheck (Advance edition) — Typed Zustand store
   - localStorage persistence WITH schema version + migration
     (auto-imports the legacy v1 key from the old HTML app)
   - timestamp-based pomodoro (drift-free, survives reload)
   - effects bus for imperative canvas/audio celebrations
   ========================================================= */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { notify, notifyError, notifySuccess } from "./notify";
import type { ChimePack } from "./types";
import type {
  Category, FilterId, GoalBoard, GoalCheckState, Habit, PomoMode, Priority,
  Task, WorkspaceView, ParticleEngineId, CursorPhysics,
} from "./types";
import { STORAGE_KEY, STORAGE_VERSION } from "./types";
import {
  blankBoard, calculateStats, comboMultiplier, computeStreaks, evaluateAchievements, goalFromTemplate,
  habitPeriodKey, habitStreak, isoWeekKey, localDateKey, levelFromXp, makeCategory, makeId, makeTask,
  rankForLevel, ACHIEVEMENTS,
} from "./logic";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, isLightTheme, themeExists, clampThemeForEdition, GC_THEME_VARS } from "./themes";
import { EDITION, IS_PRO, APP_NAME } from "./editions";

/* ---------- effects bus (confetti / ripple / chime / xp floats) ---------- */

export type BusEvent =
  | { type: "confetti" }
  | { type: "ripple"; x?: number; y?: number }
  | { type: "chime"; kind: "celebrate" | "pomo-done" | "tap" | "complete" | "levelup"; priority?: "normal" | "high" | "urgent" }
  | { type: "xp"; text: string; x: number; y: number };

type Listener = (e: BusEvent) => void;
const listeners = new Set<Listener>();
export const bus = {
  emit(e: BusEvent) { listeners.forEach((l) => l(e)); },
  on(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};

/* ---------- defaults ---------- */

function defaultState(): GoalCheckState {
  const g1 = goalFromTemplate("devices");
  const g2 = goalFromTemplate("vacation");
  const g3 = goalFromTemplate("exam");
  return {
    theme: DEFAULT_DARK_THEME,
    particles: IS_PRO ? "fire" : "off",
    activeGoalId: g1.id,
    view: "checklist",
    filter: "all",
    layoutMode: "grid",
    goals: [g1, g2, g3],
    pomo: { mode: "focus", focusMinutes: 25, running: false, endsAt: 0, remainingMs: 25 * 60_000, attachedTaskId: "" },
    rpg: { enabled: true, xp: 0, level: 1, combo: 0, skillPoints: 1, skills: {}, aura: "", history: {} },
    analytics: { focusSeconds: 0, hourCounts: {}, perGoal: {} },
    settings: {
      rpgEnabled: true, heatmapEnabled: true, autoParent: true, reduceEffects: false,
      colorMode: "manual", cursorPhysics: "orbit", simSpeed: 1, simDensity: 70, audioGain: 1.5, audioStream: "lofi",
      chimePack: "glass", chimeVolume: 0.8,
      onboardingDone: false, lastBackupAt: 0, backupNudgeDismissedAt: 0, syncFileEnabled: false,
    },
    brandMedia: "mono:rocket-launch",
    habits: [],
    achievements: {},
    customTheme: {},
  };
}

/* ---------- normalization for loaded data ---------- */

function normalizeGoal(g: Partial<GoalBoard>): GoalBoard {
  return {
    id: g.id || makeId("goal"),
    title: g.title || "Untitled Board",
    subtitle: g.subtitle || "",
    media: g.media || "🎯",
    createdAt: g.createdAt || Date.now(),
    categories: (g.categories || []).map((c): Category => ({
      id: c.id || makeId("cat"),
      title: c.title || "Untitled -",
      media: c.media || "📌",
      recurrence: c.recurrence === "daily" || c.recurrence === "weekly" ? c.recurrence : "none",
      lastResetDate: c.lastResetDate || localDateKey(new Date()),
      lastWeekKey: c.lastWeekKey || isoWeekKey(new Date()),
      items: (c.items || []).map((it): Task => ({
        id: it.id || makeId("task"),
        text: it.text || "",
        completed: !!it.completed,
        priority: it.priority === "high" || it.priority === "urgent" ? it.priority : "normal",
        notes: it.notes || "",
        status: it.status === "doing" ? "doing" : it.completed ? "done" : "todo",
        subtasks: (it.subtasks || []).map((s) => ({ id: s.id || makeId("sub"), text: s.text || "", completed: !!s.completed })),
        pomosEstimate: typeof it.pomosEstimate === "number" && it.pomosEstimate > 0 ? it.pomosEstimate : 1,
        pomoCount: typeof it.pomoCount === "number" ? it.pomoCount : 0,
        dependsOn: it.dependsOn || "",
        dueDate: typeof it.dueDate === "string" ? it.dueDate : "",
        recurrence: it.recurrence === "daily" || it.recurrence === "weekly" ? it.recurrence : "none",
        respawnedFrom: typeof it.respawnedFrom === "string" ? it.respawnedFrom : "",
        createdAt: it.createdAt || Date.now(),
      })),
    })),
  };
}

/** Legacy v1 (flat HTML app) -> v2 shape */
function migrateLegacyV1(p: Record<string, unknown>): GoalCheckState {
  const d = defaultState();
  const rpg = (p.rpg || {}) as Record<string, unknown>;
  const legacySettings = (p as { settings?: Record<string, unknown> }).settings;
  const s = d.settings;
  const loadedGoals = Array.isArray(p.goals) ? (p.goals as Partial<GoalBoard>[]).map(normalizeGoal) : d.goals;
  return {
    ...d,
    goals: loadedGoals,
    activeGoalId: (typeof p.activeGoalId === "string" && loadedGoals.some((g) => g.id === p.activeGoalId))
      ? p.activeGoalId : loadedGoals[0]?.id || d.activeGoalId,
    /* edition clamps: base edition quietly falls back to its own themes/view/engines */
    theme: themeExists(p.theme as string) ? clampThemeForEdition(p.theme as string) : d.theme,
    particles: IS_PRO ? ((p.particles as ParticleEngineId) || d.particles) : "off",
    view: IS_PRO ? ((p.view as WorkspaceView) || d.view) : "checklist",
    layoutMode: p.layoutMode === "single" ? "single" : "grid",
    rpg: {
      enabled: typeof rpg.enabled === "boolean" ? rpg.enabled : true,
      xp: typeof rpg.xp === "number" ? rpg.xp : 0,
      level: typeof rpg.level === "number" ? rpg.level : 1,
      combo: typeof rpg.combo === "number" ? rpg.combo : 0,
      skillPoints: typeof rpg.skillPoints === "number" ? rpg.skillPoints : 1,
      skills: (rpg.skills && typeof rpg.skills === "object" ? rpg.skills : {}) as Record<string, boolean>,
      aura: typeof rpg.aura === "string" ? rpg.aura : "",
      history: (rpg.history && typeof rpg.history === "object" ? rpg.history : {}) as Record<string, number>,
    },
    analytics: (p.analytics && typeof p.analytics === "object"
      ? {
          focusSeconds: Number((p.analytics as { focusSeconds?: number }).focusSeconds) || 0,
          hourCounts: (p.analytics as { hourCounts?: Record<string, number> }).hourCounts || {},
          perGoal: ((p.analytics as { perGoal?: Record<string, number> }).perGoal && typeof (p.analytics as { perGoal?: Record<string, number> }).perGoal === "object"
            ? (p.analytics as { perGoal?: Record<string, number> }).perGoal : {}) as Record<string, number>,
        }
      : d.analytics),
    settings: {
      ...s,
      rpgEnabled: typeof rpg.enabled === "boolean" ? rpg.enabled : s.rpgEnabled,
      heatmapEnabled: typeof p.heatmapEnabled === "boolean" ? p.heatmapEnabled : s.heatmapEnabled,
      autoParent: typeof p.autoParent === "boolean" ? p.autoParent : s.autoParent,
      reduceEffects: typeof legacySettings?.reduceEffects === "boolean" ? legacySettings.reduceEffects : false,
      colorMode: legacySettings?.colorMode === "system" ? "system" : "manual",
      cursorPhysics: (legacySettings?.cursorPhysics as CursorPhysics) || (p.cursorPhysics as CursorPhysics) || s.cursorPhysics,
      simSpeed: typeof legacySettings?.simSpeed === "number" ? legacySettings.simSpeed : typeof p.simSpeed === "number" ? p.simSpeed : s.simSpeed,
      simDensity: typeof legacySettings?.simDensity === "number" ? legacySettings.simDensity : typeof p.simDensity === "number" ? p.simDensity : s.simDensity,
      audioGain: typeof legacySettings?.audioGain === "number" ? legacySettings.audioGain : typeof p.audioGain === "number" ? p.audioGain : s.audioGain,
      audioStream: typeof legacySettings?.audioStream === "string" ? legacySettings.audioStream : typeof p.audioStream === "string" ? p.audioStream : s.audioStream,
      chimePack: (legacySettings?.chimePack as ChimePack) || s.chimePack,
      chimeVolume: typeof legacySettings?.chimeVolume === "number" ? legacySettings.chimeVolume : s.chimeVolume,
      onboardingDone: legacySettings?.onboardingDone === true,
      lastBackupAt: typeof legacySettings?.lastBackupAt === "number" ? legacySettings.lastBackupAt : 0,
      backupNudgeDismissedAt: typeof legacySettings?.backupNudgeDismissedAt === "number" ? legacySettings.backupNudgeDismissedAt : 0,
      syncFileEnabled: legacySettings?.syncFileEnabled === true,
    },
    brandMedia: (p.brandMedia as string) || d.brandMedia,
    habits: (Array.isArray(p.habits) ? p.habits : []).map((raw): Habit => {
      const h = raw as Partial<Habit>;
      return {
        id: h.id || makeId("habit"),
        title: h.title || "Untitled habit",
        cadence: h.cadence === "weekly" ? "weekly" : "daily",
        marks: (h.marks && typeof h.marks === "object" ? h.marks : {}) as Record<string, boolean>,
        createdAt: h.createdAt || Date.now(),
      };
    }),
    achievements: (p.achievements && typeof p.achievements === "object" ? p.achievements : {}) as Record<string, number>,
    customTheme: (p.customTheme && typeof p.customTheme === "object" ? p.customTheme : {}) as Record<string, string>,
  };
}

/* ---------- store ---------- */

interface Transient {
  searchQuery: string;
  openSubtaskId: string | null;
  editingCategoryId: string | null;
  editingTaskId: string | null;
  quickCatMedia: string;
  _hydrated: boolean;
}

interface Store extends GoalCheckState, Transient {
  setHydrated: () => void;

  /* theme & atmosphere */
  setTheme: (t: string, origin?: { x: number; y: number }) => void;
  quickLightDark: (origin?: { x: number; y: number }) => void;
  setColorMode: (m: "manual" | "system") => void;
  setParticles: (p: ParticleEngineId) => void;
  setPhysics: (p: CursorPhysics) => void;
  setSim: (patch: { simSpeed?: number; simDensity?: number }) => void;

  /* navigation */
  setView: (v: WorkspaceView) => void;
  setFilter: (f: FilterId) => void;
  setLayout: (m: "grid" | "single") => void;
  setSearch: (q: string) => void;
  setActiveGoal: (id: string) => void;

  /* boards */
  addBoard: (title: string, subtitle: string) => void;
  updateBoard: (title: string, subtitle: string) => void;
  deleteBoard: (id: string) => void;
  loadTemplate: (key: string) => void;
  setBoardMedia: (media: string) => void;

  /* categories */
  addCategory: (title: string, media: string, recurrence: string) => void;
  renameCategory: (id: string, title: string) => void;
  deleteCategory: (id: string) => void;
  toggleAllCategory: (id: string) => void;
  setCategoryMedia: (id: string, media: string) => void;
  setQuickCatMedia: (m: string) => void;

  /* tasks */
  addTask: (catId: string, text: string) => void;
  saveInlineEdit: (catId: string, taskId: string, text: string, notes: string) => void;
  deleteTask: (catId: string, taskId: string) => void;
  moveTask: (catId: string, taskId: string, dir: -1 | 1) => void;
  cyclePriority: (catId: string, taskId: string) => void;
  setTaskAdvanced: (catId: string, taskId: string, patch: { text?: string; priority?: Priority; pomosEstimate?: number; dependsOn?: string; completed?: boolean; status?: "todo" | "doing" | "done"; dueDate?: string; recurrence?: "none" | "daily" | "weekly" }) => void;
  toggleTask: (catId: string, taskId: string, origin?: { x: number; y: number }) => void;
  setTaskStatus: (taskId: string, status: "todo" | "doing" | "done") => void;
  bindPomo: (taskId: string) => void;
  completeBoundTask: () => void;
  checkAll: () => void;
  resetAll: () => void;
  clearDone: () => void;

  /* subtasks */
  setOpenSubtask: (id: string | null) => void;
  addSubtask: (taskId: string, text: string) => void;
  toggleSubtask: (taskId: string, subId: string) => void;
  deleteSubtask: (taskId: string, subId: string) => void;

  /* inline editing */
  setEditingCategory: (id: string | null) => void;
  setEditingTask: (pair: { catId: string; taskId: string } | null) => void;

  /* pomodoro */
  setPomoMode: (m: PomoMode) => void;
  setPomoMinutes: (mins: number) => void;
  startPausePomo: () => void;
  resetPomo: () => void;

  /* rpg & settings */
  toggleRpg: () => void;
  unlockSkill: (id: string) => void;
  equipAura: (id: string) => void;
  testBoostXp: () => void;
  toggleHeatmap: () => void;
  toggleAutoParent: () => void;
  toggleReduceEffects: () => void;
  setAudio: (patch: { audioGain?: number; audioStream?: string; chimePack?: ChimePack; chimeVolume?: number }) => void;

  /* recurring + data */
  applyRecurringResets: () => void;
  exportWorkspace: () => string;
  importWorkspace: (json: string) => boolean;
  resetWorkspace: () => void;

  /* v4 — Advance: habits */
  addHabit: (title: string, cadence: "daily" | "weekly") => void;
  removeHabit: (id: string) => void;
  toggleHabitPeriod: (id: string) => void;

  /* v4 — Advance: achievements, doctor, theme share, backup, onboarding */
  evaluateAndUnlockAchievements: () => void;
  runDoctor: () => { issues: string[]; fixed: number };
  importThemeJson: (json: string) => boolean;
  exportThemeJson: () => string;
  touchBackup: () => void;
  dismissBackupNudge: () => void;
  setSyncFileEnabled: (v: boolean) => void;
  completeOnboarding: () => void;

  /* internal RPG hooks (used by toggle flows) */
  internalOnTaskCompleted: (taskId: string, origin?: { x: number; y: number }) => void;
  internalOnTaskUnchecked: () => void;
  internalAwardXp: (amount: number, origin: { x: number; y: number }, reason: string) => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...defaultState(),
      searchQuery: "",
      openSubtaskId: null as string | null,
      editingCategoryId: null as string | null,
      editingTaskId: null as string | null,
      quickCatMedia: "mono:laptop-code",
      _hydrated: false,
      setHydrated: () => set({ _hydrated: true }),

      /* ---------- theme & atmosphere ---------- */
      setTheme: (t, origin) => {
        if (!themeExists(t)) return;
        bus.emit({ type: "ripple", x: origin?.x, y: origin?.y });
        set({ theme: t });
      },
      quickLightDark: (origin) => {
        const next = isLightTheme(get().theme) ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
        get().setTheme(next, origin);
        notify(next === DEFAULT_LIGHT_THEME ? "Light mode" : "Dark mode", "contrast-half");
      },
      setColorMode: (m) => set((s) => ({ settings: { ...s.settings, colorMode: m } })),
      setParticles: (p) => set({ particles: IS_PRO ? p : "off" }),
      setPhysics: (p) => set((s) => ({ settings: { ...s.settings, cursorPhysics: p } })),
      setSim: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      /* ---------- navigation ---------- */
      setView: (v) => set({ view: IS_PRO || v === "checklist" ? v : "checklist" }),
      setFilter: (f) => set({ filter: f }),
      setLayout: (m) => set({ layoutMode: m }),
      setSearch: (q) => set({ searchQuery: q }),
      setActiveGoal: (id) => set({ activeGoalId: id, editingCategoryId: null, editingTaskId: null }),

      /* ---------- boards ---------- */
      addBoard: (title, subtitle) => {
        if (!title.trim()) return;
        const b = blankBoard(title.trim(), subtitle.trim());
        set((s) => ({ goals: [b, ...s.goals], activeGoalId: b.id }));
        notify(`Created goal board: ${title}`, "plus-round");
      },
      updateBoard: (title, subtitle) => {
        set((s) => ({
          goals: s.goals.map((g) => (g.id === s.activeGoalId ? { ...g, title: title.trim() || g.title, subtitle: subtitle.trim() } : g)),
        }));
        notify("Updated board details.", "pencil-line");
      },
      deleteBoard: (id) => {
        set((s) => {
          if (s.goals.length <= 1) { notifyError("You must keep at least one goal board."); return s; }
          const goals = s.goals.filter((g) => g.id !== id);
          return { goals, activeGoalId: goals[0]?.id || "" };
        });
        notify("Board deleted.", "trash-flame");
      },
      loadTemplate: (key) => {
        if (!IS_PRO) {
          notifyError("Goal templates are a GoalCheck Advance feature.");
          return;
        }
        const g = goalFromTemplate(key);
        if (!g) return;
        set((s) => ({ goals: [g, ...s.goals], activeGoalId: g.id }));
        notify(`Loaded "${g.title}" template!`, "rocket-launch");
      },
      setBoardMedia: (media) => {
        set((s) => ({ goals: s.goals.map((g) => (g.id === s.activeGoalId ? { ...g, media } : g)) }));
        notify("Updated goal board icon!", "image-pic");
      },

      /* ---------- categories ---------- */
      addCategory: (title, media, recurrence) => {
        const t = title.trim();
        if (!t) return;
        const cat = makeCategory(t, media || get().quickCatMedia, recurrence);
        set((s) => ({
          goals: s.goals.map((g) => (g.id === s.activeGoalId ? { ...g, categories: [...g.categories, cat] } : g)),
        }));
        notify(`Added category: ${cat.title}`, "folder-open");
      },
      renameCategory: (id, title) => {
        const clean = title.trim().replace(/\s*[-:]$/, "") + " -";
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? { ...g, categories: g.categories.map((c) => (c.id === id ? { ...c, title: clean } : c)) }
            : g),
        }));
      },
      deleteCategory: (id) => {
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? { ...g, categories: g.categories.filter((c) => c.id !== id) }
            : g),
        }));
        notify("Category removed.", "trash-flame");
      },
      toggleAllCategory: (id) => {
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? {
                ...g,
                categories: g.categories.map((c) => {
                  if (c.id !== id || c.items.length === 0) return c;
                  const allDone = c.items.every((it) => it.completed);
                  return { ...c, items: c.items.map((it) => ({ ...it, completed: !allDone, status: !allDone ? "done" : "todo" })) };
                }),
              }
            : g),
        }));
      },
      setCategoryMedia: (id, media) => {
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? { ...g, categories: g.categories.map((c) => (c.id === id ? { ...c, media } : c)) }
            : g),
        }));
        notify("Category badge updated!", "image-pic");
      },
      setQuickCatMedia: (m) => set({ quickCatMedia: m }),

      /* ---------- tasks ---------- */
      addTask: (catId, text) => {
        const t = text.trim().replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "");
        if (!t) return;
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? { ...g, categories: g.categories.map((c) => (c.id === catId ? { ...c, items: [...c.items, makeTask(t)] } : c)) }
            : g),
        }));
      },
      saveInlineEdit: (catId, taskId, text, notes) => {
        const t = text.trim();
        if (!t) return;
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? {
                ...g,
                categories: g.categories.map((c) => c.id === catId
                  ? { ...c, items: c.items.map((it) => (it.id === taskId ? { ...it, text: t, notes: notes.trim() } : it)) }
                  : c),
              }
            : g),
        }));
        set({ editingTaskId: null });
      },
      deleteTask: (catId, taskId) => {
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? { ...g, categories: g.categories.map((c) => (c.id === catId ? { ...c, items: c.items.filter((it) => it.id !== taskId) } : c)) }
            : g),
        }));
      },
      moveTask: (catId, taskId, dir) => {
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? {
                ...g,
                categories: g.categories.map((c) => {
                  if (c.id !== catId) return c;
                  const idx = c.items.findIndex((it) => it.id === taskId);
                  const target = idx + dir;
                  if (idx === -1 || target < 0 || target >= c.items.length) return c;
                  const items = [...c.items];
                  [items[idx], items[target]] = [items[target], items[idx]];
                  return { ...c, items };
                }),
              }
            : g),
        }));
      },
      cyclePriority: (catId, taskId) => {
        const order: Priority[] = ["normal", "high", "urgent"];
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? {
                ...g,
                categories: g.categories.map((c) => c.id === catId
                  ? {
                      ...c,
                      items: c.items.map((it) => it.id === taskId
                        ? { ...it, priority: order[(order.indexOf(it.priority || "normal") + 1) % order.length] }
                        : it),
                    }
                  : c),
              }
            : g),
        }));
      },
      setTaskAdvanced: (catId, taskId, patch) => {
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? {
                ...g,
                categories: g.categories.map((c) => c.id === catId
                  ? { ...c, items: c.items.map((it) => (it.id === taskId ? { ...it, ...patch } : it)) }
                  : c),
              }
            : g),
        }));
      },
      toggleTask: (catId, taskId, origin) => {
        const s = get();
        const goal = s.goals.find((g) => g.id === s.activeGoalId);
        if (!goal) return;
        const cat = goal.categories.find((c) => c.id === catId);
        const item = cat?.items.find((it) => it.id === taskId);
        if (!cat || !item) return;

        if (!item.completed && item.dependsOn) {
          const prereq = goal.categories.flatMap((c) => c.items).find((t) => t.id === item.dependsOn);
          if (prereq && !prereq.completed) {
            notify(`Locked! Complete "${prereq.text}" first.`, "lock-shield");
            return;
          }
        }

        const nowCompleted = !item.completed;
        get().setTaskAdvanced(catId, taskId, { completed: nowCompleted, status: nowCompleted ? "done" : "todo" });

        /* v4 — recurring tasks: respawn the next instance on completion, remove untouched respawn on uncheck */
        if (item.recurrence !== "none") {
          set((st) => ({
            goals: st.goals.map((g) => (g.id !== st.activeGoalId ? g : {
              ...g,
              categories: g.categories.map((c) => {
                if (c.id !== catId) return c;
                if (nowCompleted) {
                  const hasLiveClone = c.items.some((t) => t.respawnedFrom === item.id && !t.completed);
                  if (hasLiveClone) return c;
                  const nextDue = item.dueDate
                    ? localDateKey(new Date(new Date(item.dueDate + "T00:00:00").getTime() + (item.recurrence === "daily" ? 86_400_000 : 7 * 86_400_000)))
                    : "";
                  const clone = makeTask(item.text, {
                    priority: item.priority,
                    notes: item.notes,
                    pomosEstimate: item.pomosEstimate,
                    dueDate: nextDue,
                    recurrence: item.recurrence,
                    respawnedFrom: item.id,
                  });
                  const idx = c.items.findIndex((t) => t.id === item.id);
                  const items = [...c.items];
                  items.splice(idx + 1, 0, clone);
                  return { ...c, items };
                }
                return { ...c, items: c.items.filter((t) => !(t.respawnedFrom === item.id && !t.completed)) };
              }),
            })),
          }));
        }

        if (nowCompleted) {
          bus.emit({ type: "chime", kind: "complete", priority: item.priority });
          get().internalOnTaskCompleted(taskId, origin);
          get().evaluateAndUnlockAchievements();
        } else {
          get().internalOnTaskUnchecked();
        }

        // 100% celebration
        const g2 = get().goals.find((g) => g.id === get().activeGoalId);
        if (g2 && nowCompleted) {
          const stats = calculateStats(g2);
          if (stats.total > 0 && stats.percent === 100) {
            bus.emit({ type: "confetti" });
            notify(`100% Complete on ${g2.title}!`, "party-pop");
            get().internalAwardXp(100, origin ?? { x: 0, y: 0 }, "Board Mastered");
          }
        }
      },
      setTaskStatus: (taskId, status) => {
        const s = get();
        let changed = false;
        const goals = s.goals.map((g) => {
          if (g.id !== s.activeGoalId) return g;
          return {
            ...g,
            categories: g.categories.map((c) => ({
              ...c,
              items: c.items.map((it) => {
                if (it.id !== taskId) return it;
                changed = true;
                return { ...it, status, completed: status === "done" };
              }),
            })),
          };
        });
        if (!changed) return;
        set({ goals });
        const item = goals.flatMap((g) => g.categories.flatMap((c) => c.items)).find((t) => t.id === taskId);
        if (item && status === "done") get().internalOnTaskCompleted(taskId, { x: 0, y: 0 });
        if (item && status !== "done") get().internalOnTaskUnchecked();
        notify(`Moved to ${status.toUpperCase()}`, "kanban-cols");
      },
      bindPomo: (taskId) => {
        set((s) => ({ pomo: { ...s.pomo, attachedTaskId: taskId } }));
        const t = findTask(get(), taskId);
        notify(`Task bound to Pomodoro: ${t?.text ?? ""}`, "tomato-timer");
      },
      completeBoundTask: () => {
        const s = get();
        const boundId = s.pomo.attachedTaskId;
        if (!boundId) { notify("Attach a task first — tap the tomato on any task.", "tomato-timer"); return; }
        let done = false;
        const goals = s.goals.map((g) => g.id !== s.activeGoalId ? g : {
          ...g,
          categories: g.categories.map((c) => ({
            ...c,
            items: c.items.map((it) => {
              if (it.id === boundId && !it.completed) {
                done = true;
                return { ...it, completed: true, status: "done" as const };
              }
              return it;
            }),
          })),
        });
        if (done) {
          set({ goals });
          get().internalOnTaskCompleted(boundId, { x: 0, y: 0 });
          bus.emit({ type: "confetti" });
          notify("Task completed — great focus!", "check-circle");
        } else {
          notify("Task already completed.");
        }
      },
      checkAll: () => {
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? { ...g, categories: g.categories.map((c) => ({ ...c, items: c.items.map((it) => ({ ...it, completed: true, status: "done" as const })) })) }
            : g),
        }));
        bus.emit({ type: "confetti" });
        notify("All items marked complete!", "check-circle");
      },
      resetAll: () => {
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? { ...g, categories: g.categories.map((c) => ({ ...c, items: c.items.map((it) => ({ ...it, completed: false, status: "todo" as const })) })) }
            : g),
        }));
        notify("All items reset.", "undo-ccw");
      },
      clearDone: () => {
        set((s) => ({
          goals: s.goals.map((g) => g.id === s.activeGoalId
            ? { ...g, categories: g.categories.map((c) => ({ ...c, items: c.items.filter((it) => !it.completed) })) }
            : g),
        }));
        notify("Cleared completed tasks.", "broom-sweep");
      },

      /* ---------- subtasks ---------- */
      setOpenSubtask: (id) => set({ openSubtaskId: id }),
      addSubtask: (taskId, text) => {
        const t = text.trim();
        if (!t) return;
        patchTask(get, set, taskId, (it) => ({ ...it, subtasks: [...it.subtasks, { id: makeId("sub"), text: t, completed: false }] }));
      },
      toggleSubtask: (taskId, subId) => {
        const st = get();
        const autoParent = st.settings.autoParent;
        let parentCompleted = false;
        const goals = st.goals.map((g) => g.id !== st.activeGoalId ? g : {
          ...g,
          categories: g.categories.map((c) => ({
            ...c,
            items: c.items.map((it) => {
              if (it.id !== taskId) return it;
              const subtasks = it.subtasks.map((sb) => (sb.id === subId ? { ...sb, completed: !sb.completed } : sb));
              const allDone = subtasks.length > 0 && subtasks.every((sb) => sb.completed);
              const completed = autoParent && allDone ? true : it.completed;
              if (autoParent && allDone && !it.completed) parentCompleted = true;
              return { ...it, subtasks, completed, status: completed ? ("done" as const) : it.status };
            }),
          })),
        });
        set({ goals });
        if (parentCompleted) {
          get().internalOnTaskCompleted(taskId, { x: 0, y: 0 });
          notify("All micro-steps done — parent task auto-completed!", "puzzle-piece");
        }
      },
      deleteSubtask: (taskId, subId) => {
        patchTask(get, set, taskId, (it) => ({ ...it, subtasks: it.subtasks.filter((s) => s.id !== subId) }));
      },

      /* ---------- inline editing ---------- */
      setEditingCategory: (id) => set({ editingCategoryId: id }),
      setEditingTask: (pair) => set({ editingTaskId: pair ? `${pair.catId}::${pair.taskId}` : null }),

      /* ---------- pomodoro (timestamp based) ---------- */
      setPomoMode: (m) => {
        const s = get();
        const mins = m === "short" ? 5 : m === "long" ? 15 : s.pomo.focusMinutes;
        set({ pomo: { ...s.pomo, mode: m, running: false, endsAt: 0, remainingMs: mins * 60_000 } });
      },
      setPomoMinutes: (mins) => {
        if (!(mins > 0 && mins <= 180)) return;
        set((s) => ({ pomo: { ...s.pomo, mode: "focus", focusMinutes: mins, running: false, endsAt: 0, remainingMs: mins * 60_000 } }));
      },
      startPausePomo: () => {
        const s = get();
        if (s.pomo.running) {
          const remaining = Math.max(0, s.pomo.endsAt - Date.now());
          set({ pomo: { ...s.pomo, running: false, endsAt: 0, remainingMs: remaining } });
        } else {
          const total = s.pomo.mode === "short" ? 5 : s.pomo.mode === "long" ? 15 : s.pomo.focusMinutes;
          const rem = s.pomo.remainingMs > 0 ? s.pomo.remainingMs : total * 60_000;
          set({ pomo: { ...s.pomo, running: true, endsAt: Date.now() + rem } });
        }
      },
      resetPomo: () => {
        const s = get();
        const total = s.pomo.mode === "short" ? 5 : s.pomo.mode === "long" ? 15 : s.pomo.focusMinutes;
        set({ pomo: { ...s.pomo, running: false, endsAt: 0, remainingMs: total * 60_000 } });
      },

      /* ---------- rpg & settings ---------- */
      toggleRpg: () => {
        set((s) => ({ settings: { ...s.settings, rpgEnabled: !s.settings.rpgEnabled } }));
        notify(get().settings.rpgEnabled ? "RPG Gamification ON!" : "RPG Gamification paused.", "bolt-boost");
      },
      unlockSkill: (id) => {
        const s = get();
        if (s.rpg.skills[id]) { notify("Perk already unlocked.", "key-point"); return; }
        if ((s.rpg.skillPoints || 0) <= 0) { notifyError("No skill points available — level up first!"); return; }
        set((st) => ({ rpg: { ...st.rpg, skills: { ...st.rpg.skills, [id]: true }, skillPoints: st.rpg.skillPoints - 1 } }));
        notifySuccess("Perk unlocked!", "key-point");
      },
      equipAura: (id) => {
        set((s) => ({ rpg: { ...s.rpg, aura: id } }));
        notify(id ? `${id} aura equipped!` : "Aura removed.", "gem-spark");
      },
      testBoostXp: () => { get().internalAwardXp(150, { x: 0, y: 0 }, "Boost"); },
      toggleHeatmap: () => {
        set((s) => ({ settings: { ...s.settings, heatmapEnabled: !s.settings.heatmapEnabled } }));
        notify(get().settings.heatmapEnabled ? "Heatmap visible." : "Heatmap hidden.", "chart-bars");
      },
      toggleAutoParent: () => {
        set((s) => ({ settings: { ...s.settings, autoParent: !s.settings.autoParent } }));
        notify(get().settings.autoParent ? "Auto-complete parent ON." : "Auto-complete parent OFF.", "puzzle-piece");
      },
      toggleReduceEffects: () => {
        set((s) => ({ settings: { ...s.settings, reduceEffects: !s.settings.reduceEffects } }));
        if (get().settings.reduceEffects) set({ particles: "off" });
        notify(get().settings.reduceEffects ? "Effects reduced — battery friendly." : "Full effects restored.", "lotus-zen");
      },
      setAudio: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      /* ---------- recurring + data ---------- */
      applyRecurringResets: () => {
        const todayKey = localDateKey(new Date());
        const weekKey = isoWeekKey(new Date());
        let changed = false;
        const goals = get().goals.map((g) => ({
          ...g,
          categories: g.categories.map((cat) => {
            if (cat.recurrence === "daily" && cat.lastResetDate !== todayKey) {
              changed = true;
              return {
                ...cat,
                lastResetDate: todayKey,
                items: cat.items.map((it) => ({ ...it, completed: false, status: "todo" as const })),
              };
            }
            if (cat.recurrence === "weekly" && cat.lastWeekKey !== weekKey) {
              changed = true;
              return {
                ...cat,
                lastWeekKey: weekKey,
                items: cat.items.map((it) => ({ ...it, completed: false, status: "todo" as const })),
              };
            }
            return cat;
          }),
        }));
        if (changed) {
          set({ goals });
          notify("Recurring categories auto-reset for the new day/week!", "repeat-cycle");
        }
      },
      exportWorkspace: () => {
        set((s) => ({ settings: { ...s.settings, lastBackupAt: Date.now() } }));
        return JSON.stringify({ app: APP_NAME, edition: EDITION, version: STORAGE_VERSION, exportedAt: new Date().toISOString(), state: pickPersisted(get()) }, null, 2);
      },
      importWorkspace: (json) => {
        try {
          const parsed = JSON.parse(json) as { version?: number; state?: Partial<GoalCheckState> } & Partial<GoalCheckState>;
          const candidate = parsed.state && typeof parsed.state === "object" ? parsed.state : parsed;
          if (!Array.isArray(candidate.goals) || candidate.goals.length === 0) {
            notifyError("Invalid backup: no goals found.");
            return false;
          }
          const migrated = migrateLegacyV1(candidate as Record<string, unknown>);
          migrated.goals = migrated.goals.map(normalizeGoal);
          set({ ...migrated, _hydrated: true });
          notifySuccess("Workspace restored from backup!", "check-circle");
          return true;
        } catch {
          notifyError("Could not parse backup file.");
          return false;
        }
      },
      resetWorkspace: () => {
        set({ ...defaultState(), _hydrated: true });
        notify("Workspace reset to defaults.", "undo-ccw");
      },

      /* ---------- v4 — Advance: habits ---------- */
      addHabit: (title, cadence) => {
        const t = title.trim();
        if (!t) return;
        const habit: Habit = { id: makeId("habit"), title: t, cadence, marks: {}, createdAt: Date.now() };
        set((s) => ({ habits: [...s.habits, habit] }));
        notify(`Habit added: ${t}`, "repeat-cycle");
        get().evaluateAndUnlockAchievements();
      },
      removeHabit: (id) => {
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
        notify("Habit removed.", "trash-flame");
      },
      toggleHabitPeriod: (id) => {
        const key = habitPeriodKey(get().habits.find((h) => h.id === id)?.cadence || "daily");
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h;
            const marks = { ...h.marks };
            if (marks[key]) delete marks[key];
            else marks[key] = true;
            return { ...h, marks };
          }),
        }));
        const hb = get().habits.find((h) => h.id === id);
        if (hb?.marks[key]) {
          const streak = habitStreak(hb.marks, hb.cadence);
          if (streak >= 3) notify(`${streak}-period streak on "${hb.title}"!`, "flame-ember");
          get().evaluateAndUnlockAchievements();
        }
      },

      /* ---------- v4 — Advance: achievements ---------- */
      evaluateAndUnlockAchievements: () => {
        const s = useStore.getState();
        if (!IS_PRO) return;
        const pomoTotalSessions = Object.values((s.analytics.hourCounts ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0);
        const satisfied = evaluateAchievements({
          goals: s.goals,
          rpg: s.rpg,
          analytics: s.analytics,
          habits: s.habits,
          pomoTotalSessions,
        });
        const fresh = satisfied.filter((id) => !s.achievements[id]);
        if (fresh.length === 0) return;
        const now = Date.now();
        const patch: Record<string, number> = { ...s.achievements };
        for (const id of fresh) patch[id] = now;
        set({ achievements: patch });
        for (const id of fresh) {
          const def = ACHIEVEMENTS.find((a) => a.id === id);
          if (def) notifySuccess(`Achievement unlocked — ${def.label}`, def.icon);
        }
        bus.emit({ type: "chime", kind: "levelup" });
      },

      /* ---------- v4 — Advance: data doctor ---------- */
      runDoctor: () => {
        const issues: string[] = [];
        let fixed = 0;
        set((s) => {
          let oversized = 0;
          const goals = s.goals.map((g) => {
            if ((g.media || "").length > 150_000) oversized += 1;
            return {
              ...g,
              categories: g.categories.map((c) => {
                if ((c.media || "").length > 150_000) oversized += 1;
                const seen = new Set<string>();
                let dupes = 0;
                const items: Task[] = [];
                const allIds = new Set(c.items.map((t) => t.id));
                for (const t of c.items) {
                  if (seen.has(t.id)) { dupes += 1; continue; }
                  seen.add(t.id);
                  let dependsOn = t.dependsOn;
                  if (dependsOn && (!allIds.has(dependsOn) || dependsOn === t.id)) {
                    dependsOn = "";
                    issues.push(`Cleared broken dependency on "${t.text || "untitled task"}"`);
                    fixed += 1;
                  }
                  if (dependsOn !== t.dependsOn) items.push({ ...t, dependsOn });
                  else items.push(t);
                }
                if (dupes > 0) {
                  issues.push(`Removed ${dupes} duplicate task id${dupes > 1 ? "s" : ""} in "${c.title}"`);
                  fixed += dupes;
                }
                return { ...c, items };
              }),
            };
          });
          const pomo = s.pomo.attachedTaskId && !goals.flatMap((g) => g.categories.flatMap((c) => c.items)).some((t) => t.id === s.pomo.attachedTaskId)
            ? { ...s.pomo, attachedTaskId: "" }
            : s.pomo;
          if (pomo !== s.pomo) {
            issues.push("Cleared a pomodoro binding to a deleted task");
            fixed += 1;
          }
          if (oversized > 0) issues.push(`${oversized} oversized image badge(s) found — consider re-choosing smaller icons (not auto-removed)`);
          if (issues.length === 0) issues.push("All clear — no integrity issues found.");
          return { goals, pomo };
        });
        return { issues, fixed };
      },

      /* ---------- v4 — Advance: theme JSON share ---------- */
      exportThemeJson: () => {
        if (typeof window === "undefined") return "{}";
        const el = document.documentElement;
        const style = getComputedStyle(el);
        const vars: Record<string, string> = {};
        const NAMES = GC_THEME_VARS;
        for (const name of NAMES) {
          const v = style.getPropertyValue(name).trim();
          if (v) vars[name] = v;
        }
        return JSON.stringify({ app: APP_NAME, kind: "goalcheck-theme", theme: useStore.getState().theme, exportedAt: new Date().toISOString(), vars }, null, 2);
      },
      importThemeJson: (json) => {
        try {
          const parsed = JSON.parse(json) as { kind?: string; vars?: Record<string, string> };
          if (parsed.kind !== "goalcheck-theme" || !parsed.vars || typeof parsed.vars !== "object") {
            notifyError("Not a GoalCheck theme file.");
            return false;
          }
          const clean: Record<string, string> = {};
          for (const [k, v] of Object.entries(parsed.vars)) {
            if (GC_THEME_VARS.includes(k as (typeof GC_THEME_VARS)[number]) && typeof v === "string" && v.length < 400) clean[k] = v;
          }
          if (Object.keys(clean).length < 5) {
            notifyError("Theme file has too few valid color tokens.");
            return false;
          }
          set({ customTheme: clean });
          notifySuccess("Custom theme imported & applied!", "palette-dab");
          return true;
        } catch {
          notifyError("Could not parse theme JSON.");
          return false;
        }
      },

      /* ---------- v4 — Advance: backup nudge + sync file + onboarding ---------- */
      touchBackup: () => set((s) => ({ settings: { ...s.settings, lastBackupAt: Date.now() } })),
      dismissBackupNudge: () => set((s) => ({ settings: { ...s.settings, backupNudgeDismissedAt: Date.now() } })),
      setSyncFileEnabled: (v) => set((s) => ({ settings: { ...s.settings, syncFileEnabled: v } })),
      completeOnboarding: () => set((s) => ({ settings: { ...s.settings, onboardingDone: true } })),

      /* ---------- internal RPG helpers ---------- */
      internalOnTaskCompleted: (taskId, origin) => {
        bumpHistory(useStore.getState(), 1);
        const s = useStore.getState() as Store & { settings: { rpgEnabled: boolean } };
        if (!s.settings.rpgEnabled) return;
        const item = findTask(useStore.getState(), taskId);
        useStore.setState((st) => ({ rpg: { ...st.rpg, combo: (st.rpg.combo || 0) + 1 } }));
        const xpMap = { normal: 10, high: 25, urgent: 50 };
        internalAwardXpNow(item ? xpMap[item.priority || "normal"] || 10 : 10, origin ?? { x: 0, y: 0 }, "Task");
      },
      internalOnTaskUnchecked: () => {
        const s = useStore.getState();
        if (!s.settings.rpgEnabled) return;
        const combo = s.rpg.skills["combo-keeper"] ? Math.floor((s.rpg.combo || 0) / 2) : 0;
        useStore.setState((st) => ({ rpg: { ...st.rpg, combo } }));
      },
      internalAwardXp: (amount, origin, reason) => internalAwardXpNow(amount, origin, reason),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => pickPersisted(s),
      migrate: (persisted, version) => {
        // v0/v1: legacy flat shape (or unknown) -> v2
        return migrateLegacyV1(persisted as Record<string, unknown>);
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated();
          state.applyRecurringResets();
          // validate active goal still exists
          const { goals, activeGoalId } = state;
          if (!goals.some((g) => g.id === activeGoalId) && goals.length > 0) state.setActiveGoal(goals[0].id);
        }
      },
    }
  )
);

/* ---------- helper utilities (outside store) ---------- */

function pickPersisted(s: GoalCheckState & Transient): GoalCheckState {
  return {
    theme: s.theme,
    particles: s.particles,
    activeGoalId: s.activeGoalId,
    view: s.view,
    filter: s.filter,
    layoutMode: s.layoutMode,
    goals: s.goals,
    pomo: s.pomo,
    rpg: s.rpg,
    analytics: s.analytics,
    settings: s.settings,
    brandMedia: s.brandMedia,
    habits: s.habits,
    achievements: s.achievements,
    customTheme: s.customTheme,
  };
}

function findTask(s: { goals: GoalBoard[]; activeGoalId: string }, taskId: string): Task | null {
  for (const g of s.goals) {
    if (g.id !== s.activeGoalId) continue;
    for (const c of g.categories) {
      for (const it of c.items) if (it.id === taskId) return it;
    }
  }
  return null;
}

function patchTask(
  get: () => Store, set: (fn: (s: Store) => Partial<Store>) => void,
  taskId: string, fn: (it: Task) => Task
) {
  const s = get();
  set((st) => ({
    goals: st.goals.map((g) => g.id !== st.activeGoalId ? g : {
      ...g,
      categories: g.categories.map((c) => ({
        ...c,
        items: c.items.map((it) => (it.id === taskId ? fn(it) : it)),
      })),
    }),
  }));
}

/* ---------- internal RPG helpers ---------- */

function bumpHistory(s: GoalCheckState, n: number) {
  const key = localDateKey(new Date());
  useStore.setState({ rpg: { ...s.rpg, history: { ...s.rpg.history, [key]: (s.rpg.history[key] || 0) + n } } });
}

export function internalAwardXpNow(amount: number, origin: { x: number; y: number }, reason: string) {
  const s = useStore.getState();
  if (!s.settings.rpgEnabled) return;
  const mult = comboMultiplier(s.rpg.combo || 0);
  let gain = Math.round(amount * mult);
  if (s.rpg.skills["xp-boost"]) gain = Math.round(gain * 1.2);
  if (reason === "Focus Session" && s.rpg.skills["focus-master"]) gain = Math.round(gain * 1.5);
  if (s.rpg.skills["lucky"] && Math.random() < 0.1) gain += 25;

  const xp = s.rpg.xp + gain;
  const level = levelFromXp(xp);
  const levelUp = level > s.rpg.level;
  useStore.setState({
    rpg: {
      ...s.rpg, xp, level,
      skillPoints: s.rpg.skillPoints + (levelUp ? level - s.rpg.level : 0),
    },
  });

  const x = origin?.x || (typeof window !== "undefined" ? window.innerWidth / 2 : 0);
  const y = origin?.y || (typeof window !== "undefined" ? window.innerHeight / 2 : 0);
  bus.emit({ type: "xp", text: `+${gain} XP${mult > 1 ? ` (x${mult.toFixed(2).replace(/\.?0+$/, "")})` : ""}`, x, y });

  if (levelUp) {
    bus.emit({ type: "confetti" });
    bus.emit({ type: "chime", kind: "levelup" });
    notify(`LEVEL UP! Now LV.${level} ${rankForLevel(level)} • +${level - s.rpg.level} Skill Point`, "trophy-star");
    setTimeout(() => useStore.getState().evaluateAndUnlockAchievements(), 50);
  }
}

/* ---------- pomodoro completion (called by tick hook) ---------- */

export function completePomodoroSession() {
  const s = useStore.getState();
  const totalMs = s.pomo.mode === "short" ? 5 * 60_000 : s.pomo.mode === "long" ? 15 * 60_000 : s.pomo.focusMinutes * 60_000;
  const factor = s.rpg.skills["time-lord"] ? 1.5 : 1;
  const focusSeconds = Math.round((totalMs / 1000) * factor);
  const h = new Date().getHours();
  /* v4 — per-goal focus attribution via the bound task */
  const boundTask = s.pomo.attachedTaskId
    ? s.goals.flatMap((g) => g.categories.flatMap((c) => c.items.map((it) => ({ goalId: g.id, it }))))
        .find((x) => x.it.id === s.pomo.attachedTaskId)
    : undefined;
  const perGoalPatch = boundTask
    ? { ...s.analytics.perGoal, [boundTask.goalId]: (s.analytics.perGoal[boundTask.goalId] || 0) + focusSeconds }
    : s.analytics.perGoal;
  useStore.setState({
    analytics: {
      focusSeconds: (s.analytics.focusSeconds || 0) + focusSeconds,
      hourCounts: { ...s.analytics.hourCounts, [h]: (s.analytics.hourCounts[h] || 0) + 1 },
      perGoal: perGoalPatch,
    },
    pomo: { ...s.pomo, running: false, endsAt: 0, remainingMs: totalMs },
  });
  bumpHistory(useStore.getState(), 1);
  const boundId = s.pomo.attachedTaskId;
  if (boundId) {
    patchTaskWithCount(boundId);
  }
  internalAwardXpNow(30, { x: 0, y: 0 }, "Focus Session");
  bus.emit({ type: "chime", kind: "pomo-done" });
  bus.emit({ type: "confetti" });
  notifySuccess("Pomodoro Session Completed!", "tomato-timer");
  useStore.getState().evaluateAndUnlockAchievements();
}

function patchTaskWithCount(taskId: string) {
  const st = useStore.getState();
  useStore.setState({
    goals: st.goals.map((g) => ({
      ...g,
      categories: g.categories.map((c) => ({
        ...c,
        items: c.items.map((it) => (it.id === taskId ? { ...it, pomoCount: (it.pomoCount || 0) + 1 } : it)),
      })),
    })),
  });
}

/* ---------- selectors ---------- */

export function useActiveGoal(): GoalBoard | null {
  return useStore((s) => s.goals.find((g) => g.id === s.activeGoalId) ?? null);
}

export function useStreaks(): { current: number; best: number } {
  const history = useStore((s) => s.rpg.history);
  return computeStreaks(history, new Date(new Date().setHours(0, 0, 0, 0)));
}
