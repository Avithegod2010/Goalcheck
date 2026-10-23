"use client";

/* =========================================================
   v4.3 — Calendar view (Advance): a month planner grid over
   the active board's due dates. Drag any chip onto a day to
   (re)schedule it; drag unscheduled tasks from the pool into
   the month; click a chip to complete it; pencil opens the
   advanced task editor. Purely derived from store data.
   ========================================================= */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useStore, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { localDateKey, shiftDays } from "@/lib/goalcheck/logic";
import { GcIcon } from "@/lib/goalcheck/icons";
import { useT } from "@/lib/goalcheck/i18n";
import { Button } from "@/components/ui/button";

const DAY_MS = 86_400_000;
const DAY_KEYS = ["week.mon", "week.tue", "week.wed", "week.thu", "week.fri", "week.sat", "week.sun"];

interface CalTask {
  catId: string;
  id: string;
  text: string;
  completed: boolean;
  priority: string;
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** 6×7 grid of days covering the month (Mon-start). */
function monthGrid(monthStart: Date): Date[] {
  const dow = (monthStart.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(monthStart.getTime() - dow * DAY_MS);
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY_MS));
}

const PRI_DOT: Record<string, string> = {
  urgent: "var(--gc-danger)",
  high: "var(--gc-warning)",
  normal: "var(--gc-accent)",
};

