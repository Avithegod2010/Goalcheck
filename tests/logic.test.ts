import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comboMultiplier,
  computeStreaks,
  dueStatus,
  evaluateAchievements,
  habitPeriodKey,
  habitRecentKeys,
  habitStreak,
  inCurrentWeek,
  isoWeekKey,
  levelFromXp,
  localDateKey,
  makeTask,
  parseQuickPaste,
  rankForLevel,
  totalXpForLevel,
  xpForLevel,
} from "@/lib/goalcheck/logic";
import type { GoalBoard, Habit, RpgState } from "@/lib/goalcheck/types";

/* ---------- helpers ---------- */

const TODAY = new Date(2026, 0, 15); // Thu Jan 15 2026, local time

function dayKey(offsetDays: number): string {
  return localDateKey(new Date(2026, 0, 15 + offsetDays));
}

function rpg(over: Partial<RpgState> = {}): RpgState {
  return { enabled: true, xp: 0, level: 1, combo: 0, skillPoints: 0, skills: {}, aura: "", history: {}, ...over };
}

function goalWithTasks(done: number, open = 0): GoalBoard {
  const items = [
    ...Array.from({ length: done }, (_, i) => makeTask(`done-${i}`, { completed: true, status: "done" })),
    ...Array.from({ length: open }, (_, i) => makeTask(`open-${i}`)),
  ];
  return {
    id: "g1", title: "Board", subtitle: "", media: "mono:target-radar", createdAt: 1,
    categories: [{ id: "c1", title: "C -", media: "mono:clipboard-check", recurrence: "none", lastResetDate: "2026-01-01", lastWeekKey: "2026-W1", items }],
  };
}

function habit(cadence: "daily" | "weekly", marks: Record<string, boolean>): Habit {
  return { id: "h1", title: "Habit", cadence, marks, createdAt: 1 };
}

/* ---------- dates ---------- */

describe("date keys", () => {
  it("formats local date keys zero-padded", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateKey(new Date(2026, 10, 25))).toBe("2026-11-25");
  });

  it("computes ISO week keys across year boundaries", () => {
    // Jan 1 2026 is a Thursday -> ISO week 1 of 2026
    expect(isoWeekKey(new Date(2026, 0, 1))).toBe("2026-W1");
    // Mon Dec 29 2025 belongs to 2026-W1
    expect(isoWeekKey(new Date(2025, 11, 29))).toBe("2026-W1");
  });
});

/* ---------- quick paste parser ---------- */

describe("parseQuickPaste", () => {
  it("splits headers into categories with heuristic media", () => {
    const cats = parseQuickPaste("Phone tasks -\n1. Charge phone\nStudy:\n- Revise math");
    expect(cats).toHaveLength(2);
    expect(cats[0].title).toBe("Phone tasks -");
    expect(cats[0].media).toBe("mono:phone-pulse");
    expect(cats[0].items.map((i) => i.text)).toEqual(["Charge phone"]);
    expect(cats[1].title).toBe("Study -");
    expect(cats[1].media).toBe("mono:book-flutter");
    expect(cats[1].items[0].text).toBe("Revise math");
  });

  it("parses [x] checkboxes as completed tasks", () => {
    const cats = parseQuickPaste("Pack -\n[x] Passport\n[ ] Tickets");
    const items = cats[0].items;
    expect(items[0]).toMatchObject({ text: "Passport", completed: true, status: "done" });
    expect(items[1]).toMatchObject({ text: "Tickets", completed: false, status: "todo" });
  });

  it("falls back to a default category when the first line is an item", () => {
    const cats = parseQuickPaste("1. Just an item");
    expect(cats).toHaveLength(1);
    expect(cats[0].title).toBe("Checklist Tasks -");
    expect(cats[0].items[0].text).toBe("Just an item");
  });

  it("treats a leading plain line as a category title", () => {
    const cats = parseQuickPaste("Groceries\n- Milk");
    expect(cats[0].title).toBe("Groceries -");
    expect(cats[0].items[0].text).toBe("Milk");
  });
});

/* ---------- RPG math ---------- */

