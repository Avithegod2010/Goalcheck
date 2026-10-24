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
import { ChevronDown, ChevronUp, GripVertical, Paperclip, Pencil, Trash2, Plus, Lock, Settings2, Puzzle, Crosshair, Play, Square, X } from "lucide-react";
import type { AttachmentMeta, Category, Task } from "@/lib/goalcheck/types";
import { dueStatus, inCurrentWeek, describeRecurrence } from "@/lib/goalcheck/logic";
import { hasFeature } from "@/lib/goalcheck/editions";
import { useT } from "@/lib/goalcheck/i18n";
import { notifyError, notifySuccess } from "@/lib/goalcheck/notify";
import { attachmentUrl, deleteAttachmentBlob, putAttachmentBlob } from "@/lib/goalcheck/attachments";
import { formatBytes, isImageMime, makeAttachment, validateFile, type AttachmentRejectToken } from "@/lib/goalcheck/attachment-ui";

const EASE = [0.22, 1, 0.36, 1] as const;

const DRAG_MIME = "text/gc-row";

interface RowDrag { catId: string; taskId: string; isCat?: boolean }

/** Read the row-drag payload; undefined when the drag isn't ours. */
function rowDragFrom(e: React.DragEvent): RowDrag | undefined {
  try {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    return raw ? (JSON.parse(raw) as RowDrag) : undefined;
  } catch {
    return undefined;
  }
}

/* ---------------- v5 — per-task attachments ---------------- */

/** Store patch type for setTaskAdvanced, derived from the store itself. */
type TaskPatch = Parameters<ReturnType<typeof useStore.getState>["setTaskAdvanced"]>[2];

/** setTaskAdvanced spreads its patch onto the task, but its declared patch
 *  type doesn't (yet) name the v5 attachments field — thread it through this
 *  cast, which stays valid whether or not the store type is widened later. */
function patchAttachments(attachments: AttachmentMeta[]): TaskPatch {
  return { attachments } as unknown as TaskPatch;
}

/** Fresh attachments array for a task, read straight from the store
 *  (render props can go stale inside sequential async loops). */
function currentAttachments(catId: string, taskId: string): AttachmentMeta[] {
  const s = useStore.getState();
  const goal = s.goals.find((g) => g.id === s.activeGoalId);
  return goal?.categories.find((c) => c.id === catId)?.items.find((it) => it.id === taskId)?.attachments ?? [];
}

/** validateFile reject token → catalog key (registered in gc-i18n-17-f). */
const ATT_TOKEN_KEY: Record<AttachmentRejectToken, string> = {
  tooLarge: "task.att.tooLarge",
  emptyName: "task.att.emptyName",
};

