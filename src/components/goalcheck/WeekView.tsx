"use client";

/* =========================================================
   v4.2 — Week view (Advance): a 7-day planner grid over the
   active board's due dates. Tasks land in their due-day
   column, overdue ones pool at the top, clicking toggles a
   task, the pencil opens the existing advanced task editor.
   Purely derived from store data — no new persistence.
   ========================================================= */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useStore, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { localDateKey, shiftDays } from "@/lib/goalcheck/logic";
import { GcIcon } from "@/lib/goalcheck/icons";
import { useT } from "@/lib/goalcheck/i18n";
import { Button } from "@/components/ui/button";

const DAY_MS = 86_400_000;

function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - dow * DAY_MS);
}

const DAY_KEYS = ["week.mon", "week.tue", "week.wed", "week.thu", "week.fri", "week.sat", "week.sun"];

export function WeekView() {
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const toggleTask = useStore((s) => s.toggleTask);
  const openTaskEdit = useUi((s) => s.openTaskEditModal);
  const t = useT();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const goal = goals.find((g) => g.id === activeGoalId);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS)),
    [weekStart],
  );
  const todayKey = localDateKey(new Date());

  const columns = useMemo(() => {
    const keys = days.map((d) => localDateKey(d));
    const buckets: Record<string, { catId: string; catTitle: string; id: string; text: string; completed: boolean; priority: string; recurrence: string }[]> = {};
    keys.forEach((k) => { buckets[k] = []; });
    const overdue: typeof buckets[string] = [];
    for (const cat of goal?.categories ?? []) {
      for (const it of cat.items) {
        if (!it.dueDate) continue;
        const dueKey = it.dueDate.slice(0, 10);
        if (buckets[dueKey]) {
          buckets[dueKey].push({ catId: cat.id, catTitle: cat.title, id: it.id, text: it.text, completed: it.completed, priority: it.priority, recurrence: it.recurrence || "" });
        } else if (dueKey < todayKey && !it.completed) {
          overdue.push({ catId: cat.id, catTitle: cat.title, id: it.id, text: it.text, completed: it.completed, priority: it.priority, recurrence: it.recurrence || "" });
        }
      }
    }
    return { buckets, overdue, keys };
  }, [goal, days, todayKey]);

  const isThisWeek = localDateKey(weekStart) === localDateKey(startOfWeek(new Date()));

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
    </motion.section>
  );
}
