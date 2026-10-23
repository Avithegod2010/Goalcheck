"use client";

/* =========================================================
   v4.3 — Timeline view (Advance): a mini-Gantt roadmap.
   Horizontal 8-week axis (current week first), one lane per
   goal board, tasks plotted at their due date, dependency
   locks marked. Overdue work clusters at the left edge.
   Purely derived from store data.
   ========================================================= */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useStore, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { localDateKey, shiftDays } from "@/lib/goalcheck/logic";
import { GcIcon } from "@/lib/goalcheck/icons";
import { useT } from "@/lib/goalcheck/i18n";

const DAY_MS = 86_400_000;
const WEEKS = 8;

function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY_MS);
}

interface LaneTask {
  catId: string;
  catTitle: string;
  id: string;
  text: string;
  completed: boolean;
  dueDate: string;
  dependsOn: string;
  prereqText: string;
  /** week index 0..WEEKS-1, or -1 when overdue */
  week: number;
}

const PRI_BG: Record<string, string> = {
  urgent: "color-mix(in srgb, var(--gc-danger) 24%, var(--gc-surface-2))",
  high: "color-mix(in srgb, var(--gc-warning) 24%, var(--gc-surface-2))",
  normal: "color-mix(in srgb, var(--gc-accent) 18%, var(--gc-surface-2))",
};

