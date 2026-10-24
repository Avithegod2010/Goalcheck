"use client";

/* =========================================================
   v4.2 — Week view (Advance): a 7-day planner grid over the
   active board's due dates. Tasks land in their due-day
   column, overdue ones pool at the top, clicking toggles a
   task, the pencil opens the existing advanced task editor.
   Purely derived from store data — no new persistence.
   v5 (Task 17-c) additions, all gated by hasFeature("due-dates"):
     - per-day capacity bars in the day headers (open-task
       focus-unit load vs the daily capacity slider value)
     - Smart week plan panel: buildWeekPlan() preview with
       per-day load chips + suggested moves, Apply/Cancel
     - Print: a .gc-print-root week table + Print button;
       the @media print rules live at the end of globals.css
   ========================================================= */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useStore, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { localDateKey, shiftDays } from "@/lib/goalcheck/logic";
import { GcIcon } from "@/lib/goalcheck/icons";
import { useT } from "@/lib/goalcheck/i18n";
import { hasFeature } from "@/lib/goalcheck/editions";
import { buildWeekPlan, type WeekPlan } from "@/lib/goalcheck/planner";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

const DAY_MS = 86_400_000;

/** localStorage key for the daily capacity (focus units per day). */
const CAPACITY_KEY = "gc_daily_capacity";
const CAPACITY_DEFAULT = 8;

function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - dow * DAY_MS);
}

const DAY_KEYS = ["week.mon", "week.tue", "week.wed", "week.thu", "week.fri", "week.sat", "week.sun"];

/** Effective focus-unit load of a task (0/unset estimate counts as 1). */
function effEstimate(estimate: number): number {
  return Math.max(1, Math.round(Number(estimate) || 0));
}

/** Chip/bar color: over capacity → danger, ≥80% → warning, else success. */
function loadColor(load: number, capacity: number): string {
  if (capacity > 0 && load > capacity) return "var(--gc-danger)";
  if (capacity > 0 && load >= capacity * 0.8) return "var(--gc-warning)";
  return "var(--gc-success)";
}