export function CalendarView() {
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const toggleTask = useStore((s) => s.toggleTask);
  const setTaskAdvanced = useStore((s) => s.setTaskAdvanced);
  const openTaskEdit = useUi((s) => s.openTaskEditModal);
  const t = useT();
  const [monthStart, setMonthStart] = useState<Date>(() => startOfMonth(new Date()));
  const [dragOver, setDragOver] = useState<string>("");

  const goal = goals.find((g) => g.id === activeGoalId);
  const todayKey = localDateKey(new Date());

  /* bucket every task by due date + collect unscheduled/overdue pools */
  const model = useMemo(() => {
    const byDay: Record<string, CalTask[]> = {};
    const unscheduled: CalTask[] = [];
    const overdue: CalTask[] = [];
    for (const cat of goal?.categories ?? []) {
      for (const it of cat.items) {
        const t: CalTask = { catId: cat.id, id: it.id, text: it.text, completed: it.completed, priority: it.priority || "normal" };
        if (!it.dueDate) {
          if (!it.completed) unscheduled.push(t);
          continue;
        }
        const dueKey = it.dueDate.slice(0, 10);
        if (dueKey < todayKey && !it.completed) overdue.push(t);
        else (byDay[dueKey] ??= []).push(t);
      }
    }
    return { byDay, unscheduled, overdue };
  }, [goal, todayKey]);

  const days = useMemo(() => monthGrid(monthStart), [monthStart]);
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const isThisMonth = monthStart.getMonth() === new Date().getMonth() && monthStart.getFullYear() === new Date().getFullYear();

  const drop = (dayKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver("");
    const raw = e.dataTransfer.getData("text/gc-task");
    if (!raw) return;
    try {
      const { catId, id } = JSON.parse(raw) as { catId: string; id: string };
      setTaskAdvanced(catId, id, { dueDate: dayKey });
    } catch { /* ignore malformed drag payloads */ }
  };

  const chip = (task: CalTask) => (
    <div
      key={task.id}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/gc-task", JSON.stringify({ catId: task.catId, id: task.id }))}
      className="group flex cursor-grab items-center gap-1 rounded-md px-1 py-[3px] text-left text-[0.62rem] font-bold leading-tight active:cursor-grabbing"
      style={{ background: "var(--gc-surface-2)", color: "var(--gc-text)" }}
      title={t("calendar.dragReschedule", { name: task.text })}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PRI_DOT[task.priority] ?? "var(--gc-accent)" }} aria-hidden="true" />
      <button
        type="button"
        onClick={() => toggleTask(task.catId, task.id)}
        className={`min-w-0 flex-1 truncate text-left hover:opacity-75 ${task.completed ? "line-through opacity-50" : ""}`}
        title={task.completed ? t("week.markNotDone") : t("week.markDone")}
      >
        {task.text}
      </button>
      <button
        type="button"
        aria-label={t("week.editTask", { name: task.text })}
        className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        onClick={() => openTaskEdit({ catId: task.catId, taskId: task.id })}
      >
        <GcIcon name="pencil-line" size={10} />
      </button>
    </div>
  );

  return (
    <motion.section
      className="gc-panel gc-blur rounded-2xl p-4 sm:p-5"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-label={t("calendar.title")}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
          <GcIcon name="calendar-tick" size={16} /> {t("calendar.heading", { name: goal?.title ?? t("week.noBoard") })}
        </p>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon" className="size-8 gc-btn" aria-label={t("calendar.prevMonth")}
            onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</Button>
          <span className="min-w-[130px] text-center text-xs font-extrabold" style={{ color: "var(--gc-text2)" }}>{monthLabel}</span>
          <Button type="button" variant="outline" size="icon" className="size-8 gc-btn" aria-label={t("calendar.nextMonth")}
            onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gc-btn" disabled={isThisMonth}
            onClick={() => setMonthStart(startOfMonth(new Date()))}>{t("calendar.thisMonth")}</Button>
        </div>
      </header>

      {(model.unscheduled.length > 0 || model.overdue.length > 0) && (
        <div
          className="mb-3 rounded-xl border p-2.5"
          style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={drop("")}
        >
          {model.overdue.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-[0.65rem] font-extrabold uppercase tracking-wide" style={{ color: "color-mix(in srgb, var(--gc-danger) 62%, var(--gc-text))" }}>
                {t("calendar.overduePool", { count: model.overdue.length })}
              </p>
              <div className="flex flex-wrap gap-1">{model.overdue.map(chip)}</div>
            </div>
          )}
          {model.unscheduled.length > 0 && (
            <div>
              <p className="mb-1 text-[0.65rem] font-extrabold uppercase tracking-wide" style={{ color: "var(--gc-text2)" }}>
                {t("calendar.noDatePool", { count: model.unscheduled.length })}
              </p>
              <div className="flex flex-wrap gap-1">{model.unscheduled.map(chip)}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={t("calendar.daysLabel")}>
        {DAY_KEYS.map((k) => (
          <p key={k} className="pb-1 text-center text-[0.62rem] font-extrabold uppercase tracking-wide" style={{ color: "var(--gc-muted)" }} role="columnheader">
            {t(k)}
          </p>
        ))}
        {days.map((d) => {
          const key = localDateKey(d);
          const inMonth = d.getMonth() === monthStart.getMonth();
          const isToday = key === todayKey;
          const items = model.byDay[key] ?? [];
          const doneCount = items.filter((task) => task.completed).length;
          return (
            <div
              key={key}
              role="gridcell"
              aria-label={`${d.toDateString()}${items.length ? t("calendar.cellTasks", { count: items.length }) : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
              onDragLeave={() => setDragOver((k) => (k === key ? "" : k))}
              onDrop={drop(key)}
              className="flex min-h-[64px] flex-col gap-0.5 rounded-lg border p-1 transition-colors sm:min-h-[84px]"
              style={{
                borderColor: isToday ? "var(--gc-accent)" : dragOver === key ? "var(--gc-accent)" : "var(--gc-border)",
                background: dragOver === key ? "var(--gc-soft)" : isToday ? "var(--gc-soft)" : "var(--gc-surface-2)",
                opacity: inMonth ? 1 : 0.38,
                boxShadow: isToday ? "0 0 0 1px var(--gc-accent)" : undefined,
              }}
            >
              <p className="flex items-baseline justify-between px-0.5 text-[0.6rem] font-extrabold" style={{ color: isToday ? "var(--gc-accent)" : "var(--gc-text2)" }}>
                <span className="font-mono">{d.getDate()}</span>
                {items.length > 0 && <span className="font-mono text-[0.55rem]">{doneCount}/{items.length}</span>}
              </p>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {items.slice(0, 3).map(chip)}
                {items.length > 3 && (
                  <p className="px-0.5 text-[0.55rem] font-bold" style={{ color: "var(--gc-muted)" }}>{t("calendar.more", { count: items.length - 3 })}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[0.68rem]" style={{ color: "var(--gc-muted)" }}>
        {t("calendar.hint")}
      </p>
    </motion.section>
  );
}