describe("XP curve", () => {
  it("costs 100 for level 1->2, +50 per level after", () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(150);
    expect(xpForLevel(3)).toBe(200);
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(totalXpForLevel(3)).toBe(250);
  });

  it("maps XP to levels on exact boundaries", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(249)).toBe(2);
    expect(levelFromXp(250)).toBe(3);
    expect(levelFromXp(999_999)).toBeGreaterThan(100);
  });

  it("ranks levels", () => {
    expect(rankForLevel(1)).toBe("Initiate");
    expect(rankForLevel(3)).toBe("Apprentice");
    expect(rankForLevel(5)).toBe("Adept");
    expect(rankForLevel(8)).toBe("Expert");
    expect(rankForLevel(11)).toBe("Master");
    expect(rankForLevel(15)).toBe("Grandmaster");
    expect(rankForLevel(20)).toBe("Legend");
    expect(rankForLevel(25)).toBe("Mythic");
  });
});

describe("comboMultiplier", () => {
  it("steps +25% every 5 combo, capped at x2", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(4)).toBe(1);
    expect(comboMultiplier(5)).toBe(1.25);
    expect(comboMultiplier(9)).toBe(1.25);
    expect(comboMultiplier(10)).toBe(1.5);
    expect(comboMultiplier(20)).toBe(2);
    expect(comboMultiplier(100)).toBe(2); // hard cap: 4 steps
  });
});

/* ---------- heatmap streaks ---------- */

describe("computeStreaks", () => {
  it("counts the current run and the best run", () => {
    const hist: Record<string, number> = {
      [dayKey(0)]: 1, [dayKey(-1)]: 1, [dayKey(-2)]: 1, // current 3-day run
      [dayKey(-9)]: 1, [dayKey(-8)]: 1,                 // older 2-day run
    };
    expect(computeStreaks(hist, TODAY)).toEqual({ current: 3, best: 3 });
  });

  it("keeps the streak alive if today is not logged yet (streak anchored to yesterday)", () => {
    const hist: Record<string, number> = { [dayKey(-1)]: 1, [dayKey(-2)]: 1 };
    const { current } = computeStreaks(hist, TODAY);
    expect(current).toBe(2);
  });

  it("returns zeros for empty history", () => {
    expect(computeStreaks({}, TODAY)).toEqual({ current: 0, best: 0 });
  });
});

/* ---------- habit streaks ---------- */

describe("habitStreak (daily)", () => {
  it("walks back from today", () => {
    const marks = { [dayKey(0)]: true, [dayKey(-1)]: true, [dayKey(-2)]: true };
    expect(habitStreak(marks, "daily", TODAY)).toBe(3);
  });

  it("starts at yesterday when today is unmarked (streak not yet broken)", () => {
    const marks = { [dayKey(-1)]: true, [dayKey(-2)]: true, [dayKey(-3)]: true };
    expect(habitStreak(marks, "daily", TODAY)).toBe(3);
  });

  it("breaks on a gap", () => {
    const marks = { [dayKey(0)]: true, [dayKey(-5)]: true, [dayKey(-6)]: true };
    expect(habitStreak(marks, "daily", TODAY)).toBe(1);
  });

  it("is zero with no marks", () => {
    expect(habitStreak({}, "daily", TODAY)).toBe(0);
  });
});

describe("habitStreak (weekly)", () => {
  it("walks back ISO weeks", () => {
    const marks = {
      [isoWeekKey(TODAY)]: true,
      [isoWeekKey(new Date(2026, 0, 8))]: true,
      [isoWeekKey(new Date(2026, 0, 1))]: true,
    };
    expect(habitStreak(marks, "weekly", TODAY)).toBe(3);
  });

  it("resumes from last week when the current week is unmarked", () => {
    const marks = {
      [isoWeekKey(new Date(2026, 0, 8))]: true,
      [isoWeekKey(new Date(2026, 0, 1))]: true,
    };
    expect(habitStreak(marks, "weekly", TODAY)).toBe(2);
  });

  it("is zero when this week and last week are both unmarked", () => {
    const marks = { [isoWeekKey(new Date(2026, 0, 1))]: true };
    expect(habitStreak(marks, "weekly", TODAY)).toBe(0);
  });
});

describe("habit period helpers", () => {
  it("uses date keys for daily cadence and week keys for weekly", () => {
    expect(habitPeriodKey("daily", TODAY)).toBe("2026-01-15");
    expect(habitPeriodKey("weekly", TODAY)).toBe(isoWeekKey(TODAY));
  });

  it("returns the last N period keys oldest-first", () => {
    expect(habitRecentKeys("daily", 3, TODAY)).toEqual([dayKey(-2), dayKey(-1), dayKey(0)]);
    const weeks = habitRecentKeys("weekly", 2, TODAY);
    expect(weeks[1]).toBe(isoWeekKey(TODAY));
  });
});