/** "2026-02-11" → "11/2" (locale-neutral, compact). */
function shortDate(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const REASON_KEYS: Record<WeekPlan["moves"][number]["reason"], string> = {
  overdue: "plan.reasonOverdue",
  overload: "plan.reasonOverload",
  unscheduled: "plan.reasonUnscheduled",
};

const REASON_COLORS: Record<WeekPlan["moves"][number]["reason"], { bg: string; fg: string }> = {
  overdue: { bg: "var(--gc-danger-soft)", fg: "var(--gc-danger)" },
  overload: { bg: "var(--gc-warning-soft)", fg: "var(--gc-warning)" },
  unscheduled: { bg: "var(--gc-soft)", fg: "var(--gc-accent)" },
};

export function WeekView() {
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const toggleTask = useStore((s) => s.toggleTask);
  const setTaskAdvanced = useStore((s) => s.setTaskAdvanced);
  const openTaskEdit = useUi((s) => s.openTaskEditModal);
  const t = useT();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  /* Task 17-c — smart plan panel state (gated by hasFeature("due-dates")) */
  const planEnabled = hasFeature("due-dates");
  const [planOpen, setPlanOpen] = useState(false);
  /* Lazy init from localStorage — WeekView is a client-only dynamic import
     (ssr:false in page.tsx), so reading storage during first render is safe. */
  const [capacity, setCapacity] = useState<number>(() => {
    if (typeof window === "undefined") return CAPACITY_DEFAULT;
    try {
      const raw = window.localStorage.getItem(CAPACITY_KEY);
      if (raw) {
        const v = parseInt(raw, 10);
        if (v >= 1 && v <= 16) return v;
      }
    } catch {
      /* storage blocked — keep the default */
    }
    return CAPACITY_DEFAULT;
  });
  const [plan, setPlan] = useState<WeekPlan | null>(null);

  const changeCapacity = (v: number) => {
    const clamped = Math.min(16, Math.max(1, Math.round(v) || CAPACITY_DEFAULT));
    setCapacity(clamped);
    try {
      window.localStorage.setItem(CAPACITY_KEY, String(clamped));
    } catch {
      /* storage blocked — in-session only */
    }
  };

  const goal = goals.find((g) => g.id === activeGoalId);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS)),
    [weekStart],
  );
  const todayKey = localDateKey(new Date());

  const columns = useMemo(() => {
    const keys = days.map((d) => localDateKey(d));
    const buckets: Record<string, { catId: string; catTitle: string; id: string; text: string; completed: boolean; priority: string; recurrence: string; estimate: number }[]> = {};
    keys.forEach((k) => { buckets[k] = []; });
    const overdue: typeof buckets[string] = [];
    for (const cat of goal?.categories ?? []) {
      for (const it of cat.items) {
        if (!it.dueDate) continue;
        const dueKey = it.dueDate.slice(0, 10);
        if (buckets[dueKey]) {
          buckets[dueKey].push({ catId: cat.id, catTitle: cat.title, id: it.id, text: it.text, completed: it.completed, priority: it.priority, recurrence: it.recurrence || "", estimate: it.estimate });
        } else if (dueKey < todayKey && !it.completed) {
          overdue.push({ catId: cat.id, catTitle: cat.title, id: it.id, text: it.text, completed: it.completed, priority: it.priority, recurrence: it.recurrence || "", estimate: it.estimate });
        }
      }
    }
    return { buckets, overdue, keys };
  }, [goal, days, todayKey]);

  const isThisWeek = localDateKey(weekStart) === localDateKey(startOfWeek(new Date()));

  /* Task 17-c — planning + apply */
  const buildPlan = () => {
    if (!goal) return;
    setPlan(buildWeekPlan(goal, { today: new Date(), capacity }));
  };

  const applyPlan = () => {
    if (!plan) return;
    for (const m of plan.moves) setTaskAdvanced(m.catId, m.taskId, { dueDate: m.to });
    setPlan(null);
  };

  /* Task 17-c — print support: range heading for the viewed week */
  const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const rangeText = `${fmtDay(days[0])} – ${fmtDay(days[6])}`;

  return (
    <motion.section
      className="gc-panel gc-blur rounded-2xl p-4 sm:p-5"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-label={t("week.planner")}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
          <GcIcon name="calendar-tick" size={16} /> {t("week.heading", { name: goal?.title ?? t("week.noBoard") })}
        </p>
        <div className="flex items-center gap-1.5">
          {planEnabled && (
            <Button type="button" variant="outline" size="sm" className="h-8 gc-btn" onClick={() => window.print()}>
              <GcIcon name="doc-lines" size={13} /> {t("plan.print")}
            </Button>
          )}
          <Button type="button" variant="outline" size="icon" className="size-8 gc-btn" aria-label={t("week.prevWeek")}
            onClick={() => setWeekStart((w) => shiftDays(w, -7))}>‹</Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gc-btn" disabled={isThisWeek}
            onClick={() => setWeekStart(startOfWeek(new Date()))}>{t("week.thisWeek")}</Button>
          <Button type="button" variant="outline" size="icon" className="size-8 gc-btn" aria-label={t("week.nextWeek")}
            onClick={() => setWeekStart((w) => shiftDays(w, 7))}>›</Button>
        </div>
      </header>

      {columns.overdue.length > 0 && (
        <div className="mb-3 rounded-xl border p-2.5" style={{ borderColor: "var(--gc-danger-soft)", background: "var(--gc-danger-soft)" }}>
          <p className="mb-1.5 text-[0.68rem] font-extrabold uppercase tracking-wide" style={{ color: "color-mix(in srgb, var(--gc-danger) 62%, var(--gc-text))" }}>
            {t("week.overdueCount", { count: columns.overdue.length })}
          </p>
          <ul className="flex flex-col gap-1">
            {columns.overdue.map((task) => (
              <li key={task.id}>
                <button type="button" onClick={() => toggleTask(task.catId, task.id)}
                  className="w-full rounded-lg px-2 py-1 text-left text-xs font-bold hover:opacity-80"
                  title={t("week.clickComplete")}>
                  {task.text} <span className="font-normal opacity-70">· {task.catTitle}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" role="list" aria-label={t("week.daysLabel")}>
        {days.map((d, i) => {
          const key = localDateKey(d);
          const isToday = key === todayKey;
          const items = columns.buckets[key] ?? [];
          const doneCount = items.filter((task) => task.completed).length;
          const openLoad = items.reduce((sum, task) => sum + (task.completed ? 0 : effEstimate(task.estimate)), 0);
          return (
            <div key={key} role="listitem"
              className="flex min-h-[120px] flex-col rounded-xl border p-2"
              style={{
                borderColor: isToday ? "var(--gc-accent)" : "var(--gc-border)",
                background: isToday ? "var(--gc-soft)" : "var(--gc-surface-2)",
                boxShadow: isToday ? "0 0 0 1px var(--gc-accent)" : undefined,
              }}
            >
              <p className="mb-1.5 flex items-baseline justify-between text-[0.68rem] font-extrabold uppercase tracking-wide"
                style={{ color: isToday ? "var(--gc-accent)" : "var(--gc-text2)" }}>
                <span>{t(DAY_KEYS[i])}</span>
                <span className="font-mono">{d.getDate()}</span>
              </p>
              {planEnabled && (
                <div className="mb-1.5 flex items-center gap-1.5" aria-label={t("plan.loadAria", { load: openLoad, capacity })}>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--gc-border)" }}>
                    <span className="block h-full rounded-full transition-[width]"
                      style={{ width: `${capacity > 0 ? Math.min(100, (openLoad / capacity) * 100) : 100}%`, background: loadColor(openLoad, capacity) }} />
                  </span>
                  <span className="font-mono text-[0.6rem] font-bold" style={{ color: loadColor(openLoad, capacity) }}>
                    {openLoad}/{capacity}
                  </span>
                </div>
              )}
              <ul className="flex flex-1 flex-col gap-1">
                {items.map((task) => (
                  <li key={task.id} className="group flex items-start gap-1">
                    <button type="button" onClick={() => toggleTask(task.catId, task.id)}
                      className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left text-[0.7rem] font-bold leading-tight hover:opacity-80"
                      style={{ textDecoration: task.completed ? "line-through" : undefined, opacity: task.completed ? 0.55 : 1 }}
                      title={task.completed ? t("week.markNotDone") : t("week.markDone")}>
                      {task.text}
                      <span className="block truncate text-[0.6rem] font-normal" style={{ color: "var(--gc-text2)" }}>{task.catTitle}</span>
                    </button>
                    <button type="button" aria-label={t("week.editTask", { name: task.text })}
                      className="mt-0.5 shrink-0 rounded-md p-0.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                      onClick={() => openTaskEdit({ catId: task.catId, taskId: task.id })}>
                      <GcIcon name="pencil-line" size={11} />
                    </button>
                  </li>
                ))}
                {items.length === 0 && <li className="text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>—</li>}
              </ul>
              {items.length > 0 && (
                <p className="mt-1.5 text-center text-[0.6rem] font-bold" style={{ color: "var(--gc-text2)" }}>
                  {doneCount}/{items.length}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[0.68rem]" style={{ color: "var(--gc-muted)" }}>
        {t("week.hint")}
      </p>

      {planEnabled && (
        <section className="gc-panel mt-4 rounded-2xl p-3 sm:p-4" aria-label={t("plan.title")}>
          <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg text-left"
            aria-expanded={planOpen} onClick={() => setPlanOpen((o) => !o)}>
            <span className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
              <GcIcon name="bulb-glow" size={16} /> {t("plan.title")}
            </span>
            <span aria-hidden="true" className="text-xs font-bold">{planOpen ? "▾" : "▸"}</span>
          </button>

          {planOpen && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex min-w-56 flex-1 items-center gap-2.5 text-xs font-bold" style={{ color: "var(--gc-text2)" }}>
                  <span className="whitespace-nowrap">{t("plan.capacity")}</span>
                  <Slider value={[capacity]} min={1} max={16} step={1} className="w-36"
                    aria-label={t("plan.capacity")} onValueChange={(v) => changeCapacity(v[0] ?? CAPACITY_DEFAULT)} />
                  <span className="font-mono" style={{ color: "var(--gc-text)" }}>{capacity}</span>
                </label>
                <Button type="button" size="sm" className="gc-btn-primary" disabled={!goal} onClick={buildPlan}>
                  <GcIcon name="zap-star" size={13} /> {t("plan.build")}
                </Button>
              </div>

              {plan && plan.moves.length === 0 && (
                <p className="text-xs font-bold" style={{ color: "var(--gc-success)" }}>{t("plan.noMoves")}</p>
              )}

              {plan && plan.moves.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div>
                    <p className="mb-1.5 text-[0.68rem] font-extrabold uppercase tracking-wide" style={{ color: "var(--gc-text2)" }}>
                      {t("plan.moves", { count: plan.moves.length })}
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {plan.perDay.map((day) => {
                        const dt = new Date(`${day.date}T00:00:00`);
                        return (
                          <li key={day.date} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[0.68rem] font-bold"
                            style={{ borderColor: "var(--gc-border)" }}>
                            <span className="uppercase" style={{ color: "var(--gc-text2)" }}>
                              {t(DAY_KEYS[(dt.getDay() + 6) % 7])} {dt.getDate()}
                            </span>
                            <span className="rounded-md px-1.5 py-0.5 font-mono text-[0.62rem]"
                              style={{ background: "var(--gc-surface-2)", color: loadColor(day.load, day.capacity) }}>
                              {day.load}/{day.capacity}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {plan.moves.map((m) => {
                      const chip = REASON_COLORS[m.reason];
                      return (
                        <li key={`${m.catId}:${m.taskId}`} className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-bold">{m.text}</span>
                          <span className="font-mono opacity-70" style={{ color: "var(--gc-text2)" }}>
                            {m.from ? shortDate(m.from) : t("plan.fromUnset")} → {shortDate(m.to)}
                          </span>
                          <span className="rounded-md px-1.5 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wide"
                            style={{ background: chip.bg, color: chip.fg }}>
                            {t(REASON_KEYS[m.reason])}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" className="gc-btn-primary" onClick={applyPlan}>{t("plan.apply")}</Button>
                    <Button type="button" size="sm" variant="outline" className="gc-btn" onClick={() => setPlan(null)}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {planEnabled && (
        <div className="gc-print-root" aria-hidden="true">
          <h1 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px" }}>{goal?.title ?? t("week.noBoard")}</h1>
          <p style={{ fontSize: 11, margin: "0 0 6px", color: "#444" }}>{rangeText}</p>
          <table>
            <thead>
              <tr>
                {days.map((d, i) => (
                  <th key={localDateKey(d)}>{t(DAY_KEYS[i])} {d.getDate()}/{d.getMonth() + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {days.map((d) => {
                  const items = columns.buckets[localDateKey(d)] ?? [];
                  const open = items.filter((x) => !x.completed);
                  const done = items.filter((x) => x.completed);
                  return (
                    <td key={localDateKey(d)}>
                      {open.map((x) => (
                        <div key={x.id} style={{ margin: "0 0 3px" }}>☐ {x.text} ({effEstimate(x.estimate)})</div>
                      ))}
                      {done.map((x) => (
                        <div key={x.id} style={{ margin: "0 0 3px", textDecoration: "line-through", color: "#777" }}>☑ {x.text}</div>
                      ))}
                      {items.length === 0 && <div style={{ color: "#aaa" }}>—</div>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </motion.section>
  );
}
