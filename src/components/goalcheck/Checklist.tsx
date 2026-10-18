"use client";

/* =========================================================
   Checklist view: category cards + task items (with subtasks,
   priority badges, notes, dependency locks, drag-free reorder).
   Mobile-first: NO nested scroll containers (tasks render in full).
   Fluidity: staggered card entrances, layout-animated rows,
   drawing checkmark, wipe strike-through, springy controls.
   ========================================================= */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, useActiveGoal, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { MediaBadge } from "./atoms";
import { GcIcon } from "@/lib/goalcheck/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Pencil, Trash2, Plus, Lock, Settings2, Puzzle } from "lucide-react";
import type { Category, Task } from "@/lib/goalcheck/types";
import { dueStatus, inCurrentWeek } from "@/lib/goalcheck/logic";
import { hasFeature } from "@/lib/goalcheck/editions";

const EASE = [0.22, 1, 0.36, 1] as const;

export function ChecklistGrid() {
  const goal = useActiveGoal();
  const layout = useStore((s) => s.layoutMode);
  const search = useStore((s) => s.searchQuery);
  const editingCategoryId = useStore((s) => s.editingCategoryId);

  if (!goal) return null;

  const visibleCats = goal.categories.filter((cat) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      cat.title.toLowerCase().includes(q) ||
      cat.items.some((it) => it.text.toLowerCase().includes(q) || (it.notes || "").toLowerCase().includes(q))
    );
  });

  return (
    <AnimatePresence mode="popLayout">
      <div
        key={layout}
        className={`grid items-start gap-5 ${layout === "single" ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"}`}
        aria-label="Categories"
      >
        {visibleCats.length === 0 && (
          <motion.div
            className="gc-panel col-span-full p-10 text-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="mb-3 flex justify-center">
              <span className="gc-float flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "var(--gc-soft)", color: "var(--gc-accent)" }}>
                <GcIcon name="folder-open" size={34} />
              </span>
            </div>
            <h3 className="mb-1 text-lg font-extrabold">No categories {search ? "match your search" : "in this board yet"}</h3>
            <p className="text-sm" style={{ color: "var(--gc-text2)" }}>
              {search ? "Try a different search term or clear the filter." : "Use the quick add bar above, or import your workflow via Quick Paste."}
            </p>
          </motion.div>
        )}
        {visibleCats.map((cat, i) => (
          <CategoryCard key={cat.id} cat={cat} editing={editingCategoryId === cat.id} index={i} />
        ))}
      </div>
    </AnimatePresence>
  );
}

