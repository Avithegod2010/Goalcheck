"use client";

/* =========================================================
   Workspace views: Kanban (drag & drop), Eisenhower Matrix,
   Mind Map (canvas physics), Analytics, 365-day Heatmap.
   Fluidity: staggered quadrants, animated chart bars, heatmap
   cascade, layout-animated kanban cards, count-up KPIs.
   ========================================================= */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, useActiveGoal } from "@/lib/goalcheck/goalcheck-exports";
import { Panel, PanelTitle, MediaBadge, AnimatedNumber } from "./atoms";
import { GcIcon } from "@/lib/goalcheck/icons";
import { Button } from "@/components/ui/button";
import { calculateStats, computeStreaks, hourLabel, localDateKey } from "@/lib/goalcheck/logic";
import { useT } from "@/lib/goalcheck/i18n";
import type { Task } from "@/lib/goalcheck/types";
import { Lock, RefreshCw } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ============ KANBAN ============ */

const COLS: { id: "todo" | "doing" | "done"; titleKey: string; icon: string }[] = [
  { id: "todo", titleKey: "common.todo", icon: "hourglass-flow" },
  { id: "doing", titleKey: "common.doing", icon: "tools-wrench" },
  { id: "done", titleKey: "common.done", icon: "check-circle" },
];

export function KanbanView() {
  const goal = useActiveGoal();
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const moveTaskTo = useStore((s) => s.moveTaskTo);
  const search = useStore((s) => s.searchQuery.trim().toLowerCase());
  const t = useT();
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  if (!goal) return null;

  const allTasks: { cat: string; task: Task }[] = goal.categories.flatMap((c) =>
    c.items.map((it) => ({ cat: c.title.replace(/[-:]$/, "").trim(), task: it }))
  ).filter(({ task, cat }) => {
    if (!search) return true;
    return `${task.text} ${cat} ${task.notes}`.toLowerCase().includes(search);
  });

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const overId = String(e.over?.id ?? "");
    /* v4.3 — dropped onto a CARD: reorder within the column (or hop
       columns and land next to the target card) */
    if (overId.startsWith("card:")) {
      const targetId = overId.slice(5);
      const activeId = String(e.active.id);
      if (targetId === activeId) return;
      const st = useStore.getState();
      const g = st.goals.find((x) => x.id === st.activeGoalId);
      if (!g) return;
      const catOf = (tid: string) => g.categories.find((c) => c.items.some((i) => i.id === tid));
      const aCat = catOf(activeId);
      const tCat = catOf(targetId);
      if (!aCat || !tCat) return;
      const tIdx = Math.max(0, tCat.items.findIndex((i) => i.id === targetId));
      if (aCat.id !== tCat.id) {
        const targetStatus = effectiveStatus(tCat.items[tIdx]);
        setTaskStatus(activeId, targetStatus);
        st.moveTaskToCategory(aCat.id, activeId, tCat.id, tIdx);
      } else {
        moveTaskTo(aCat.id, activeId, tIdx);
      }
      return;
    }
    const col = e.over?.id as string | undefined;
    if (col && COLS.some((c) => c.id === col)) setTaskStatus(String(e.active.id), col as "todo" | "doing" | "done");
  };

  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onDragEnd}>
      <div className="grid gap-4 lg:grid-cols-3" aria-label={t("views.kanbanBoard")}>
        {COLS.map((col, ci) => (
          <motion.div
            key={col.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: ci * 0.08, ease: EASE }}
          >
            <KanbanCol col={col} tasks={allTasks.filter((t) => effectiveStatus(t.task) === col.id)} />
          </motion.div>
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22,1,0.36,1)" }}>
        {dragId ? (
          <motion.div
            className="gc-panel gc-blur cursor-grabbing p-3 text-sm font-bold"
            style={{ borderTop: "3px solid var(--gc-accent)" }}
            initial={{ rotate: 0, scale: 1 }}
            animate={{ rotate: 2.5, scale: 1.04 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
          >
            {allTasks.find((t) => t.task.id === dragId)?.task.text}
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function effectiveStatus(it: Task): "todo" | "doing" | "done" {
  return it.status || (it.completed ? "done" : "todo");
}

function KanbanCol({ col, tasks }: { col: { id: string; titleKey: string; icon: string }; tasks: { cat: string; task: Task }[] }) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const flat = goals.find((g) => g.id === activeGoalId)?.categories.flatMap((c) => c.items) ?? [];
  const prereqOf = (t: Task) => (t.dependsOn ? flat.find((x) => x.id === t.dependsOn) : null);

  return (
    <motion.div
      ref={setNodeRef}
      className="gc-panel gc-blur min-h-[220px] p-3"
      animate={isOver ? { borderColor: "var(--gc-accent)", backgroundColor: "var(--gc-soft)", scale: 1.008 } : { scale: 1 }}
      transition={{ duration: 0.2 }}
      aria-label={t(col.titleKey)}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-sm font-extrabold">
          <GcIcon name={col.icon} size={15} /> {t(col.titleKey)}
        </span>
        <motion.span
          key={tasks.length}
          className="rounded-full px-2 py-0.5 font-mono text-[0.68rem] font-bold"
          style={{ background: "var(--gc-surface-2)", color: "var(--gc-text2)" }}
          initial={{ scale: 1.25 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
        >
          {tasks.length}
        </motion.span>
      </div>
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {tasks.length === 0 && (
            <motion.p
              key="empty"
              className="py-8 text-center text-xs"
              style={{ color: "var(--gc-muted)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {t("views.dropCards")}
            </motion.p>
          )}
          {tasks.map(({ cat, task }) => (
            <KanbanCard key={task.id} cat={cat} task={task} locked={!!(prereqOf(task) && !prereqOf(task)!.completed)} />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function KanbanCard({ cat, task, locked }: { cat: string; task: Task; locked: boolean }) {
  const t = useT();
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  /* v4.3 — each card is also a drop target so cards can be ordered
     within (and across) columns */
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `card:${task.id}` });
  return (
    <motion.div
      ref={(node) => { setNodeRef(node); setDropRef(node); }}
      {...listeners}
      {...attributes}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
      transition={{ duration: 0.3, ease: EASE }}
      whileHover={{ y: -2 }}
      className={`gc-panel cursor-grab touch-none select-none p-3 active:cursor-grabbing ${isOver && !isDragging ? "outline outline-2 -outline-offset-2" : ""}`}
      style={{
        borderTop: `3px solid ${task.priority === "urgent" ? "var(--gc-danger)" : task.priority === "high" ? "var(--gc-warning)" : "var(--gc-border-strong)"}`,
        outlineColor: isOver ? "var(--gc-accent)" : undefined,
      }}
    >
      <p className="break-words text-[0.82rem] font-bold">
        {locked && <Lock className="mr-1 inline h-3 w-3" />}
        {task.text}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold" style={{ background: "var(--gc-surface-2)", color: "var(--gc-text2)" }}>
          <GcIcon name="folder-open" size={10} /> {cat}
        </span>
        {!!task.pomosEstimate && (
          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold" style={{ background: "var(--gc-surface-2)", color: "var(--gc-text2)" }}>
            <GcIcon name="tomato-timer" size={10} /> {task.pomoCount}/{task.pomosEstimate}
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-1.5">
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[0.65rem] gc-btn" onClick={() => setTaskStatus(task.id, task.completed ? "todo" : "done")}>
          {task.completed ? t("views.cardUndo") : t("views.cardDone")}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[0.65rem] gc-btn" onClick={() => setTaskStatus(task.id, task.status === "doing" ? "todo" : "doing")}>
          {task.status === "doing" ? t("views.cardBack") : t("views.cardDoing")}
        </Button>
      </div>
    </motion.div>
  );
}

/* ============ EISENHOWER MATRIX ============ */

export function MatrixView() {
  const goal = useActiveGoal();
  const toggleTask = useStore((s) => s.toggleTask);
  const t = useT();
  if (!goal) return null;

  const q: Record<"q1" | "q2" | "q3" | "q4", { catId: string; task: Task }[]> = { q1: [], q2: [], q3: [], q4: [] };
  for (const c of goal.categories) {
    for (const it of c.items) {
      const entry = { catId: c.id, task: it };
      if (it.completed) q.q4.push(entry);
      else if (it.priority === "urgent") q.q1.push(entry);
      else if (it.priority === "high") q.q2.push(entry);
      else q.q3.push(entry);
    }
  }

  const quad = (title: string, icon: string, sub: string, arr: typeof q.q1, color: string, qi: number) => (
    <motion.div
      className="gc-panel gc-blur min-h-[180px] p-3.5"
      style={{ borderTop: `4px solid ${color}` }}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: qi * 0.08, ease: EASE }}
      whileHover={{ y: -3 }}
    >
      <div className="mb-2 flex items-start gap-2">
        <span style={{ color }}><GcIcon name={icon} size={17} /></span>
        <div>
          <p className="text-sm font-extrabold">{title}</p>
          <p className="text-[0.68rem]" style={{ color: "var(--gc-text2)" }}>{sub}</p>
        </div>
      </div>
      {arr.length === 0 && <p className="py-4 text-center text-xs" style={{ color: "var(--gc-muted)" }}>{t("common.empty")}</p>}
      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {arr.map(({ catId, task }) => (
            <motion.button
              key={task.id}
              type="button"
              layout
              className="flex items-center gap-2 rounded-xl border border-transparent p-2 text-left hover:border-[var(--gc-border)] focus-visible:outline-2"
              onClick={() => toggleTask(catId, task.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              whileHover={{ x: 3, backgroundColor: "var(--gc-surface-2)" }}
              whileTap={{ scale: 0.97 }}
            >
              <motion.span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[0.6rem] font-black"
                animate={task.completed
                  ? { background: "var(--gc-success)", borderColor: "rgba(0,0,0,0)", color: "#fff", scale: [1, 1.25, 1] }
                  : { background: "rgba(0,0,0,0)", borderColor: "var(--gc-border-strong)", color: "inherit", scale: 1 }}
                transition={{ duration: 0.35 }}
              >
                {task.completed ? "✓" : ""}
              </motion.span>
              <span className="relative inline min-w-0 flex-1 truncate text-xs font-semibold">
                {task.text}
                {task.completed && (
                  <motion.span
                    className="strike-line"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2" aria-label={t("views.matrixAria")}>
      {quad(t("views.matrixQ1"), "flame-ember", t("views.matrixQ1Sub"), q.q1, "var(--gc-danger)", 0)}
      {quad(t("views.matrixQ2"), "target-radar", t("views.matrixQ2Sub"), q.q2, "var(--gc-warning)", 1)}
      {quad(t("views.matrixQ3"), "calendar-tick", t("views.matrixQ3Sub"), q.q3, "var(--gc-accent)", 2)}
      {quad(t("views.matrixQ4"), "check-circle", t("views.matrixQ4Sub"), q.q4, "var(--gc-success)", 3)}
    </div>
  );
}

/* ============ MIND MAP (canvas physics) ============ */

interface MindNode { id: string; type: "board" | "cat" | "task"; label: string; refId: string | null; x: number; y: number; vx: number; vy: number; completed: boolean; }

export function MindMapView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const goal = useActiveGoal();
  const toggleTask = useStore((s) => s.toggleTask);
  const bindPomo = useStore((s) => s.bindPomo);
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const nodesRef = useRef<MindNode[]>([]);
  const t = useT();
  const mouseRef = useRef<{ down: boolean; dragging: MindNode | null; moved: boolean; lx: number; ly: number }>({ down: false, dragging: null, moved: false, lx: 0, ly: 0 });

  /* build/refresh nodes when data changes */
  useEffect(() => {
    if (!goal) return;
    const prev = nodesRef.current;
    const find = (id: string) => prev.find((n) => n.id === id);
    const W = canvasRef.current?.clientWidth || 900;
    const H = canvasRef.current?.clientHeight || 560;
    const nodes: MindNode[] = [{
      id: "__board", type: "board", label: goal.title, refId: null,
      x: find("__board")?.x ?? W / 2, y: find("__board")?.y ?? H / 2, vx: 0, vy: 0, completed: false,
    }];
    goal.categories.forEach((cat, ci) => {
      const ang = (ci / Math.max(1, goal.categories.length)) * Math.PI * 2 - Math.PI / 2;
      const cn = find(`__cat_${cat.id}`);
      nodes.push({
        id: `__cat_${cat.id}`, type: "cat", label: cat.title.replace(/[-:]$/, "").trim(), refId: cat.id,
        x: cn?.x ?? W / 2 + Math.cos(ang) * W * 0.28, y: cn?.y ?? H / 2 + Math.sin(ang) * H * 0.3, vx: 0, vy: 0, completed: false,
      });
      const spread = (ii: number) => ((ii + 1) / (cat.items.length + 1)) - 0.5;
      cat.items.forEach((it, ii) => {
        const tn = find(it.id);
        nodes.push({
          id: it.id, type: "task", label: it.text, refId: cat.id, completed: it.completed,
          x: tn?.x ?? W / 2 + Math.cos(ang + spread(ii)) * W * 0.42,
          y: tn?.y ?? H / 2 + Math.sin(ang + spread(ii)) * H * 0.44, vx: 0, vy: 0,
        });
      });
    });
    nodesRef.current = nodes;
  }, [goal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const findNode = (id: string) => nodesRef.current.find((n) => n.id === id);

    const frame = () => {
      if (!running) return;
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const nodes = nodesRef.current;

      for (const n of nodes) {
        if (mouseRef.current.dragging === n) continue;
        const anchor = n.type === "cat" ? findNode("__board") : n.type === "task" ? findNode(`__cat_${n.refId}`) : null;
        const rest = n.type === "cat" ? Math.min(W, H) * 0.3 : 105;
        if (anchor) {
          const dx = anchor.x - n.x, dy = anchor.y - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = (dist - rest) * 0.004;
          n.vx += (dx / dist) * f;
          n.vy += (dy / dist) * f;
        }
        for (const o of nodes) {
          if (o === n) continue;
          const rx = n.x - o.x, ry = n.y - o.y;
          const rd2 = rx * rx + ry * ry;
          if (rd2 < 3800 && rd2 > 0.01) {
            const rd = Math.sqrt(rd2);
            const push = ((3800 - rd2) / 3800) * 0.35;
            n.vx += (rx / rd) * push;
            n.vy += (ry / rd) * push;
          }
        }
        n.vx *= 0.86; n.vy *= 0.86;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(46, Math.min(W - 46, n.x));
        n.y = Math.max(30, Math.min(H - 30, n.y));
      }

      ctx.clearRect(0, 0, W, H);
      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue("--gc-accent").trim() || "#6366f1";
      const textMain = styles.getPropertyValue("--gc-text").trim() || "#fff";

      ctx.lineWidth = 1.6;
      for (const n of nodes) {
        if (n.type === "board") continue;
        const parent = n.type === "cat" ? findNode("__board") : findNode(`__cat_${n.refId}`);
        if (!parent) continue;
        ctx.beginPath();
        ctx.moveTo(parent.x, parent.y);
        ctx.lineTo(n.x, n.y);
        ctx.strokeStyle = n.type === "cat" ? accent : "rgba(148, 163, 184, 0.35)";
        ctx.stroke();
      }
      for (const n of nodes) {
        const r = n.type === "board" ? 42 : n.type === "cat" ? 32 : 24;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.type === "task" && n.completed ? "rgba(16, 185, 129, 0.22)" : n.type === "board" ? accent : "rgba(100, 116, 139, 0.2)";
        ctx.fill();
        ctx.lineWidth = n === mouseRef.current.dragging ? 3 : 1.6;
        ctx.strokeStyle = n.type === "task" && n.completed ? "#10b981" : accent;
        ctx.stroke();
        ctx.fillStyle = textMain;
        ctx.font = `${n.type === "board" ? "700 12px" : "600 10px"} -apple-system, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        let label = n.label || "";
        if (label.length > 26) label = label.slice(0, 25) + "…";
        const words = label.split(" ");
        const lines: string[] = [];
        let cur = "";
        for (const wd of words) {
          if ((cur + " " + wd).trim().length > 22) { lines.push(cur.trim()); cur = wd; }
          else cur = (cur + " " + wd).trim();
        }
        if (cur) lines.push(cur.trim());
        lines.slice(0, 2).forEach((ln, li) => {
          ctx.fillText(ln, n.x, n.y + 3 + (li - (lines.slice(0, 2).length - 1) / 2) * 12);
        });
        if (n.type === "task") {
          ctx.beginPath();
          ctx.arc(n.x + r * 0.72, n.y - r * 0.72, 6, 0, Math.PI * 2);
          ctx.fillStyle = n.completed ? "#10b981" : "rgba(148, 163, 184, 0.5)";
          ctx.fill();
          if (n.completed) {
            ctx.strokeStyle = "#0b1220";
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(n.x + r * 0.72 - 2.6, n.y - r * 0.72);
            ctx.lineTo(n.x + r * 0.72 - 0.6, n.y - r * 0.72 + 2.2);
            ctx.lineTo(n.x + r * 0.72 + 2.8, n.y - r * 0.72 - 2);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    /* pointer interactions */
    const pos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
    };
    const hit = (p: { x: number; y: number }) => {
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const n = nodesRef.current[i];
        const r = n.type === "board" ? 44 : n.type === "cat" ? 34 : 26;
        const dx = p.x - n.x, dy = p.y - n.y;
        if (dx * dx + dy * dy <= r * r) return n;
      }
      return null;
    };
    const down = (e: PointerEvent) => {
      const n = hit(pos(e));
      mouseRef.current = { down: true, dragging: n ?? null, moved: false, lx: e.clientX, ly: e.clientY };
      if (n) canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!mouseRef.current.down || !mouseRef.current.dragging) return;
      if (Math.abs(e.clientX - mouseRef.current.lx) + Math.abs(e.clientY - mouseRef.current.ly) > 4) mouseRef.current.moved = true;
      const p = pos(e);
      mouseRef.current.dragging.x = p.x;
      mouseRef.current.dragging.y = p.y;
      mouseRef.current.dragging.vx = 0;
      mouseRef.current.dragging.vy = 0;
    };
    const up = (e: PointerEvent) => {
      const n = mouseRef.current.dragging;
      mouseRef.current.down = false;
      mouseRef.current.dragging = null;
      if (n && n.type === "task" && !mouseRef.current.moved) {
        const g = goals.find((x) => x.id === activeGoalId);
        const cat = g?.categories.find((c) => c.id === n.refId);
        const item = cat?.items.find((it) => it.id === n.id);
        if (item && cat) toggleTask(cat.id, item.id, { x: e.clientX, y: e.clientY });
      }
    };
    const dbl = (e: MouseEvent) => {
      const n = hit(pos(e as unknown as PointerEvent));
      if (n && n.type === "task") bindPomo(n.id);
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("dblclick", dbl);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("dblclick", dbl);
    };
  }, [goals, activeGoalId, toggleTask, bindPomo]);

  if (!goal) return null;

  return (
    <Panel className="relative h-[560px] overflow-hidden !p-0">
      <motion.div
        className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-1.5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <span className="rounded-full border px-2.5 py-1 text-[0.65rem] font-bold" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
          {t("views.mindmapHint")}
        </span>
      </motion.div>
      <canvas ref={canvasRef} className="block h-full w-full cursor-grab touch-none" style={{ width: "100%", height: "100%" }} aria-label={t("views.mindmapLabel")} />
    </Panel>
  );
}

/* ============ ANALYTICS ============ */

export function AnalyticsView() {
  const goal = useActiveGoal();
  const analytics = useStore((s) => s.analytics);
  const goals = useStore((s) => s.goals);
  const t = useT();
  const [nonce, setNonce] = useState(0);
  if (!goal) return null;
  void nonce;
  const stats = calculateStats(goal);

  const peak = (Object.entries(analytics.hourCounts ?? {}) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  const maxHour = Math.max(1, ...Object.values(analytics.hourCounts).map(Number), 1);
  /* v4 — per-goal focus attribution */
  const maxGoalFocus = Math.max(1, ...goals.map((g) => analytics.perGoal?.[g.id] || 0));

  return (
    <div className="flex flex-col gap-4" aria-label={t("views.analyticsAria")}>
      <motion.div
        className="gc-panel gc-blur flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><GcIcon name="chart-bars" size={19} /> {t("views.analyticsTitle")}</h2>
          <p className="text-xs" style={{ color: "var(--gc-text2)" }}>{t("views.analyticsSub")}</p>
        </div>
        <Button type="button" className="gc-btn-primary" onClick={() => setNonce((n) => n + 1)}>
          <RefreshCw className="h-4 w-4" /> {t("views.refresh")}
        </Button>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label={t("views.kpiCompletion")} value={stats.percent} suffix="%" tone="var(--gc-success)" sub={t("views.kpiCompletionSub")} />
        <Kpi label={t("views.kpiFocus")} value={Number((analytics.focusSeconds / 3600).toFixed(1))} suffix="h" tone="var(--gc-accent)" sub={t("views.kpiFocusSub")} />
        <Kpi label={t("views.kpiPeak")} text={peak ? hourLabel(Number(peak[0])) : "--"} tone="var(--gc-warning)" sub={t("views.kpiPeakSub")} />
        <Kpi label={t("views.kpiActive")} value={stats.total} tone="var(--gc-text2)" sub={t("views.kpiActiveSub")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelTitle icon={<GcIcon name="hourglass-flow" size={15} />}>{t("views.focusPerGoal")}</PanelTitle>
          <div className="flex flex-col gap-2.5">
            {goals.map((g, i) => {
              const secs = analytics.perGoal?.[g.id] || 0;
              const hrs = secs / 3600;
              const w = Math.round((secs / maxGoalFocus) * 100);
              return (
                <div key={g.id} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs font-bold" title={g.title}>{g.title}</span>
                  <div className="h-3.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--gc-surface-2)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "var(--gc-grad)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(2, w)}%` }}
                      transition={{ duration: 0.7, delay: i * 0.07, ease: EASE }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-xs" style={{ color: "var(--gc-text2)" }}>{hrs < 0.1 ? `${Math.round(secs / 60)}m` : `${hrs.toFixed(1)}h`}</span>
                </div>
              );
            })}
            {goals.every((g) => !(analytics.perGoal?.[g.id] > 0)) && (
              <p className="text-xs" style={{ color: "var(--gc-text2)" }}>
                {t("views.focusPerGoalEmpty")}
              </p>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelTitle icon={<GcIcon name="kanban-cols" size={15} />}>{t("views.categoryWorkload")}</PanelTitle>
          <div className="flex flex-col gap-2.5">
            {goal.categories.map((cat, i) => {
              const total = cat.items.length;
              const done = cat.items.filter((it) => it.completed).length;
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              return (
                <motion.div
                  key={cat.id}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.06, 0.3), ease: EASE }}
                >
                  <span className="flex w-[34%] min-w-0 items-center gap-1.5 text-xs font-semibold" title={cat.title}>
                    <span className="h-5 w-5 shrink-0 overflow-hidden rounded"><MediaBadge value={cat.media} fallback="mono:folder-open" iconSize={14} /></span>
                    <span className="truncate">{cat.title.replace(/[-:]$/, "").trim()}</span>
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--gc-surface-2)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "var(--gc-grad)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.15 + Math.min(i * 0.05, 0.25) }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-xs" style={{ color: "var(--gc-text2)" }}>{done}/{total}</span>
                </motion.div>
              );
            })}
            {goal.categories.length === 0 && <p className="text-xs" style={{ color: "var(--gc-muted)" }}>{t("views.noCategories")}</p>}
          </div>
        </Panel>

        <Panel>
          <PanelTitle icon={<GcIcon name="clock-hand" size={15} />}>{t("views.peakDistribution")}</PanelTitle>
          <svg viewBox="0 0 380 140" className="h-[140px] w-full" role="img" aria-label={t("views.focusPerHour")}>
            {Array.from({ length: 24 }, (_, h) => {
              const c = analytics.hourCounts[h] || 0;
              const bw = (380 - 36) / 24;
              const bh = Math.round((c / maxHour) * (140 - 36 - 14));
              const x = 18 + h * bw;
              const y = 140 - 18 - bh;
              return (
                <g key={h}>
                  <motion.rect
                    x={x + 1.5} width={bw - 3} rx={2.5} fill="var(--gc-accent)"
                    initial={{ y: 140 - 18, height: 2, opacity: 0.2 }}
                    animate={{ y, height: Math.max(bh, 2), opacity: c > 0 ? 0.9 : 0.18 }}
                    transition={{ duration: 0.6, delay: h * 0.02, ease: EASE }}
                  >
                    <title>{t("views.sessionTitle", { hour: hourLabel(h), count: c })}</title>
                  </motion.rect>
                  {h % 6 === 0 && (
                    <text x={x + bw / 2} y={136} fontSize="8" fill="var(--gc-text2)" textAnchor="middle">{hourLabel(h)}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, suffix, text, tone, sub }: { label: string; value?: number; suffix?: string; text?: string; tone: string; sub: string }) {
  return (
    <motion.div
      className="gc-panel gc-blur flex flex-col gap-1 rounded-2xl p-4"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      whileHover={{ y: -3 }}
    >
      <span className="text-[0.65rem] font-bold tracking-wide" style={{ color: "var(--gc-text2)" }}>{label}</span>
      <span className="font-mono text-2xl font-black" style={{ color: tone }}>
        {text !== undefined ? text : <AnimatedNumber value={value ?? 0} format={(n) => `${suffix ? Number(n.toFixed(1)) : Math.round(n)}${suffix ?? ""}`} />}
      </span>
      <span className="text-[0.62rem]" style={{ color: "var(--gc-muted)" }}>{sub}</span>
    </motion.div>
  );
}

/* ============ HEATMAP ============ */

export function HeatmapCard() {
  const history = useStore((s) => s.rpg.history);
  const streaks = useMemo(() => computeStreaks(history, new Date(new Date().setHours(0, 0, 0, 0))), [history]);
  const t = useT();

  const cells = useMemo(() => {
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const start = new Date(today);
    start.setDate(start.getDate() - 370);
    start.setDate(start.getDate() - start.getDay());
    const out: { key: string; count: number }[] = [];
    const d = new Date(start);
    let guard = 0;
    while (d <= today && guard < 420) {
      const key = localDateKey(d);
      out.push({ key, count: history[key] || 0 });
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return out;
  }, [history]);

  return (
    <Panel>
      <PanelTitle
        icon={<GcIcon name="flame-ember" size={15} />}
        right={
          <div className="flex items-center gap-2 text-[0.68rem] font-bold">
            <motion.span
              key={`c${streaks.current}`}
              className="flex items-center gap-1 rounded-full border px-2 py-0.5"
              style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 460, damping: 18 }}
            >
              <GcIcon name="flame-ember" size={11} /> <AnimatedNumber value={streaks.current} /> {t("views.dayStreak")}
            </motion.span>
            <span className="flex items-center gap-1 rounded-full border px-2 py-0.5" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
              <GcIcon name="trophy-star" size={11} /> {t("views.bestStreak", { count: streaks.best })}
            </span>
          </div>
        }
      >
        {t("views.heatmapTitle")}
      </PanelTitle>
      <div className="overflow-x-auto pb-1 gc-scroll">
        <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]" style={{ gridAutoColumns: "11px" }} aria-label={t("views.heatmapLabel")}>
          {cells.map((c, i) => (
            <div
              key={c.key}
              title={t("views.heatmapCell", { date: c.key, count: c.count })}
              className="hm-cell h-[11px] w-[11px] rounded-[2px]"
              style={{
                animationDelay: `${Math.floor(i / 7) * 9}ms`,
                background: c.count === 0 ? "var(--gc-surface-2)"
                  : c.count === 1 ? "rgba(16,185,129,0.3)"
                  : c.count === 2 ? "rgba(16,185,129,0.55)"
                  : c.count <= 4 ? "rgba(16,185,129,0.75)"
                  : "var(--gc-success)",
                boxShadow: c.count > 4 ? "0 0 4px var(--gc-success)" : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* end of views */