export function TimelineView() {
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const setActiveGoal = useStore((s) => s.setActiveGoal);
  const toggleTask = useStore((s) => s.toggleTask);
  const openTaskEdit = useUi((s) => s.openTaskEditModal);
  const t = useT();

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekKeys = useMemo(
    () => Array.from({ length: WEEKS }, (_, i) => localDateKey(shiftDays(weekStart, i * 7))),
    [weekStart],
  );
  const todayKey = localDateKey(new Date());

  const lanes = useMemo(() => {
    const byId: Record<string, string> = {};
    for (const g of goals) {
      for (const c of g.categories) for (const it of c.items) byId[it.id] = it.text;
    }
    return goals.slice(0, 6).map((g) => {
      const tasks: LaneTask[] = [];
      for (const cat of g.categories) {
        for (const it of cat.items) {
          if (!it.dueDate) continue;
          const dueKey = it.dueDate.slice(0, 10);
          let week = weekKeys.findIndex((k) => {
            const wStart = new Date(`${k}T00:00:00`).getTime();
            return dueKey >= k && dueKey <= localDateKey(new Date(wStart + 6 * DAY_MS));
          });
          if (dueKey < weekKeys[0]) week = -1; // overdue or past
          if (dueKey > (weekKeys[WEEKS - 1] ?? "")) week = WEEKS; // beyond horizon
          tasks.push({
            catId: cat.id, catTitle: cat.title, id: it.id, text: it.text,
            completed: it.completed, dueDate: dueKey, dependsOn: it.dependsOn || "",
            prereqText: it.dependsOn ? (byId[it.dependsOn] ?? "") : "",
            week,
          });
        }
      }
      return { goal: g, tasks };
    });
  }, [goals, weekKeys]);

  const beyondCount = lanes.reduce((n, l) => n + l.tasks.filter((task) => task.week === WEEKS).length, 0);

  return (
    <motion.section
      className="gc-panel gc-blur rounded-2xl p-4 sm:p-5"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-label={t("timeline.title")}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
          <GcIcon name="network-nodes" size={16} /> {t("timeline.heading", { count: WEEKS })}
        </p>
        <p className="text-[0.68rem]" style={{ color: "var(--gc-muted)" }}>
          {t("timeline.sub")}
        </p>
      </header>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[720px]">
          {/* axis header */}
          <div className="mb-1 flex" style={{ paddingLeft: "9.5rem" }}>
            {weekKeys.map((k, i) => {
              const d = new Date(`${k}T00:00:00`);
              const isCurrent = k === weekKeys[0];
              return (
                <div key={k} className="flex-1 border-l pl-1 text-[0.6rem] font-extrabold uppercase tracking-wide"
                  style={{ borderColor: "var(--gc-border)", color: isCurrent ? "var(--gc-accent)" : "var(--gc-muted)" }}>
                  {t("timeline.weekLabel", { index: i + 1, date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) })}
                </div>
              );
            })}
            {beyondCount > 0 && (
              <div className="border-l pl-1 text-[0.6rem] font-extrabold uppercase tracking-wide" style={{ borderColor: "var(--gc-border)", color: "var(--gc-muted)" }}>
                {t("timeline.later")}
              </div>
            )}
          </div>

          {lanes.map(({ goal: g, tasks }) => (
            <div key={g.id} className="mb-2">
              <button
                type="button"
                onClick={() => setActiveGoal(g.id)}
                className="mb-1 flex items-center gap-1.5 text-left text-xs font-extrabold hover:underline"
                style={{ color: g.id === activeGoalId ? "var(--gc-accent)" : "var(--gc-text2)" }}
                title={t("timeline.openBoard", { name: g.title })}
              >
                <GcIcon name="folder-open" size={12} /> {g.title}
              </button>
              <div className="relative ml-1 rounded-lg" style={{ background: "var(--gc-surface-2)", minHeight: 34 }}>
                {/* today marker */}
                {(() => {
                  const daysInto = Math.round((new Date(`${todayKey}T00:00:00`).getTime() - weekStart.getTime()) / DAY_MS);
                  const pct = (daysInto / (WEEKS * 7)) * 100;
                  if (pct < 0 || pct > 100) return null;
                  return (
                    <div aria-hidden="true" className="absolute bottom-0 top-0 w-px" style={{ left: `calc(9.5rem + (100% - 9.5rem) * ${pct / 100})`, background: "var(--gc-danger)", opacity: 0.55 }}>
                      <span className="absolute -top-0.5 left-1 text-[0.52rem] font-black uppercase" style={{ color: "var(--gc-danger)" }}>{t("timeline.today")}</span>
                    </div>
                  );
                })()}
                <div className="relative flex" style={{ paddingLeft: "9.5rem", minHeight: 34 }}>
                  {weekKeys.map((k) => (
                    <div key={k} className="flex-1 border-l" style={{ borderColor: "var(--gc-border)", minHeight: 34 }} aria-hidden="true" />
                  ))}
                  {beyondCount > 0 && <div className="w-20 border-l" style={{ borderColor: "var(--gc-border)" }} aria-hidden="true" />}
                  {tasks.map((task) => {
                    const left = task.week <= 0 ? 0 : (task.week / (WEEKS + (beyondCount > 0 ? 1.4 : 0))) * 100;
                    const overdue = task.week === -1;
                    return (
                      <div key={task.id} className="group absolute top-1 z-10 max-w-[46%]" style={{ left: `calc(9.5rem + (100% - 9.5rem) * ${Math.min(96, Math.max(0, overdue ? 0 : left))} / 100)`, transform: "translateX(2px)" }}>
                        <button
                          type="button"
                          onClick={() => toggleTask(task.catId, task.id)}
                          className={`flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[0.6rem] font-bold hover:brightness-110 ${task.completed ? "line-through opacity-45" : ""}`}
                          style={{ background: PRI_BG[task.priority] ?? PRI_BG.normal, color: "var(--gc-text)" }}
                          title={task.prereqText
                            ? t("timeline.dueTitlePrereq", { name: task.text, date: task.dueDate, prereq: task.prereqText })
                            : t("timeline.dueTitle", { name: task.text, date: task.dueDate })}
                        >
                          {overdue && <GcIcon name="flame-ember" size={9} />}
                          {task.dependsOn && !overdue && <GcIcon name="link-combo" size={9} />}
                          <span className="truncate">{task.text}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={t("week.editTask", { name: task.text })}
                          className="ml-1 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                          onClick={() => openTaskEdit({ catId: task.catId, taskId: task.id })}
                        >
                          <GcIcon name="pencil-line" size={9} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[0.68rem]" style={{ color: "var(--gc-muted)" }}>
        <GcIcon name="flame-ember" size={10} /> {t("timeline.legendOverdue")} · <GcIcon name="link-combo" size={10} /> {t("timeline.legendDependency")} · {t("timeline.legendBoard")}
      </p>
    </motion.section>
  );
}
