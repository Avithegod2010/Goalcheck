/* =========================================================
   GoalCheck Pro — Smart week planner (Task 17-c, PURE)

   buildWeekPlan() walks one goal board and produces a
   conflict-free week plan for the next `horizonDays` (7)
   days starting today:

     Candidates (in this order):
       1. "overdue"     — open tasks with dueDate < today
                           (oldest first)
       2. "overload"    — open tasks due within the horizon
                           whose due day's OPEN-task load
                           exceeds the daily capacity
       3. "unscheduled" — open undated tasks with elevated
                           priority ("high" | "urgent")

     Ties inside a group: higher priority first
     (urgent > high > normal — types.ts has no "low";
     "urgent" is the top tier), then bigger estimate first,
     then createdAt / id for full determinism.

     Greedy fill, walking days 0..N-1:
       - overdue            → earliest day with room
                              (earlier-than-due is allowed
                              precisely because it IS overdue)
       - overloaded-day     → its own due day if it fits,
                              else the first LATER day with room
       - undated high-prio  → first day with room (fills gaps)
       - nothing fits       → last day (overflow noted: that
                              day's load may exceed capacity)

     A task is never moved EARLIER than its due date unless it
     is overdue. `moves` contains ONLY tasks whose final day
     differs from their original dueDate (or undated ones);
     `perDay` reflects the POST-plan load of open tasks.

   Load unit = "focus" (pomodoro) units: Task.estimate, with
   0 / unset / invalid counting as 1. Completed tasks never
   contribute load. Pure: no store access, no Date.now() —
   everything derives from the passed-in `today`.
   ========================================================= */

import type { GoalBoard, Task } from "./types";
import { localDateKey, shiftDays } from "./logic";

export type PlanReason = "overdue" | "overload" | "unscheduled";

export interface PlanMove {
  catId: string;
  taskId: string;
  text: string;
  /** original due date ("YYYY-MM-DD") or "" when the task was undated */
  from: string;
  /** new due date within the horizon */
  to: string;
  /** effective estimate in focus units (0/unset counts as 1) */
  estimate: number;
  reason: PlanReason;
}

export interface WeekPlan {
  moves: PlanMove[];
  /** one row per horizon day, POST-plan load of OPEN tasks */
  perDay: { date: string; load: number; capacity: number; items: string[] }[];
}

/** Focus-unit load of a task: 0/unset/negative → 1, else rounded. */
function effEstimate(task: Task): number {
  return Math.max(1, Math.round(Number(task.estimate) || 0));
}

/** Priority rank — types.ts Priority is "normal" | "high" | "urgent"
 *  (the spec's "low" tier does not exist; "urgent" is the top tier). */
function prioRank(p: Task["priority"]): number {
  return p === "urgent" ? 3 : p === "high" ? 2 : 1;
}

interface Candidate {
  catId: string;
  task: Task;
  reason: PlanReason;
  /** original due date key ("" for undated) */
  from: string;
  /** 0 = overdue, 1 = due-within-horizon overloaded, 2 = undated */
  group: 0 | 1 | 2;
  /** index of the task's own due day (overloaded group only) */
  dueIdx: number;
}

export function buildWeekPlan(
  goal: GoalBoard,
  opts: { today: Date; capacity: number; horizonDays?: number },
): WeekPlan {
  const capacity = Math.max(1, Math.floor(opts.capacity) || 1);
  const n = Math.max(1, Math.floor(opts.horizonDays ?? 7) || 7);
  const days = Array.from({ length: n }, (_, i) => shiftDays(opts.today, i));
  const dayKeys = days.map(localDateKey);
  const idxOf = new Map(dayKeys.map((k, i) => [k, i] as const));

  const load = new Array<number>(n).fill(0);
  const dayItems: Task[][] = days.map(() => []);
  const candidates: Candidate[] = [];

  /* ---- pass 1: baseline loads + groups 0/2 candidates ---- */
  const openByDay: { catId: string; task: Task }[][] = days.map(() => []);
  for (const cat of goal?.categories ?? []) {
    for (const task of cat.items ?? []) {
      if (task.completed) continue;
      const due = (task.dueDate || "").slice(0, 10);
      const di = idxOf.get(due);
      if (di !== undefined) {
        const e = effEstimate(task);
        load[di] += e;
        dayItems[di].push(task);
        openByDay[di].push({ catId: cat.id, task });
      } else if (due !== "" && due < dayKeys[0]) {
        candidates.push({ catId: cat.id, task, reason: "overdue", from: due, group: 0, dueIdx: -1 });
      } else if (due === "" && prioRank(task.priority) >= 2) {
        candidates.push({ catId: cat.id, task, reason: "unscheduled", from: "", group: 2, dueIdx: -1 });
      }
      /* due dates beyond the horizon are left untouched */
    }
  }

  /* ---- pass 2: overloaded days release ALL their open tasks ---- */
  for (let di = 0; di < n; di++) {
    if (load[di] <= capacity) continue;
    for (const { catId, task } of openByDay[di]) {
      candidates.push({ catId, task, reason: "overload", from: dayKeys[di], group: 1, dueIdx: di });
      load[di] -= effEstimate(task);
    }
    const released = new Set(openByDay[di].map((o) => o.task.id));
    dayItems[di] = dayItems[di].filter((t) => !released.has(t.id));
  }

  /* ---- deterministic candidate order ---- */
  candidates.sort((a, b) =>
    a.group - b.group ||
    a.from.localeCompare(b.from) || /* overdue & overload: due date asc */
    prioRank(b.task.priority) - prioRank(a.task.priority) ||
    effEstimate(b.task) - effEstimate(a.task) ||
    a.task.createdAt - b.task.createdAt ||
    a.task.id.localeCompare(b.task.id),
  );

  /* ---- greedy fill ---- */
  const firstWithRoom = (start: number, e: number): number => {
    for (let i = start; i < n; i++) if (load[i] + e <= capacity) return i;
    return -1;
  };

  const moves: PlanMove[] = [];
  for (const c of candidates) {
    const e = effEstimate(c.task);
    let target: number;
    if (c.group === 0) {
      target = firstWithRoom(0, e); /* overdue → earliest day with room */
    } else if (c.group === 1) {
      target = load[c.dueIdx] + e <= capacity
        ? c.dueIdx
        : firstWithRoom(c.dueIdx + 1, e); /* own day first, else strictly later */
    } else {
      target = firstWithRoom(0, e); /* undated → fills the first gap */
    }
    if (target === -1) target = n - 1; /* overflow lands on the last day */
    load[target] += e;
    dayItems[target].push(c.task);
    const to = dayKeys[target];
    if (to !== c.from) {
      moves.push({
        catId: c.catId,
        taskId: c.task.id,
        text: c.task.text,
        from: c.from,
        to,
        estimate: e,
        reason: c.reason,
      });
    }
  }

  return {
    moves,
    perDay: dayKeys.map((date, i) => ({
      date,
      load: load[i],
      capacity,
      items: dayItems[i].map((t) => t.text),
    })),
  };
}
