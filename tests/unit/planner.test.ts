import { beforeEach, describe, expect, it } from "vitest";
import { buildWeekPlan, type WeekPlan } from "@/lib/goalcheck/planner";
import { localDateKey, makeTask, shiftDays } from "@/lib/goalcheck/logic";
import type { Category, GoalBoard, Task } from "@/lib/goalcheck/types";

/*
 * Smart week planner — pure algorithm tests (task 17-c).
 *
 * The horizon is always 7 days starting at TODAY (fixed fixture date),
 * so day keys are addressed via k(0..6). Focus units: Task.estimate,
 * with 0 counting as 1. Completed tasks never load a day.
 */

const TODAY = new Date(2026, 1, 10); // Tue 2026-02-10 (local)
const k = (offset: number) => localDateKey(shiftDays(TODAY, offset));

let seq = 0;
let catSeq = 0;
beforeEach(() => { seq = 0; catSeq = 0; }); /* deterministic t1…/c1… ids per test */
function task(text: string, o: Partial<Task> = {}): Task {
  return makeTask(text, { id: `t${++seq}`, createdAt: 1_700_000_000_000 + seq, ...o });
}

function cat(title: string, items: Task[]): Category {
  return {
    id: `c${++catSeq}`,
    title,
    media: "",
    recurrence: "none",
    lastResetDate: k(-1),
    lastWeekKey: "2026-W6",
    items,
  };
}

function board(...cats: Category[]): GoalBoard {
  return {
    id: "g1",
    title: "Launch",
    subtitle: "",
    media: "🚀",
    categories: cats,
    createdAt: 1,
    archived: false,
  };
}

function plan(b: GoalBoard, capacity = 8, horizonDays = 7): WeekPlan {
  return buildWeekPlan(b, { today: TODAY, capacity, horizonDays });
}

describe("buildWeekPlan — shapes & trivial cases", () => {
  it("empty goal → zero moves, one row per horizon day", () => {
    const p = plan(board());
    expect(p.moves).toEqual([]);
    expect(p.perDay).toHaveLength(7);
    expect(p.perDay.every((d) => d.load === 0 && d.capacity === 8 && d.items.length === 0)).toBe(true);
    expect(p.perDay[0].date).toBe(k(0));
    expect(p.perDay[6].date).toBe(k(6));
  });

  it("everything fits → zero moves, perDay loads match estimates", () => {
    const b = board(
      cat("A", [
        task("One", { dueDate: k(0), estimate: 2 }),
        task("Two", { dueDate: k(1), estimate: 3 }),
      ]),
    );
    const p = plan(b, 8);
    expect(p.moves).toEqual([]);
    expect(p.perDay[0].load).toBe(2);
    expect(p.perDay[1].load).toBe(3);
    expect(p.perDay[0].items).toEqual(["One"]);
  });

  it("horizonDays option shortens perDay and ignores later due dates", () => {
    const b = board(
      cat("A", [
        task("Inside", { dueDate: k(2), estimate: 1 }),
        task("Outside", { dueDate: k(5), estimate: 9 }),
      ]),
    );
    const p = plan(b, 2, 3);
    expect(p.perDay).toHaveLength(3);
    expect(p.moves).toEqual([]); /* day 2 load 1 ≤ 2; day 5 outside horizon */
    expect(p.perDay[2].load).toBe(1);
  });

  it("completed tasks contribute no load and are never moved", () => {
    const b = board(
      cat("A", [
        task("Done", { dueDate: k(0), estimate: 5, completed: true }),
        task("Open", { dueDate: k(0), estimate: 0 }),
      ]),
    );
    const p = plan(b, 1);
    expect(p.moves).toEqual([]); /* load 1 (est 0 → 1) ≤ capacity 1 */
    expect(p.perDay[0].load).toBe(1);
    expect(p.perDay[0].items).toEqual(["Open"]);
  });
});

describe("buildWeekPlan — overdue spreading", () => {
  it("overdue tasks spread across the earliest days, oldest first", () => {
    const b = board(
      cat("A", [
        task("Newer", { dueDate: k(-1), estimate: 1 }),
        task("Older", { dueDate: k(-3), estimate: 1 }),
      ]),
    );
    const p = plan(b, 1);
    expect(p.moves.map((m) => [m.text, m.from, m.to, m.reason])).toEqual([
      ["Older", k(-3), k(0), "overdue"],
      ["Newer", k(-1), k(1), "overdue"],
    ]);
  });

  it("capacity is respected exactly until the last-day overflow", () => {
    const items = Array.from({ length: 8 }, (_, i) => task(`OD${i}`, { dueDate: k(-1), estimate: 1 }));
    const p = plan(board(cat("A", items)), 1);
    expect(p.moves).toHaveLength(8);
    expect(p.perDay.map((d) => d.load)).toEqual([1, 1, 1, 1, 1, 1, 2]); /* day 6 overflows */
    expect(p.perDay.slice(0, 6).every((d) => d.load <= d.capacity)).toBe(true);
  });

  it("overdue may land earlier than its due date (only overdue may)", () => {
    const b = board(cat("A", [task("Late", { dueDate: k(-2), estimate: 1 })]));
    const p = plan(b, 4);
    expect(p.moves).toEqual([{
      catId: "c1", taskId: "t1", text: "Late", from: k(-2), to: k(0), estimate: 1, reason: "overdue",
    }]);
  });
});