export function ChecklistGrid() {
  const goal = useActiveGoal();
  const layout = useStore((s) => s.layoutMode);
  const search = useStore((s) => s.searchQuery);
  const editingCategoryId = useStore((s) => s.editingCategoryId);
  const t = useT();

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
        aria-label={t("common.categories")}
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
            <h3 className="mb-1 text-lg font-extrabold">{search ? t("task.noCategoriesSearch") : t("task.noCategoriesEmpty")}</h3>
            <p className="text-sm" style={{ color: "var(--gc-text2)" }}>
              {search ? t("task.tryDifferentSearch") : t("task.quickAddHint")}
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
  const t = useT();
  const filter = useStore((s) => s.filter);
  const search = useStore((s) => s.searchQuery.trim().toLowerCase());
  const openSubtaskId = useStore((s) => s.openSubtaskId);
  const setEditingCategory = useStore((s) => s.setEditingCategory);
  const renameCategory = useStore((s) => s.renameCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const toggleAllCategory = useStore((s) => s.toggleAllCategory);
  const moveCategoryTo = useStore((s) => s.moveCategoryTo);
  const moveTaskToCategory = useStore((s) => s.moveTaskToCategory);
  const openMediaModal = useUi((s) => s.openMediaModal);
  const [catDrag, setCatDrag] = useState(false);
  const [rowOver, setRowOver] = useState(false);

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
      className={`gc-panel gc-blur flex flex-col overflow-hidden ${catDrag ? "opacity-50" : ""} ${rowOver ? "outline outline-2 -outline-offset-2" : ""}`}
      style={{ borderTop: "4px solid var(--gc-accent)", outlineColor: rowOver ? "var(--gc-accent)" : undefined }}
      aria-label={cat.title}
      whileHover={{ boxShadow: "0 14px 40px -8px var(--gc-glow)" }}
      /* v4.3 — tasks from other categories can be dropped onto the card */
      onDragOver={(e) => { if (rowDragFrom(e)) { e.preventDefault(); setRowOver(true); } }}
      onDragLeave={() => setRowOver(false)}
      onDrop={(e) => {
        const drag = rowDragFrom(e);
        setRowOver(false);
        if (!drag) return;
        e.preventDefault();
        if (drag.isCat) {
          /* category grip dropped on this card → move before it */
          moveCategoryTo(drag.catId, index);
          return;
        }
        if (drag.catId !== cat.id) moveTaskToCategory(drag.catId, drag.taskId, cat.id, Number.MAX_SAFE_INTEGER);
      }}
    >
      <header className="border-b p-4 pb-3" style={{ borderColor: "var(--gc-border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* v4.3 — drag handle: reorder categories (HTML5) */}
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ catId: cat.id, taskId: "", isCat: true }));
                e.dataTransfer.effectAllowed = "move";
                setCatDrag(true);
              }}
              onDragEnd={() => setCatDrag(false)}
              className="hidden cursor-grab text-[var(--gc-muted)] hover:text-[var(--gc-accent)] sm:block"
              title={t("task.dragCategories")}
              aria-hidden="true"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <motion.button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--gc-border-strong)", background: "var(--gc-surface-2)" }}
              onClick={() => openMediaModal({ type: "category", catId: cat.id })}
              title={t("task.customizeCategoryIcon")}
              aria-label={t("task.customizeCategoryIcon")}
              whileHover={{ scale: 1.08, rotate: -5 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 380, damping: 16 }}
            >
              <MediaBadge value={cat.media} fallback="mono:clipboard-check" iconSize={22} />
            </motion.button>
            <div className="min-w-0 flex-1">
              {editing ? (
                <CategoryRenameForm initial={cat.title} onSave={(name) => { renameCategory(cat.id, name); setEditingCategory(null); }} onCancel={() => setEditingCategory(null)} />
              ) : (
                <button
                  type="button"
                  className="block w-full truncate text-left text-base font-extrabold transition-colors hover:text-[var(--gc-accent)] focus-visible:outline-2"
                  onClick={() => setEditingCategory(cat.id)}
                  title={t("task.clickRenameCategory")}
                >
                  {cat.title}
                </button>
              )}
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.7rem]" style={{ color: "var(--gc-text2)" }}>
                {t("task.catProgress", { completed, total, percent: pct })}
                {cat.recurrence === "daily" && (
                  <span className="inline-flex items-center gap-1" style={{ color: "color-mix(in srgb, var(--gc-accent) 55%, var(--gc-text))" }}>
                    <GcIcon name="repeat-cycle" size={11} /> {t("task.daily")}
                  </span>
                )}
                {cat.recurrence === "weekly" && (
                  <span className="inline-flex items-center gap-1" style={{ color: "color-mix(in srgb, var(--gc-accent) 55%, var(--gc-text))" }}>
                    <GcIcon name="calendar-tick" size={11} /> {t("task.weekly")}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <motion.button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg gc-btn"
              title={allDone ? t("task.undoAll") : t("task.markAllDone")}
              aria-label={t("task.toggleAllDone")}
              onClick={() => toggleAllCategory(cat.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.88 }}
            >
              {allDone ? <GcIcon name="undo-ccw" size={15} /> : <GcIcon name="check-circle" size={15} />}
            </motion.button>
            <motion.button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg gc-btn"
              title={t("task.customizeIcon")}
              aria-label={t("task.customizeCategoryIcon")}
              onClick={() => openMediaModal({ type: "category", catId: cat.id })}
              whileHover={{ scale: 1.1, rotate: 6 }}
              whileTap={{ scale: 0.88 }}
            >
              <GcIcon name="image-pic" size={15} />
            </motion.button>
            <DeleteCatButton onDelete={() => deleteCategory(cat.id)} title={cat.title} />
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: "var(--gc-surface-2)" }} role="progressbar" aria-label={t("task.catProgressAria", { name: cat.title, percent: pct })} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--gc-grad)" }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 110, damping: 22 }}
          />
        </div>
      </header>

      <ul className="flex flex-col gap-1 p-2" aria-label={t("common.tasks")}>
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
              {total === 0 ? t("task.noTasksYet") : t("task.noTasksMatch")}
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
  const t = useT();
  const [val, setVal] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); onSave(val); }}>
      <Input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} className="gc-input h-8 py-1 text-sm" aria-label={t("task.categoryName")} />
      <Button type="submit" size="sm" className="h-8 gc-btn-primary"><GcIcon name="check-circle" size={13} /></Button>
      <Button type="button" size="sm" variant="outline" className="h-8 gc-btn" onClick={onCancel}>✕</Button>
    </form>
  );
}