/* ---------- due dates (v4) ---------- */

describe("dueStatus / inCurrentWeek", () => {
  const now = new Date(2026, 0, 14); // Wednesday; ISO week ends Sunday Jan 18

  it("classifies due dates", () => {
    expect(dueStatus("", now)).toBe("");
    expect(dueStatus("2026-01-13", now)).toBe("overdue");
    expect(dueStatus("2026-01-14", now)).toBe("today");
    expect(dueStatus("2026-01-16", now)).toBe("week");
    expect(dueStatus("2026-01-18", now)).toBe("week"); // Sunday = week end
    expect(dueStatus("2026-01-19", now)).toBe("later");
  });

  it("flags this-week-or-earlier for the This Week filter", () => {
    expect(inCurrentWeek("", now)).toBe(false);
    expect(inCurrentWeek("2026-01-13", now)).toBe(true); // overdue counts
    expect(inCurrentWeek("2026-01-18", now)).toBe(true);
    expect(inCurrentWeek("2026-01-19", now)).toBe(false);
  });
});

/* ---------- achievements ---------- */

describe("evaluateAchievements", () => {
  afterEach(() => vi.useRealTimers());

  it("awards nothing on a fresh workspace", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0));
    expect(evaluateAchievements({ goals: [], rpg: rpg(), analytics: {}, habits: [], pomoTotalSessions: 0 })).toEqual([]);
  });

  it("awards first-task and the task-count tiers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0));
    const base = { rpg: rpg(), analytics: {}, habits: [], pomoTotalSessions: 0 };
    const one = evaluateAchievements({ ...base, goals: [goalWithTasks(1)] });
    expect(one).toContain("first-task");
    expect(one).not.toContain("tasks-25");

    const twentyFive = evaluateAchievements({ ...base, goals: [goalWithTasks(25)] });
    expect(twentyFive).toContain("tasks-25");
    expect(twentyFive).not.toContain("tasks-100");
  });

  it("awards board-100 only for a fully completed board with 5+ tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0));
    const base = { rpg: rpg(), analytics: {}, habits: [], pomoTotalSessions: 0 };
    expect(evaluateAchievements({ ...base, goals: [goalWithTasks(5)] })).toContain("board-100");
    expect(evaluateAchievements({ ...base, goals: [goalWithTasks(4, 1)] })).not.toContain("board-100");
    expect(evaluateAchievements({ ...base, goals: [goalWithTasks(3)] })).not.toContain("board-100"); // too small
  });

  it("awards level and pomodoro tiers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0));
    const got = evaluateAchievements({
      goals: [], rpg: rpg({ level: 10 }), analytics: {}, habits: [], pomoTotalSessions: 100,
    });
    expect(got).toContain("level-5");
    expect(got).toContain("level-10");
    expect(got).toContain("pomos-10");
    expect(got).toContain("pomos-100");
  });

  it("awards activity streaks from rpg.history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0));
    const history: Record<string, number> = {};
    for (let i = 0; i < 7; i++) history[dayKey(-i)] = 1;
    const got = evaluateAchievements({ goals: [], rpg: rpg({ history }), analytics: {}, habits: [], pomoTotalSessions: 0 });
    expect(got).toContain("streak-7");
    expect(got).not.toContain("streak-30");
  });

  it("awards habit-streak-7 from a 7-period daily habit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0));
    const marks: Record<string, boolean> = {};
    for (let i = 0; i < 7; i++) marks[dayKey(-i)] = true;
    const got = evaluateAchievements({ goals: [], rpg: rpg(), analytics: {}, habits: [habit("daily", marks)], pomoTotalSessions: 0 });
    expect(got).toContain("habit-streak-7");
  });

  it("awards night-owl / early-bird based on completion hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 2, 0)); // 02:00
    let got = evaluateAchievements({ goals: [goalWithTasks(1)], rpg: rpg(), analytics: {}, habits: [], pomoTotalSessions: 0 });
    expect(got).toContain("night-owl");
    expect(got).not.toContain("early-bird");

    vi.setSystemTime(new Date(2026, 0, 15, 6, 0)); // 06:00
    got = evaluateAchievements({ goals: [goalWithTasks(1)], rpg: rpg(), analytics: {}, habits: [], pomoTotalSessions: 0 });
    expect(got).toContain("early-bird");
    expect(got).not.toContain("night-owl");
  });
});
