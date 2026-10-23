import { describe, it, expect } from "vitest";
import {
  isValidRecurrence,
  describeRecurrence,
  nextRecurrenceDue,
  fuzzyScore,
  collectYearRecap,
  buildDemoWorkspace,
  makeTask,
  localDateKey,
  shiftDays,
} from "../src/lib/goalcheck/logic";
import { toggleMarkdownCheckbox } from "../src/lib/goalcheck/markdown";

/* ---------- recurrence validation ---------- */

describe("isValidRecurrence", () => {
  it("accepts v4 basics", () => {
    expect(isValidRecurrence("none")).toBe(true);
    expect(isValidRecurrence("daily")).toBe(true);
    expect(isValidRecurrence("weekly")).toBe(true);
  });
  it("accepts v4.3 parameterised specs", () => {
    expect(isValidRecurrence("weekdays")).toBe(true);
    expect(isValidRecurrence("every:3")).toBe(true);
    expect(isValidRecurrence("every:30")).toBe(true);
    expect(isValidRecurrence("monthly:1:1")).toBe(true);
    expect(isValidRecurrence("monthly:5:6")).toBe(true);
  });
  it("rejects malformed specs", () => {
    expect(isValidRecurrence("every:1")).toBe(false); // min 2
    expect(isValidRecurrence("every:abc")).toBe(false);
    expect(isValidRecurrence("monthly:6:1")).toBe(false); // ordinal 1..5
    expect(isValidRecurrence("monthly:2:7")).toBe(false); // weekday 0..6
    expect(isValidRecurrence("yearly")).toBe(false);
    expect(isValidRecurrence("")).toBe(false);
    expect(isValidRecurrence(null)).toBe(false);
    expect(isValidRecurrence(42)).toBe(false);
  });
});

describe("describeRecurrence", () => {
  it("labels all families", () => {
    expect(describeRecurrence("none")).toBe("One-time");
    expect(describeRecurrence("daily")).toBe("Every day");
    expect(describeRecurrence("weekly")).toBe("Every week");
    expect(describeRecurrence("weekdays")).toContain("Weekdays");
    expect(describeRecurrence("every:4")).toBe("Every 4 days");
    expect(describeRecurrence("monthly:2:5")).toContain("Monthly");
    expect(describeRecurrence("monthly:2:5")).toContain("Fri");
  });
});

/* ---------- nextRecurrenceDue ---------- */

describe("nextRecurrenceDue", () => {
  const monday = new Date("2026-01-05T00:00:00"); // a Monday

  it("advances daily/weekly by 1/7 days", () => {
    expect(nextRecurrenceDue("daily", monday)).toBe("2026-01-06");
    expect(nextRecurrenceDue("weekly", monday)).toBe("2026-01-12");
  });

  it("skips weekends for weekdays", () => {
    const friday = new Date("2026-01-09T00:00:00");
    expect(nextRecurrenceDue("weekdays", friday)).toBe("2026-01-12"); // Fri → Mon
    expect(nextRecurrenceDue("weekdays", monday)).toBe("2026-01-06"); // Mon → Tue
  });

  it("advances by N days for every:N", () => {
    expect(nextRecurrenceDue("every:3", monday)).toBe("2026-01-08");
    expect(nextRecurrenceDue("every:30", monday)).toBe("2026-02-04");
  });

  it("lands on the nth weekday of a future month", () => {
    // 2nd Friday after Jan 5 2026 (Jan's 2nd Friday is the 9th — after the 5th → same month)
    expect(nextRecurrenceDue("monthly:2:5", monday)).toBe("2026-01-09");
    // 2nd Monday after Jan 12 2026 → Feb's 2nd Monday = Feb 9
    const jan12 = new Date("2026-01-12T00:00:00");
    expect(nextRecurrenceDue("monthly:2:1", jan12)).toBe("2026-02-09");
  });

  it("returns '' for none and unknown", () => {
    expect(nextRecurrenceDue("none", monday)).toBe("");
    expect(nextRecurrenceDue("garbage", monday)).toBe("");
  });
});

/* ---------- fuzzy search ---------- */