function CategoryCard({ cat, editing, index }: { cat: Category; editing: boolean; index: number }) {
  const filter = useStore((s) => s.filter);
  const search = useStore((s) => s.searchQuery.trim().toLowerCase());
  const openSubtaskId = useStore((s) => s.openSubtaskId);
  const setEditingCategory = useStore((s) => s.setEditingCategory);
  const renameCategory = useStore((s) => s.renameCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const toggleAllCategory = useStore((s) => s.toggleAllCategory);
  const openMediaModal = useUi((s) => s.openMediaModal);

  const total = cat.items.length;
  const completed = cat.items.filter((it) => it.completed).length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const allDone = total > 0 && completed === total;

  const visibleItems = cat.items.filter((it) => {
    if (filter === "active" && it.completed) return false;
    if (filter === "completed" && !it.completed) return false;
    if (filter === "priority" && it.priority === "normal") return false;
    if (filter === "week" && !inCurrentWeek(it.dueDate)) return false;
    if (search) {
      const hay = `${it.text} ${it.notes || ""} ${cat.title}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 22, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.22 } }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.07, 0.35), ease: EASE }}
      className="gc-panel gc-blur flex flex-col overflow-hidden"
      style={{ borderTop: "4px solid var(--gc-accent)" }}
      aria-label={cat.title}
      whileHover={{ boxShadow: "0 14px 40px -8px var(--gc-glow)" }}
    >
      <header className="border-b p-4 pb-3" style={{ borderColor: "var(--gc-border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <motion.button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--gc-border-strong)", background: "var(--gc-surface-2)" }}
              onClick={() => openMediaModal({ type: "category", catId: cat.id })}
              title="Customize category icon"
              aria-label="Customize category icon"
              whileHover={{ scale: 1.08, rotate: -5 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 380, damping: 16 }}
            >
              <MediaBadge value={cat.media} fallback="mono:clipboard-check" iconSize={22} />
            </motion.button>
            <div className="min-w-0 flex-1">
              {editing ? (
                <CategoryRenameForm initial={cat.title} onSave={(t) => { renameCategory(cat.id, t); setEditingCategory(null); }} onCancel={() => setEditingCategory(null)} />
              ) : (
                <button
                  type="button"
                  className="block w-full truncate text-left text-base font-extrabold transition-colors hover:text-[var(--gc-accent)] focus-visible:outline-2"
                  onClick={() => setEditingCategory(cat.id)}
                  title="Click to rename category"
                >
                  {cat.title}
                </button>
              )}
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.7rem]" style={{ color: "var(--gc-text2)" }}>
                {completed} / {total} done • {pct}%
                {cat.recurrence === "daily" && (
                  <span className="inline-flex items-center gap-1" style={{ color: "var(--gc-accent)" }}>
                    <GcIcon name="repeat-cycle" size={11} /> daily
                  </span>
                )}
                {cat.recurrence === "weekly" && (
                  <span className="inline-flex items-center gap-1" style={{ color: "var(--gc-accent)" }}>
                    <GcIcon name="calendar-tick" size={11} /> weekly
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <motion.button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg gc-btn"
              title={allDone ? "Undo all" : "Mark all done"}
              aria-label="Toggle all tasks done"
              onClick={() => toggleAllCategory(cat.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.88 }}
            >
              {allDone ? <GcIcon name="undo-ccw" size={15} /> : <GcIcon name="check-circle" size={15} />}
            </motion.button>
            <motion.button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg gc-btn"
              title="Customize icon"
              aria-label="Customize category icon"
              onClick={() => openMediaModal({ type: "category", catId: cat.id })}
              whileHover={{ scale: 1.1, rotate: 6 }}
              whileTap={{ scale: 0.88 }}
            >
              <GcIcon name="image-pic" size={15} />
            </motion.button>
            <DeleteCatButton onDelete={() => deleteCategory(cat.id)} title={cat.title} />
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: "var(--gc-surface-2)" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--gc-grad)" }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 110, damping: 22 }}
          />
        </div>
      </header>

      <ul className="flex flex-col gap-1 p-2" aria-label="Tasks">
        <AnimatePresence initial={false} mode="popLayout">
          {visibleItems.length === 0 && (
            <motion.li
              key="empty"
              className="px-2 py-6 text-center text-xs"
              style={{ color: "var(--gc-text2)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {total === 0 ? "No tasks yet — add the first one below!" : "No tasks match the current filter."}
            </motion.li>
          )}
          {visibleItems.map((it, idx) => (
            <TaskRow key={it.id} catId={cat.id} task={it} seq={cat.items.indexOf(it) + 1} index={idx} subOpen={openSubtaskId === it.id} />
          ))}
        </AnimatePresence>
      </ul>

      <RapidAddForm catId={cat.id} nextIndex={total + 1} />
    </motion.article>
  );
}

function CategoryRenameForm({ initial, onSave, onCancel }: { initial: string; onSave: (t: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); onSave(val); }}>
      <Input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} className="gc-input h-8 py-1 text-sm" aria-label="Category name" />
      <Button type="submit" size="sm" className="h-8 gc-btn-primary"><GcIcon name="check-circle" size={13} /></Button>
      <Button type="button" size="sm" variant="outline" className="h-8 gc-btn" onClick={onCancel}>✕</Button>
    </form>
  );
}

function DeleteCatButton({ onDelete, title }: { onDelete: () => void; title: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <motion.button
        type="button"
        className="flex size-8 items-center justify-center rounded-lg text-[var(--gc-danger)] gc-btn"
        title={`Delete category ${title}`}
        aria-label={`Delete category ${title}`}
        onClick={() => setConfirmOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.88 }}
      >
        <Trash2 className="h-4 w-4" />
      </motion.button>
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              className="gc-panel gc-blur w-full max-w-sm p-5"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
            >
              <h3 className="mb-1 text-base font-extrabold">Delete “{title}”?</h3>
              <p className="mb-4 text-sm" style={{ color: "var(--gc-text2)" }}>All tasks inside it will be removed. This cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="gc-btn" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button type="button" className="bg-[var(--gc-danger)] text-white hover:opacity-90 gc-btn" onClick={() => { onDelete(); setConfirmOpen(false); }}>Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------- Task row ---------------- */

const PRI_META = {
  normal: { label: "Normal", icon: "sliders-tune", color: "var(--gc-text2)" },
  high: { label: "High", icon: "star-shine", color: "var(--gc-warning)" },
  urgent: { label: "Urgent", icon: "flame-ember", color: "var(--gc-danger)" },
} as const;

function TaskRow({ catId, task, seq, index, subOpen }: { catId: string; task: Task; seq: number; index: number; subOpen: boolean }) {
  const toggleTask = useStore((s) => s.toggleTask);
  const cyclePriority = useStore((s) => s.cyclePriority);
  const moveTask = useStore((s) => s.moveTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const bindPomo = useStore((s) => s.bindPomo);
  const setOpenSubtask = useStore((s) => s.setOpenSubtask);
  const addSubtask = useStore((s) => s.addSubtask);
  const toggleSubtask = useStore((s) => s.toggleSubtask);
  const deleteSubtask = useStore((s) => s.deleteSubtask);
  const editingTaskId = useStore((s) => s.editingTaskId);
  const setEditingTask = useStore((s) => s.setEditingTask);
  const saveInlineEdit = useStore((s) => s.saveInlineEdit);
  const openTaskEditModal = useUi((s) => s.openTaskEditModal);
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);

  const isEditing = editingTaskId === `${catId}::${task.id}`;
  const prereq = task.dependsOn
    ? goals.find((g) => g.id === activeGoalId)?.categories.flatMap((c) => c.items).find((t) => t.id === task.dependsOn)
    : null;
  const locked = !!(prereq && !prereq.completed && !task.completed);
  const subDone = task.subtasks.filter((s) => s.completed).length;

  if (isEditing) {
    return (
      <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <TaskInlineEdit catId={catId} task={task} onSave={(text, notes) => saveInlineEdit(catId, task.id, text, notes)} onCancel={() => setEditingTask(null)} />
      </motion.li>
    );
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 18, scale: 0.96, transition: { duration: 0.2 } }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.03, 0.2), ease: EASE }}
      className={`flex flex-col gap-1 rounded-xl border border-transparent p-2 transition-colors hover:border-[var(--gc-border)] hover:bg-[var(--gc-surface-2)] ${task.completed ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        {/* left: toggle + label (grows, wraps below controls on narrow cards) */}
        <button
          type="button"
          className="flex min-w-[160px] flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-2"
          onClick={() => { if (!locked) toggleTask(catId, task.id); }}
          disabled={locked}
          aria-pressed={task.completed}
          title={locked ? `Locked until: ${prereq?.text}` : task.completed ? "Mark as not done" : "Mark as done"}
        >
          {/* animated checkbox: spring pop + path draw */}
          <motion.span
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2"
            animate={task.completed
              ? { background: "var(--gc-accent)", borderColor: "rgba(0,0,0,0)", scale: [1, 1.28, 1] }
              : { background: "rgba(0,0,0,0)", borderColor: "var(--gc-border-strong)", scale: 1 }}
            transition={{ duration: 0.38, ease: EASE }}
            aria-hidden="true"
          >
            <AnimatePresence>
              {task.completed && (
                <motion.svg key="ck" viewBox="0 0 24 24" width="13" height="13" initial={false}>
                  <motion.path
                    d="M5 12.5l4.2 4.2L19 7"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.32, delay: 0.08, ease: "easeOut" }}
                  />
                </motion.svg>
              )}
            </AnimatePresence>
          </motion.span>
          <span className="shrink-0 font-mono text-xs" style={{ color: "var(--gc-muted)" }}>{seq}.</span>
          <span className={`min-w-0 flex-1 break-words text-sm font-semibold transition-colors ${task.completed ? "" : ""}`} style={task.completed ? { color: "var(--gc-text2)" } : undefined}>
            <span className="relative inline">
              {locked && <Lock className="mr-1 inline h-3.5 w-3.5" aria-label="locked" />}
              {task.text}
              {task.completed && (
                <motion.span
                  className="strike-line"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.34, ease: "easeOut" }}
                />
              )}
            </span>
          </span>
        </button>

        {/* right: controls */}
        <div className="flex shrink-0 items-center gap-0.5">
          {hasFeature("due-dates") && task.dueDate && !task.completed && (
            <DueBadge dueDate={task.dueDate} />
          )}
          {hasFeature("recurring-tasks") && task.recurrence !== "none" && (
            <span className="flex items-center rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold" style={{ background: "var(--gc-soft)", color: "var(--gc-accent)" }} title={`Repeats ${task.recurrence}`}>
              <GcIcon name="repeat-cycle" size={11} /> {task.recurrence}
            </span>
          )}
          {!!task.pomosEstimate && (
            <span className="hidden items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[0.62rem] font-bold sm:flex" style={{ background: "var(--gc-surface-2)", color: "var(--gc-text2)" }} title="Pomodoro progress">
              <GcIcon name="tomato-timer" size={11} /> {task.pomoCount}/{task.pomosEstimate}
            </span>
          )}
          <motion.button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg gc-btn"
            title="Bind to Pomodoro"
            aria-label="Bind to Pomodoro"
            onClick={() => bindPomo(task.id)}
            whileHover={{ scale: 1.14, rotate: -8 }}
            whileTap={{ scale: 0.85 }}
          >
            <GcIcon name="tomato-timer" size={14} />
          </motion.button>
          <motion.button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg gc-btn"
            title="Micro-steps"
            aria-label="Toggle micro-steps drawer"
            onClick={() => setOpenSubtask(subOpen ? null : task.id)}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.85, rotate: 12 }}
            animate={{ rotate: subOpen ? 180 : 0 }}
          >
            <Puzzle className="h-3.5 w-3.5" style={{ color: subDone > 0 ? "var(--gc-success)" : "var(--gc-text2)" }} />
            {task.subtasks.length > 0 && <span className="ml-0.5 text-[0.55rem] font-bold">{subDone}/{task.subtasks.length}</span>}
          </motion.button>
          <motion.button
            type="button"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.62rem] font-extrabold uppercase"
            style={{
              background: task.priority === "normal" ? "var(--gc-surface-2)" : task.priority === "high" ? "var(--gc-warning-soft)" : "var(--gc-danger-soft)",
              color: PRI_META[task.priority].color,
            }}
            onClick={() => cyclePriority(catId, task.id)}
            title="Cycle priority"
            key={task.priority}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            whileHover={{ scale: 1.08 }}
          >
            <GcIcon name={PRI_META[task.priority].icon} size={10} />
            {PRI_META[task.priority].label}
          </motion.button>
          <div className="hidden flex-col sm:flex">
            <Button type="button" variant="ghost" size="icon" className="size-5 gc-btn disabled:opacity-30" disabled={index === 0} onClick={() => moveTask(catId, task.id, -1)} aria-label="Move task up">
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-5 gc-btn" onClick={() => moveTask(catId, task.id, 1)} aria-label="Move task down">
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          <motion.button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg gc-btn"
            title="Quick edit"
            aria-label="Quick edit task"
            onClick={() => setEditingTask({ catId, taskId: task.id })}
            whileHover={{ scale: 1.12, rotate: -8 }}
            whileTap={{ scale: 0.85 }}
          >
            <Pencil className="h-3 w-3" />
          </motion.button>
          <motion.button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg gc-btn"
            title="Advanced: priority, pomodoros & lock"
            aria-label="Advanced task edit"
            onClick={() => openTaskEditModal({ catId, taskId: task.id })}
            whileHover={{ scale: 1.12, rotate: 30 }}
            whileTap={{ scale: 0.85, rotate: 90 }}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </motion.button>
          <motion.button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg text-[var(--gc-danger)] gc-btn"
            title="Delete task"
            aria-label="Delete task"
            onClick={() => deleteTask(catId, task.id)}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.8 }}
          >
            <Trash2 className="h-3 w-3" />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {task.notes.trim() && (
          <motion.p
            key="notes"
            className="ml-[34px] flex items-start gap-1.5 rounded-lg px-2 py-1 text-xs"
            style={{ background: "var(--gc-surface-2)", color: "var(--gc-text2)" }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <GcIcon name="note-lines" size={12} className="mt-0.5" />
            <span>{task.notes}</span>
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {subOpen && (
          <motion.div
            key="subtasks"
            className="ml-[34px] flex flex-col gap-1.5 overflow-hidden rounded-xl border p-2.5"
            style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {task.subtasks.length === 0 && <p className="text-[0.7rem]" style={{ color: "var(--gc-muted)" }}>No micro-steps yet — add a, b, c below.</p>}
            <AnimatePresence initial={false}>
              {task.subtasks.map((sb) => (
                <motion.div
                  key={sb.id}
                  className="flex items-center gap-2"
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.22 }}
                >
                  <motion.button
                    type="button"
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 text-[0.6rem] font-black"
                    animate={sb.completed ? { background: "var(--gc-success)", borderColor: "rgba(0,0,0,0)", color: "#fff" } : { background: "rgba(0,0,0,0)", borderColor: "var(--gc-border-strong)" }}
                    onClick={() => toggleSubtask(task.id, sb.id)}
                    aria-pressed={sb.completed}
                    aria-label={`Toggle subtask ${sb.text}`}
                    whileTap={{ scale: 0.8 }}
                  >
                    {sb.completed ? "✓" : ""}
                  </motion.button>
                  <span className={`relative inline flex-1 text-xs ${sb.completed ? "" : ""}`} style={sb.completed ? { color: "var(--gc-muted)" } : undefined}>
                    {sb.text}
                    {sb.completed && (
                      <motion.span
                        className="strike-line"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    )}
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="size-5 text-[var(--gc-danger)] gc-btn" onClick={() => deleteSubtask(task.id, sb.id)} aria-label="Delete subtask">
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            <form className="mt-1 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const input = (e.currentTarget.elements.namedItem("sub") as HTMLInputElement); addSubtask(task.id, input.value); input.value = ""; }}>
              <Input name="sub" className="gc-input h-7 py-0.5 text-xs" placeholder="Add micro-step (a, b, c)…" aria-label="New micro-step" />
              <Button type="submit" size="sm" className="h-7 px-2 gc-btn-primary" aria-label="Add micro-step"><Plus className="h-3 w-3" /></Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function TaskInlineEdit({ catId, task, onSave, onCancel }: { catId: string; task: Task; onSave: (text: string, notes: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(task.text);
  const [notes, setNotes] = useState(task.notes || "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const seqNum = (() => {
    const s = useStore.getState();
    const g = s.goals.find((x) => x.id === s.activeGoalId);
    const c = g?.categories.find((x) => x.id === catId);
    return (c?.items.findIndex((x) => x.id === task.id) ?? -1) + 1;
  })();
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border p-2" style={{ borderColor: "var(--gc-accent)" }}>
      <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); onSave(text, notes); }}>
        <span className="shrink-0 font-mono text-xs" style={{ color: "var(--gc-muted)" }}>{seqNum}.</span>
        <Input ref={ref} value={text} onChange={(e) => setText(e.target.value)} className="gc-input h-8 py-1 text-sm" aria-label="Task text" />
        <Button type="submit" size="sm" className="h-8 gc-btn-primary"><GcIcon name="check-circle" size={13} /></Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gc-btn" onClick={onCancel}>✕</Button>
      </form>
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="gc-input h-7 py-0.5 text-xs" placeholder="Add optional task notes…" aria-label="Task notes" />
    </div>
  );
}

function RapidAddForm({ catId, nextIndex }: { catId: string; nextIndex: number }) {
  const addTask = useStore((s) => s.addTask);
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      className="flex items-center gap-2 border-t p-3"
      style={{ borderColor: "var(--gc-border)" }}
      onSubmit={(e) => { e.preventDefault(); if (!val.trim()) return; addTask(catId, val); setVal(""); ref.current?.focus(); }}
    >
      <motion.span
        className="flex h-8 items-center rounded-lg px-2 font-mono text-xs font-bold"
        style={{ background: "var(--gc-surface-2)", color: "var(--gc-text2)" }}
        key={nextIndex}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 480, damping: 20 }}
      >
        {nextIndex}.
      </motion.span>
      <Input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} className="gc-input flex-1" placeholder={`Add task #${nextIndex}…`} aria-label={`Add task number ${nextIndex}`} />
      <motion.button type="submit" className="flex h-9 items-center justify-center rounded-lg px-3 gc-btn-primary" aria-label="Add task" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
        <Plus className="h-4 w-4" />
      </motion.button>
    </form>
  );
}

/* v4 — Advance: due-date badge (overdue / today / this week) */
function DueBadge({ dueDate }: { dueDate: string }) {
  const status = dueStatus(dueDate);
  if (!status) return null;
  const meta = status === "overdue"
    ? { label: "Overdue", bg: "var(--gc-danger-soft)", fg: "var(--gc-danger)", icon: "zap-star" }
    : status === "today"
      ? { label: "Today", bg: "var(--gc-warning-soft)", fg: "var(--gc-warning)", icon: "clock-hand" }
      : status === "week"
        ? { label: "This week", bg: "var(--gc-soft)", fg: "var(--gc-accent)", icon: "calendar-tick" }
        : { label: dueDate.slice(5), bg: "var(--gc-surface-2)", fg: "var(--gc-text2)", icon: "calendar-tick" };
  return (
    <span
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.62rem] font-extrabold"
      style={{ background: meta.bg, color: meta.fg }}
      title={`Due ${dueDate}`}
    >
      <GcIcon name={meta.icon} size={11} /> {meta.label}
    </span>
  );
}