describe("buildWeekPlan — overloaded days", () => {
  it("moves the overflow task to the first LATER day, never earlier", () => {
    const b = board(
      cat("A", [
        task("First", { dueDate: k(1), estimate: 3 }),
        task("Second", { dueDate: k(1), estimate: 3 }),
      ]),
    );
    const p = plan(b, 4);
    expect(p.moves).toHaveLength(1);
    expect(p.moves[0]).toMatchObject({ text: "Second", from: k(1), to: k(2), reason: "overload" });
    /* post-plan loads: day 1 keeps one task, day 2 receives it */
    expect(p.perDay[1].load).toBe(3);
    expect(p.perDay[2].load).toBe(3);
    expect(p.perDay[2].items).toEqual(["Second"]);
  });

  it("higher priority keeps its own day; normal gets deferred", () => {
    const b = board(
      cat("A", [
        task("LowImportance", { dueDate: k(0), estimate: 2, priority: "normal" }),
        task("TopImportance", { dueDate: k(0), estimate: 2, priority: "high" }),
      ]),
    );
    const p = plan(b, 3);
    expect(p.moves).toHaveLength(1);
    expect(p.moves[0].text).toBe("LowImportance");
    expect(p.moves[0].to).toBe(k(1));
  });

  it("a task re-seated on its own day is NOT reported as a move", () => {
    const b = board(
      cat("A", [
        task("Stays", { dueDate: k(0), estimate: 2, priority: "urgent" }),
        task("Spill", { dueDate: k(0), estimate: 2 }),
      ]),
    );
    const p = plan(b, 2);
    expect(p.moves.map((m) => m.text)).toEqual(["Spill"]);
    expect(p.perDay[0].items).toContain("Stays");
  });

  it("a task larger than the capacity falls through to the last day", () => {
    const b = board(cat("A", [task("Huge", { dueDate: k(0), estimate: 9 })]));
    const p = plan(b, 2);
    expect(p.moves).toEqual([{
      catId: "c1", taskId: "t1", text: "Huge", from: k(0), to: k(6), estimate: 9, reason: "overload",
    }]);
    expect(p.perDay[6].load).toBe(9);
  });
});

describe("buildWeekPlan — undated high-priority tasks", () => {
  it("undated high task fills the first gap", () => {
    const b = board(
      cat("A", [
        task("Anchor", { dueDate: k(0), estimate: 1 }),
        task("Floating", { estimate: 1, priority: "high" }),
      ]),
    );
    const p = plan(b, 2);
    expect(p.moves).toEqual([{
      catId: "c1", taskId: "t2", text: "Floating", from: "", to: k(0), estimate: 1, reason: "unscheduled",
    }]);
    expect(p.perDay[0].load).toBe(2);
    expect(p.perDay[0].items).toEqual(["Anchor", "Floating"]);
  });

  it("undated normal-priority tasks are never auto-scheduled", () => {
    const b = board(cat("A", [task("Drifter", { estimate: 1, priority: "normal" })]));
    const p = plan(b, 8);
    expect(p.moves).toEqual([]);
    expect(p.perDay.every((d) => d.load === 0)).toBe(true);
  });

  it("undated urgent outranks undated high when claiming the gap", () => {
    const b = board(
      cat("A", [
        task("HighPrio", { estimate: 4, priority: "high" }),
        task("UrgentPrio", { estimate: 4, priority: "urgent" }),
      ]),
    );
    const p = plan(b, 4);
    expect(p.moves.map((m) => [m.text, m.to])).toEqual([
      ["UrgentPrio", k(0)],
      ["HighPrio", k(1)],
    ]);
  });
});

describe("buildWeekPlan — estimate semantics", () => {
  it("estimate 0 counts as 1 when filling days", () => {
    const b = board(
      cat("A", [
        task("Pinned", { dueDate: k(0), estimate: 0 }),
        task("LateZero", { dueDate: k(-4), estimate: 0 }),
      ]),
    );
    const p = plan(b, 1);
    expect(p.moves[0]).toMatchObject({ text: "LateZero", to: k(1), estimate: 1 });
    expect(p.perDay[0].load).toBe(1); /* est 0 → 1, day full → overdue goes to day 1 */
    expect(p.perDay[1].load).toBe(1);
  });

  it("never moves a dated task EARLIER than its due date", () => {
    /* day 1 overflows; day 0 is empty but MUST stay empty */
    const b = board(
      cat("A", [
        task("KeepA", { dueDate: k(1), estimate: 2, priority: "high" }),
        task("KeepB", { dueDate: k(1), estimate: 2 }),
      ]),
    );
    const p = plan(b, 2);
    expect(p.moves.map((m) => m.to)).toEqual([k(2)]);
    expect(p.perDay[0].load).toBe(0);
  });
});