function DeleteCatButton({ onDelete, title }: { onDelete: () => void; title: string }) {
  const t = useT();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <motion.button
        type="button"
        className="flex size-8 items-center justify-center rounded-lg text-[var(--gc-danger)] gc-btn"
        title={t("task.deleteCategory", { name: title })}
        aria-label={t("task.deleteCategory", { name: title })}
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
            aria-label={t("task.confirmDelete")}
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
              <h3 className="mb-1 text-base font-extrabold">{t("task.deleteCategoryConfirm", { name: title })}</h3>
              <p className="mb-4 text-sm" style={{ color: "var(--gc-text2)" }}>{t("task.deleteCategoryWarning")}</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="gc-btn" onClick={() => setConfirmOpen(false)}>{t("common.cancel")}</Button>
                <Button type="button" className="bg-[var(--gc-danger)] text-white hover:opacity-90 gc-btn" onClick={() => { onDelete(); setConfirmOpen(false); }}>{t("common.delete")}</Button>
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
  normal: { icon: "sliders-tune", color: "var(--gc-text2)" },
  high: { icon: "star-shine", color: "color-mix(in srgb, var(--gc-warning) 62%, var(--gc-text))" },
  urgent: { icon: "flame-ember", color: "color-mix(in srgb, var(--gc-danger) 62%, var(--gc-text))" },
} as const;

/* labels resolve through the catalog so locale switches re-render */
const PRI_LABEL_KEY = { normal: "task.priNormal", high: "task.priHigh", urgent: "task.priUrgent" } as const;

