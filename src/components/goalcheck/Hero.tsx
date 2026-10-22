"use client";

/* =========================================================
   Hero progress card + Quick add + Filter bar + View switcher
   Fluidity: spring progress bar, count-up stats, layoutId
   sliding pills on tabs, mono animated icons everywhere.
   ========================================================= */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, useActiveGoal, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { MediaBadge, AnimatedNumber } from "./atoms";
import { GcIcon } from "@/lib/goalcheck/icons";
import { calculateStats } from "@/lib/goalcheck/logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Check, RotateCcw, Trash2, Pencil, Search, LayoutGrid, Rows3, Plus } from "lucide-react";
import type { WorkspaceView, FilterId } from "@/lib/goalcheck/types";
import { hasFeature } from "@/lib/goalcheck/editions";

const springy = { type: "spring", stiffness: 320, damping: 24 } as const;

/* ---------------- Hero card ---------------- */

export function HeroCard() {
  const goal = useActiveGoal();
  const openMediaModal = useUi((s) => s.openMediaModal);
  const openBoardModal = useUi((s) => s.openBoardModal);
  const checkAll = useStore((s) => s.checkAll);
  const resetAll = useStore((s) => s.resetAll);
  const clearDone = useStore((s) => s.clearDone);
  const deleteBoard = useStore((s) => s.deleteBoard);
  const pomoCount = useStore((s) => s.goals);
  if (!goal) return null;
  const stats = calculateStats(goal);

  const pomos = (() => {
    let est = 0, done = 0;
    for (const g of pomoCount) {
      if (g.id !== goal.id) continue;
      for (const c of g.categories) for (const it of c.items) { est += it.pomosEstimate || 0; done += it.pomoCount || 0; }
    }
    return { est, done };
  })();

  return (
    <motion.section
      className="gc-panel gc-blur relative overflow-hidden rounded-3xl p-5 sm:p-6"
      aria-label="Board progress"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--gc-grad)" }} aria-hidden="true" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-[240px] flex-1 items-center gap-4">
          <motion.button
            type="button"
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 text-2xl"
            style={{ borderColor: "var(--gc-border-strong)", background: "var(--gc-surface-2)", boxShadow: "0 4px 14px var(--gc-glow)" }}
            onClick={() => openMediaModal({ type: "goal" })}
            title="Customize board icon"
            aria-label="Customize board icon"
            whileHover={{ scale: 1.07, rotate: -4 }}
            whileTap={{ scale: 0.93 }}
            transition={springy}
          >
            <MediaBadge value={goal.media} fallback="mono:target-radar" iconSize={28} />
          </motion.button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{goal.title}</h1>
              <Button type="button" variant="ghost" size="icon" className="size-7 gc-btn" onClick={() => openBoardModal("edit")} title="Edit board title" aria-label="Edit board title">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="truncate text-sm" style={{ color: "var(--gc-text2)" }}>{goal.subtitle || "Categorized checklist workflow."}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="gc-grad-text font-mono text-4xl font-black leading-none">
            <AnimatedNumber value={stats.percent} format={(n) => `${Math.round(n)}%`} />
          </span>
          <span className="mt-1 text-xs font-bold" style={{ color: "var(--gc-text2)" }}>
            <AnimatedNumber value={stats.completed} /> / {stats.total} completed
          </span>
        </div>
      </div>

      <div className="mt-5 h-[18px] overflow-hidden rounded-full border p-0.5" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }} role="progressbar" aria-label={`Goal progress: ${stats.percent}% complete`} aria-valuenow={stats.percent} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--gc-grad)", boxShadow: "0 0 14px var(--gc-glow)" }}
          initial={false}
          animate={{ width: `${stats.percent}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip icon="folder-open">{stats.catCount} Categories</Chip>
          <Chip icon="hourglass-flow" tone="pending">{stats.remaining} Remaining</Chip>
          <Chip icon="check-circle" tone="done">{stats.completed} Completed</Chip>
          <Chip icon="tomato-timer">{pomos.done} / {pomos.est} Pomodoros</Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gc-btn" onClick={checkAll}><Check className="h-3.5 w-3.5" /> Check All</Button>
          <Button type="button" variant="outline" size="sm" className="gc-btn" onClick={resetAll}><RotateCcw className="h-3.5 w-3.5" /> Reset All</Button>
          <Button type="button" variant="outline" size="sm" className="gc-btn" onClick={clearDone}>
            <GcIcon name="broom-sweep" size={14} /> Clear Done
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="size-8 border-[var(--gc-danger-soft)] text-[var(--gc-danger)] gc-btn" title="Delete this board" aria-label="Delete this board">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="gc-modal">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete board “{goal.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the board with all its categories, tasks and notes. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="gc-btn">Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-[var(--gc-danger)] text-white hover:bg-[var(--gc-danger)]/90" onClick={() => deleteBoard(goal.id)}>
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </motion.section>
  );
}

function Chip({ children, icon, tone }: { children: React.ReactNode; icon: string; tone?: "done" | "pending" }) {
  const style = tone === "done"
    ? { background: "var(--gc-success-soft)", color: "var(--gc-success)", borderColor: "var(--gc-success-soft)" }
    : tone === "pending"
      ? { background: "var(--gc-warning-soft)", color: "var(--gc-warning)", borderColor: "var(--gc-warning-soft)" }
      : { background: "var(--gc-surface-2)", color: "var(--gc-text2)", borderColor: "var(--gc-border)" };
  return (
    <motion.span
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[0.72rem] font-bold"
      style={style}
      whileHover={{ scale: 1.05, y: -1 }}
      transition={springy}
    >
      <GcIcon name={icon} size={13} />
      {children}
    </motion.span>
  );
}

/* ---------------- Quick add bar ---------------- */

export function QuickAddBar() {
  const addCategory = useStore((s) => s.addCategory);
  const quickCatMedia = useStore((s) => s.quickCatMedia);
  const openMediaModal = useUi((s) => s.openMediaModal);
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState("none");

  return (
    <motion.section
      className="gc-panel gc-blur flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed p-3.5 sm:px-5"
      style={{ borderColor: "var(--gc-border-strong)" }}
      aria-label="Add category"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ borderColor: "var(--gc-accent)" }}
    >
      <span className="flex items-center gap-2 text-sm font-bold"><GcIcon name="plus-round" size={17} /> Add Category Section</span>
      <form
        className="flex min-w-[260px] flex-1 items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); addCategory(title, quickCatMedia, recurrence); setTitle(""); }}
      >
        <motion.button
          type="button"
          className="flex h-10 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
          style={{ borderColor: "var(--gc-border-strong)", background: "var(--gc-input)" }}
          onClick={() => openMediaModal({ type: "quick" })}
          title="Choose category icon"
          aria-label="Choose category icon"
          whileHover={{ scale: 1.07, rotate: 4 }}
          whileTap={{ scale: 0.92 }}
          transition={springy}
        >
          <MediaBadge value={quickCatMedia} fallback="mono:laptop-code" iconSize={22} />
        </motion.button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="gc-input flex-1"
          placeholder="e.g. To do in laptop, Weekend study…"
          aria-label="New category name"
          required
        />
        <div className="w-[10.5rem] shrink-0">
          <Select value={recurrence} onValueChange={setRecurrence}>
            <SelectTrigger className="gc-input text-xs" aria-label="Category recurrence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">One-Time Category</SelectItem>
              <SelectItem value="daily"><span className="flex items-center gap-2"><GcIcon name="repeat-cycle" size={13} /> Daily Auto-Reset</span></SelectItem>
              <SelectItem value="weekly"><span className="flex items-center gap-2"><GcIcon name="calendar-tick" size={13} /> Weekly Auto-Reset</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="shrink-0 gc-btn-primary"><Plus className="h-4 w-4" /> Add</Button>
      </form>
    </motion.section>
  );
}

/* ---------------- View switcher + filter bar ---------------- */

const VIEWS: [WorkspaceView, string, string][] = [
  ["checklist", "Checklist", "clipboard-check"],
  ["kanban", "Kanban", "kanban-cols"],
  ["matrix", "Matrix", "compass-needle"],
  ["graph", "Mind Map", "network-nodes"],
  ["analytics", "Analytics", "chart-bars"],
];

/* edition-aware view list (base edition = checklist only) */
const VIEWS_AVAILABLE: [WorkspaceView, string, string][] = VIEWS.filter(
  ([id]) => id === "checklist" || hasFeature("views.advanced")
);

const FILTERS: [FilterId, string][] = [
  ["all", "All Items"],
  ["active", "Remaining"],
  ["completed", "Completed"],
  ["priority", "★ Priority"],
  ...(hasFeature("due-dates") ? [["week", "This Week"] as [FilterId, string]] : []),
];

export function FilterBar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const search = useStore((s) => s.searchQuery);
  const setSearch = useStore((s) => s.setSearch);
  const layout = useStore((s) => s.layoutMode);
  const setLayout = useStore((s) => s.setLayout);

  return (
    <>
      <motion.div
        className="gc-panel gc-blur flex flex-wrap items-center justify-between gap-3 rounded-2xl p-2.5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {VIEWS_AVAILABLE.length > 1 && (
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Workspace views">
            {VIEWS_AVAILABLE.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`relative rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 ${view === id ? "text-white" : ""}`}
              style={view === id ? undefined : { color: "var(--gc-text2)" }}
            >
              {view === id && (
                <motion.span layoutId="gcViewPill" className="tab-pill" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
              )}
              <span className="tab-label flex items-center gap-1.5">
                <GcIcon name={icon} size={14} />
                {label}
              </span>
            </button>
            ))}
          </div>
        )}
        <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--gc-muted)" }} aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="gc-input pl-9 text-xs"
            placeholder="Search tasks, notes, categories…"
            aria-label="Search tasks"
          />
        </div>
      </motion.div>

      <motion.div
        className="gc-panel gc-blur flex flex-wrap items-center justify-between gap-3 rounded-2xl p-2.5"
        aria-label="Task filters"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-wrap items-center gap-1 rounded-xl p-1" style={{ background: "var(--gc-surface-2)" }}>
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className="relative rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2"
              style={filter === id ? { color: "color-mix(in srgb, var(--gc-accent) 55%, var(--gc-text))" } : { color: "var(--gc-text2)" }}
            >
              {filter === id && (
                <motion.span layoutId="gcFilterPill" className="tab-pill-soft" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
              )}
              <span className="tab-label">{label}</span>
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 gc-btn"
          onClick={() => setLayout(layout === "grid" ? "single" : "grid")}
          title={layout === "grid" ? "Switch to single column" : "Switch to two columns"}
          aria-label="Toggle layout columns"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={layout}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.22 }}
              className="flex"
            >
              {layout === "grid" ? <Rows3 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </motion.div>
    </>
  );
}