describe("fuzzyScore", () => {
  it("ranks substring hits highest, earlier better", () => {
    const at = fuzzyScore("fix", "Fix login bug");
    const late = fuzzyScore("fix", "Bug we will fix");
    expect(at).toBeGreaterThan(late);
    expect(at).toBeGreaterThan(500);
  });
  it("supports ordered subsequence matches with contiguity bonus", () => {
    const contiguous = fuzzyScore("flb", "Fix login bug");
    const scattered = fuzzyScore("fb", "Fix login bug");
    expect(contiguous).toBeGreaterThan(0);
    expect(scattered).toBeGreaterThan(0);
    expect(contiguous).toBeGreaterThan(scattered);
  });
  it("rejects missing characters and empty queries", () => {
    expect(fuzzyScore("xy", "Fix login bug")).toBe(0);
    expect(fuzzyScore("", "Fix login bug")).toBe(0);
  });
  it("is case-insensitive", () => {
    expect(fuzzyScore("LOGIN", "fix login bug")).toBeGreaterThan(500);
  });
});

/* ---------- year recap ---------- */

describe("collectYearRecap", () => {
  const now = new Date("2026-06-15T12:00:00");

  it("counts only this year's completedAt completions", () => {
    const t1 = makeTask("old", { completed: true, completedAt: new Date("2024-03-01").getTime() });
    const t2 = makeTask("new", { completed: true, completedAt: new Date("2026-02-10").getTime() });
    const t3 = makeTask("open");
    const goals = [{ id: "g", title: "G", subtitle: "", media: "", createdAt: 0, categories: [{ id: "c", title: "C -", media: "", recurrence: "none" as const, lastResetDate: "", lastWeekKey: "", items: [t1, t2, t3] }] }];
    const recap = collectYearRecap(goals as never, { enabled: true, xp: 250, level: 3, combo: 0, skillPoints: 0, skills: {}, aura: "", history: { "2026-06-01": 2, "2026-06-02": 3 } }, {}, now);
    expect(recap.year).toBe(2026);
    expect(recap.completed).toBe(1);
    expect(recap.activeDays).toBe(2);
    expect(recap.level).toBe(3);
    expect(recap.topMonth.count).toBeGreaterThan(0);
  });

  it("handles empty history gracefully", () => {
    const recap = collectYearRecap([], { enabled: true, xp: 0, level: 1, combo: 0, skillPoints: 0, skills: {}, aura: "", history: {} }, {}, now);
    expect(recap.completed).toBe(0);
    expect(recap.activeDays).toBe(0);
    expect(recap.longestStreak).toBe(0);
  });
});

/* ---------- demo workspace ---------- */

describe("buildDemoWorkspace", () => {
  it("creates three boards with categories and tasks", () => {
    const demo = buildDemoWorkspace();
    expect(demo.goals).toHaveLength(3);
    for (const g of demo.goals) {
      expect(g.categories.length).toBeGreaterThan(0);
      for (const c of g.categories) expect(c.items.length).toBeGreaterThan(0);
    }
  });
  it("includes due dates around today and some completed tasks", () => {
    const demo = buildDemoWorkspace();
    const all = demo.goals.flatMap((g) => g.categories.flatMap((c) => c.items));
    expect(all.some((t) => t.completed)).toBe(true);
    expect(all.some((t) => t.dueDate && t.dueDate < localDateKey(new Date()))).toBe(true); // overdue sample
    const habit = demo.habits[0];
    expect(Object.keys(habit.marks).length).toBeGreaterThan(3);
  });
});

/* ---------- markdown checkbox toggling ---------- */

describe("toggleMarkdownCheckbox", () => {
  it("toggles only the requested line", () => {
    const src = "- [ ] a\n- [x] b\nplain line";
    expect(toggleMarkdownCheckbox(src, 0)).toBe("- [x] a\n- [x] b\nplain line");
    expect(toggleMarkdownCheckbox(src, 1)).toBe("- [ ] a\n- [ ] b\nplain line");
  });
  it("is a no-op on out-of-range or non-task lines", () => {
    expect(toggleMarkdownCheckbox("- a", 0)).toBe("- a");
    expect(toggleMarkdownCheckbox("- [ ] a", 5)).toBe("- [ ] a");
  });
  it("handles * bullets too", () => {
    expect(toggleMarkdownCheckbox("* [x] b", 0)).toBe("* [ ] b");
  });
});

/* ---------- completedAt bookkeeping invariant ---------- */

describe("makeTask completedAt default", () => {
  it("defaults to 0 (unknown)", () => {
    expect(makeTask("x").completedAt).toBe(0);
  });
});