function TaskRow({ catId, task, seq, index, subOpen }: { catId: string; task: Task; seq: number; index: number; subOpen: boolean }) {
  const t = useT();
  const toggleTask = useStore((s) => s.toggleTask);
  const cyclePriority = useStore((s) => s.cyclePriority);
  const moveTask = useStore((s) => s.moveTask);
  const moveTaskTo = useStore((s) => s.moveTaskTo);
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
  const openDeepFocus = useUi((s) => s.openDeepFocus);
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const setTaskAdvanced = useStore((s) => s.setTaskAdvanced);
  const [dropEdge, setDropEdge] = useState<"" | "above" | "below">("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRich = hasFeature("media-rich");

  const isEditing = editingTaskId === `${catId}::${task.id}`;
  const prereq = task.dependsOn
    ? goals.find((g) => g.id === activeGoalId)?.categories.flatMap((c) => c.items).find((pr) => pr.id === task.dependsOn)
    : null;
  const locked = !!(prereq && !prereq.completed && !task.completed);
  const subDone = task.subtasks.filter((s) => s.completed).length;

  /* v5 — attachments: pick files → validate → store blob → append meta.
     Files are processed strictly sequentially (each await settles before
     the next starts) so blob writes and store patches never interleave. */
  const onFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; /* allow re-picking the same file later */
    if (files.length === 0) return;
    for (const file of files) {
      const token = validateFile(file);
      if (token) {
        notifyError(t(ATT_TOKEN_KEY[token], { name: file.name }));
        continue;
      }
      try {
        const { meta, blob } = await makeAttachment(file);
        await putAttachmentBlob(meta.id, blob);
        setTaskAdvanced(catId, task.id, patchAttachments([...currentAttachments(catId, task.id), meta]));
        notifySuccess(t("task.att.added", { name: meta.name }));
      } catch {
        notifyError(t("task.att.failed", { name: file.name }));
      }
    }
  };

  const removeAttachment = async (meta: AttachmentMeta) => {
    try {
      await deleteAttachmentBlob(meta.id);
    } catch {
      /* blob already gone — still drop the meta */
    }
    setTaskAdvanced(catId, task.id, patchAttachments(currentAttachments(catId, task.id).filter((a) => a.id !== meta.id)));
    notifySuccess(t("task.att.removed", { name: meta.name }));
  };

  if (isEditing) {
    return (
      <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <TaskInlineEdit catId={catId} task={task} onSave={(text, notes) => saveInlineEdit(catId, task.id, text, notes)} onCancel={() => setEditingTask(null)} />
      </motion.li>
    );
  }

  return (
    /* plain <li> owns the HTML5 drag handlers — framer-motion components
       intercept onDragStart/onDragEnd for their own gesture system */
    <li
      className="list-none"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ catId, taskId: task.id }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setDropEdge("")}
      onDragOver={(e) => {
        const drag = rowDragFrom(e);
        if (!drag || drag.isCat) return;
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDropEdge(e.clientY - rect.top < rect.height / 2 ? "above" : "below");
      }}
      onDragLeave={() => setDropEdge("")}
      onDrop={(e) => {
        const drag = rowDragFrom(e);
        setDropEdge("");
        if (!drag || drag.isCat) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const above = e.clientY - rect.top < rect.height / 2;
        const myIdx = ((): number => {
          const goal = goals.find((g) => g.id === activeGoalId);
          const c = goal?.categories.find((cc) => cc.id === catId);
          return c?.items.findIndex((it) => it.id === task.id) ?? 0;
        })();
        if (drag.catId === catId) {
          moveTaskTo(catId, drag.taskId, above ? myIdx : myIdx + 1);
        } else {
          /* cross-category: insert before/after this row */
          useStore.getState().moveTaskToCategory(drag.catId, drag.taskId, catId, above ? myIdx : myIdx + 1);
        }
      }}
    >
      <motion.div
        layout
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 18, scale: 0.96, transition: { duration: 0.2 } }}
        transition={{ duration: 0.32, delay: Math.min(index * 0.03, 0.2), ease: EASE }}
        className={`flex cursor-grab flex-col gap-1 rounded-xl border border-transparent p-2 transition-colors hover:border-[var(--gc-border)] hover:bg-[var(--gc-surface-2)] ${task.completed ? "opacity-70" : ""} ${dropEdge === "above" ? "border-t-2 !border-t-[var(--gc-accent)]" : dropEdge === "below" ? "border-b-2 !border-b-[var(--gc-accent)]" : ""}`}
      >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        {/* left: toggle + label (grows, wraps below controls on narrow cards) */}
        <button
          type="button"
          className="flex min-w-[160px] flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-2"
          onClick={() => { if (!locked) toggleTask(catId, task.id); }}
          disabled={locked}
          aria-pressed={task.completed}
          title={locked ? t("task.lockedUntil", { name: prereq?.text ?? "" }) : task.completed ? t("task.markNotDone") : t("task.markDone")}
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
              {locked && <Lock className="mr-1 inline h-3.5 w-3.5" aria-label={t("task.locked")} />}
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
            <span className="flex items-center rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold" style={{ background: "var(--gc-soft)", color: "color-mix(in srgb, var(--gc-accent) 55%, var(--gc-text))" }} title={t("task.repeats", { name: describeRecurrence(task.recurrence) })}>
              <GcIcon name="repeat-cycle" size={11} /> {task.recurrence === "weekdays" ? t("task.weekdays") : task.recurrence.startsWith("every:") ? task.recurrence.replace("every:", "×") + "d" : task.recurrence.startsWith("monthly:") ? t("task.monthly") : task.recurrence}
            </span>
          )}
          {!!task.pomosEstimate && (
            <span className="hidden items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[0.62rem] font-bold sm:flex" style={{ background: "var(--gc-surface-2)", color: "var(--gc-text2)" }} title={t("task.pomodoroProgress")}>
              <GcIcon name="tomato-timer" size={11} /> {task.pomoCount}/{task.pomosEstimate}
            </span>
          )}
          {hasFeature("zen") && <TimerButton catId={catId} taskId={task.id} />}
          {hasFeature("zen") && (
            <motion.button
              type="button"
              className="flex size-7 items-center justify-center rounded-lg gc-btn"
              title={t("task.deepFocusHint")}
              aria-label={t("task.deepFocusOn", { name: task.text })}
              onClick={() => openDeepFocus({ catId, taskId: task.id })}
              whileHover={{ scale: 1.14, rotate: 12 }}
              whileTap={{ scale: 0.85 }}
            >
              <Crosshair className="h-3.5 w-3.5" />
            </motion.button>
          )}
          <motion.button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg gc-btn"
            title={t("task.bindPomodoro")}
            aria-label={t("task.bindPomodoro")}
            onClick={() => bindPomo(task.id)}
            whileHover={{ scale: 1.14, rotate: -8 }}
            whileTap={{ scale: 0.85 }}
          >
            <GcIcon name="tomato-timer" size={14} />
          </motion.button>
          <motion.button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg gc-btn"
            title={t("common.subtasks")}
            aria-label={t("task.toggleSubtasks")}
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
            title={t("task.cyclePriority")}
            key={task.priority}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            whileHover={{ scale: 1.08 }}
          >
            <GcIcon name={PRI_META[task.priority].icon} size={10} />
            {t(PRI_LABEL_KEY[task.priority])}
          </motion.button>
          <div className="hidden flex-col sm:flex">
            <Button type="button" variant="ghost" size="icon" className="size-5 gc-btn disabled:opacity-30" disabled={index === 0} onClick={() => moveTask(catId, task.id, -1)} aria-label={t("task.moveUp")}>
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-5 gc-btn" onClick={() => moveTask(catId, task.id, 1)} aria-label={t("task.moveDown")}>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          {mediaRich && (
            <motion.button
              type="button"
              className="flex size-7 items-center justify-center rounded-lg gc-btn"
              title={t("task.att.add")}
              aria-label={t("task.att.add")}
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.12, rotate: 8 }}
              whileTap={{ scale: 0.85 }}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </motion.button>
          )}
          <motion.button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg gc-btn"
            title={t("task.quickEdit")}
            aria-label={t("task.quickEditTask")}
            onClick={() => setEditingTask({ catId, taskId: task.id })}
            whileHover={{ scale: 1.12, rotate: -8 }}
            whileTap={{ scale: 0.85 }}
          >
            <Pencil className="h-3 w-3" />
          </motion.button>
          <motion.button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg gc-btn"
            title={t("task.advancedEdit")}
            aria-label={t("task.advancedEditTask")}
            onClick={() => openTaskEditModal({ catId, taskId: task.id })}
            whileHover={{ scale: 1.12, rotate: 30 }}
            whileTap={{ scale: 0.85, rotate: 90 }}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </motion.button>
          <motion.button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg text-[var(--gc-danger)] gc-btn"
            title={t("task.deleteTask")}
            aria-label={t("task.deleteTask")}
            onClick={() => deleteTask(catId, task.id)}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.8 }}
          >
            <Trash2 className="h-3 w-3" />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {mediaRich && task.attachments.length > 0 && (
          <motion.div
            key="attachments"
            className="ml-[34px] flex flex-wrap gap-1.5 overflow-hidden"
            role="list"
            aria-label={t("task.att.label")}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            {task.attachments.map((meta) => (
              <AttachmentChip key={meta.id} meta={meta} onRemove={removeAttachment} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {mediaRich && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={onFilesPicked}
        />
      )}

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
            {task.subtasks.length === 0 && <p className="text-[0.7rem]" style={{ color: "var(--gc-muted)" }}>{t("task.noSubtasksYet")}</p>}
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
                    aria-label={t("task.toggleSubtask", { name: sb.text })}
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
                  <Button type="button" variant="ghost" size="icon" className="size-5 text-[var(--gc-danger)] gc-btn" onClick={() => deleteSubtask(task.id, sb.id)} aria-label={t("task.deleteSubtask")}>
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            <form className="mt-1 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const input = (e.currentTarget.elements.namedItem("sub") as HTMLInputElement); addSubtask(task.id, input.value); input.value = ""; }}>
              <Input name="sub" className="gc-input h-7 py-0.5 text-xs" placeholder={t("task.addMicroStep")} aria-label={t("task.newMicroStep")} />
              <Button type="submit" size="sm" className="h-7 px-2 gc-btn-primary" aria-label={t("task.addMicroStepAria")}><Plus className="h-3 w-3" /></Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </li>
  );
}

/* ---------------- v5 — attachment chip ---------------- */

function AttachmentChip({ meta, onRemove }: { meta: AttachmentMeta; onRemove: (meta: AttachmentMeta) => void }) {
  const t = useT();
  const isImage = isImageMime(meta.mime);
  const [url, setUrl] = useState<string | null>(null);

  /* lazy thumbnail: load a blob URL ONLY for image chips; the URL is ours,
     so it must be revoked when the chip unmounts (or the load raced it) */
  useEffect(() => {
    if (!isImage) return;
    let alive = true;
    let made: string | null = null;
    attachmentUrl(meta.id)
      .then((u) => {
        if (!alive) {
          if (u) URL.revokeObjectURL(u);
          return;
        }
        made = u;
        setUrl(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [isImage, meta.id]);

  const open = () => {
    /* an already-loaded image URL opens synchronously (popup-blocker safe);
       everything else resolves its blob URL on demand */
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    void attachmentUrl(meta.id).then((u) => {
      if (u) window.open(u, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <div
      role="listitem"
      className="flex max-w-full items-stretch overflow-hidden rounded-lg border text-xs"
      style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}
    >
      <button
        type="button"
        className="flex min-w-0 items-center gap-1.5 py-1 pl-1.5 pr-1 focus-visible:outline-2"
        title={meta.name}
        aria-label={t("task.att.open", { name: meta.name })}
        onClick={open}
      >
        {isImage ? (
          url ? (
            <img src={url} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded object-cover" />
          ) : (
            <span aria-hidden="true" className="h-7 w-7 shrink-0 animate-pulse rounded" style={{ background: "var(--gc-border)" }} />
          )
        ) : (
          <GcIcon name="doc-lines" size={14} className="shrink-0" />
        )}
        <span className="max-w-[9rem] truncate font-semibold">{meta.name}</span>
        <span className="shrink-0 font-mono text-[0.6rem]" style={{ color: "var(--gc-muted)" }}>{formatBytes(meta.size)}</span>
      </button>
      <button
        type="button"
        className="flex shrink-0 items-center px-1.5 transition-colors hover:bg-[var(--gc-danger-soft)] focus-visible:outline-2"
        aria-label={t("task.att.remove", { name: meta.name })}
        onClick={() => onRemove(meta)}
      >
        <X className="h-3 w-3 text-[var(--gc-danger)]" />
      </button>
    </div>
  );
}

function TaskInlineEdit({ catId, task, onSave, onCancel }: { catId: string; task: Task; onSave: (text: string, notes: string) => void; onCancel: () => void }) {
  const t = useT();
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
        <Input ref={ref} value={text} onChange={(e) => setText(e.target.value)} className="gc-input h-8 py-1 text-sm" aria-label={t("task.taskText")} />
        <Button type="submit" size="sm" className="h-8 gc-btn-primary"><GcIcon name="check-circle" size={13} /></Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gc-btn" onClick={onCancel}>✕</Button>
      </form>
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="gc-input h-7 py-0.5 text-xs" placeholder={t("task.addNotesPlaceholder")} aria-label={t("task.taskNotes")} />
    </div>
  );
}

function RapidAddForm({ catId, nextIndex }: { catId: string; nextIndex: number }) {
  const t = useT();
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
      <Input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} className="gc-input flex-1" placeholder={t("task.addTaskNum", { count: nextIndex })} aria-label={t("task.addTaskNumber", { count: nextIndex })} />
      <motion.button type="submit" className="flex h-9 items-center justify-center rounded-lg px-3 gc-btn-primary" aria-label={t("task.addTask")} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
        <Plus className="h-4 w-4" />
      </motion.button>
    </form>
  );
}

/* v4 — Advance: due-date badge (overdue / today / this week) */
/* ---------------- v4.3 — per-task stopwatch button ---------------- */

function fmtClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

function TimerButton({ catId, taskId }: { catId: string; taskId: string }) {
  const t = useT();
  const activeTimer = useStore((s) => s.activeTimer);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const task = useStore((s) => {
    const goal = s.goals.find((g) => g.id === s.activeGoalId);
    return goal?.categories.find((c) => c.id === catId)?.items.find((it) => it.id === taskId);
  });
  const [now, setNow] = useState(Date.now());

  const isActive = activeTimer?.catId === catId && activeTimer?.taskId === taskId;
  const anyActive = !!activeTimer;

  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [isActive]);

  const live = isActive && activeTimer ? Math.round((now - activeTimer.startedAt) / 1000) : 0;
  const banked = task?.timeSpent ?? 0;
  const label = fmtClock(live + (banked > 0 && !isActive ? banked : 0));

  return (
    <motion.button
      type="button"
      className={`flex h-7 items-center gap-1 rounded-lg px-1.5 font-mono text-[0.62rem] font-extrabold ${isActive ? "" : "gc-btn"}`}
      style={isActive
        ? { background: "var(--gc-danger)", color: "#fff" }
        : { color: anyActive ? "var(--gc-muted)" : undefined }}
      title={isActive ? t("task.stopTimeTracking") : anyActive ? t("task.switchTimeTracking") : t("task.trackTime")}
      aria-label={isActive ? t("task.stopTrackingAria", { name: label }) : t("task.trackTimeAria", { name: label })}
      onClick={() => (isActive ? stopTimer() : startTimer(catId, taskId))}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      animate={isActive ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={isActive ? { duration: 1.6, repeat: Infinity } : { duration: 0.2 }}
    >
      {isActive ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      {banked > 0 || isActive ? label : ""}
    </motion.button>
  );
}

function DueBadge({ dueDate }: { dueDate: string }) {
  const t = useT();
  const status = dueStatus(dueDate);
  if (!status) return null;
  const meta = status === "overdue"
    ? { label: t("task.overdue"), bg: "var(--gc-danger-soft)", fg: "color-mix(in srgb, var(--gc-danger) 62%, var(--gc-text))", icon: "zap-star" }
    : status === "today"
      ? { label: t("task.today"), bg: "var(--gc-warning-soft)", fg: "color-mix(in srgb, var(--gc-warning) 62%, var(--gc-text))", icon: "clock-hand" }
      : status === "week"
        ? { label: t("task.thisWeek"), bg: "var(--gc-soft)", fg: "color-mix(in srgb, var(--gc-accent) 55%, var(--gc-text))", icon: "calendar-tick" }
        : { label: dueDate.slice(5), bg: "var(--gc-surface-2)", fg: "var(--gc-text2)", icon: "calendar-tick" };
  return (
    <span
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.62rem] font-extrabold"
      style={{ background: meta.bg, color: meta.fg }}
      title={t("task.due", { name: dueDate })}
    >
      <GcIcon name={meta.icon} size={11} /> {meta.label}
    </span>
  );
}
