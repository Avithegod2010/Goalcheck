"use client";

/* =========================================================
   Zen HUD, Command Palette (Ctrl+K), Floating Pomodoro Pill
   Fluidity: AnimatePresence scale/fade entrances, spring pill.
   ========================================================= */

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { bus, useStore, useActiveGoal, useUi, completePomodoroSession } from "@/lib/goalcheck/goalcheck-exports";
import { usePomoRemaining, formatMs } from "./atoms";
import { GcIcon } from "@/lib/goalcheck/icons";
import { isLightTheme, THEMES, ENGINES } from "@/lib/goalcheck/themes";
import { makeTask, fuzzyScore } from "@/lib/goalcheck/logic";
import { t, useT } from "@/lib/goalcheck/i18n";
import type { Category } from "@/lib/goalcheck/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Pause, Play, X, ArrowUp, Check } from "lucide-react";

/* ---------------- Zen HUD ---------------- */

export function ZenHud() {
  const open = useUi((s) => s.zenOpen);
  const remaining = usePomoRemaining();
  const pomo = useStore((s) => s.pomo);
  const startPause = useStore((s) => s.startPausePomo);
  const completeBoundTask = useStore((s) => s.completeBoundTask);
  const goal = useActiveGoal();
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const theme = useStore((s) => s.theme);
  const t = useT();

  const boundLabel = (() => {
    for (const g of goals) {
      if (g.id !== activeGoalId) continue;
      for (const c of g.categories) for (const it of c.items) if (it.id === pomo.attachedTaskId) return it.text;
    }
    return "";
  })();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[400] flex items-center justify-center p-6"
          style={{
            background: isLightTheme(theme) ? "rgba(255,255,255,0.92)" : "rgba(2,6,23,0.94)",
            backdropFilter: "blur(10px)",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={t("focus.zenLabel")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="flex w-full max-w-md flex-col items-center gap-5 text-center"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
          >
            <motion.span
              className="flex items-center gap-2 rounded-full px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-widest text-white"
              style={{ background: "var(--gc-grad)" }}
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <GcIcon name="lotus-zen" size={13} /> {t("focus.zenBadge")}
            </motion.span>
            <h2 className="text-2xl font-extrabold">{boundLabel || t("focus.deepWork")}</h2>
            <div className="font-mono text-6xl font-black tracking-tight" aria-live="polite">{formatMs(remaining)}</div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" className="gc-btn-primary" onClick={startPause}>
                {pomo.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {pomo.running ? t("focus.pause") : t("focus.start")}
              </Button>
              <Button type="button" variant="outline" className="gc-btn" onClick={completeBoundTask}>
                <Check className="h-4 w-4" /> {t("focus.completeBound")}
              </Button>
              <Button type="button" variant="outline" className="gc-btn" onClick={() => useUi.setState({ zenOpen: false })}>
                <X className="h-4 w-4" /> {t("focus.exitZen")}
              </Button>
            </div>
            <p className="text-xs" style={{ color: "var(--gc-text2)" }}>{goal?.title}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Floating Pomodoro Pill ---------------- */

export function FloatingPill() {
  const pomo = useStore((s) => s.pomo);
  const remaining = usePomoRemaining();
  const startPause = useStore((s) => s.startPausePomo);
  const [visible, setVisible] = useState(false);
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const t = useT();

  useEffect(() => {
    const onScroll = () => {
      const panel = document.getElementById("pomodoroPanel");
      if (!panel) return;
      const bottom = panel.getBoundingClientRect().bottom < 0;
      setVisible((v) => (v === bottom ? v : bottom));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const raf = requestAnimationFrame(onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const boundLabel = (() => {
    for (const g of goals) {
      if (g.id !== activeGoalId) continue;
      for (const c of g.categories) for (const it of c.items) if (it.id === pomo.attachedTaskId) return it.text;
    }
    return "";
  })();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="gc-panel gc-blur fixed bottom-4 left-4 z-[150] flex items-center gap-3 rounded-full border px-3 py-2"
          style={{ borderColor: "var(--gc-border-strong)" }}
          role="status"
          aria-label={t("focus.pillRunning", { time: formatMs(remaining) })}
          initial={{ y: 80, opacity: 0, scale: 0.85 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.85 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
        >
          <span style={{ color: "var(--gc-accent)" }} aria-hidden="true">
            <GcIcon name="clock-hand" size={20} />
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-sm font-extrabold leading-tight">{formatMs(remaining)}</span>
            <span className="block max-w-[140px] truncate text-[0.62rem]" style={{ color: "var(--gc-text2)" }}>{boundLabel || t("focus.noTaskAttached")}</span>
          </span>
          <Button type="button" size="icon" className="size-8 rounded-full gc-btn-primary" onClick={startPause} aria-label={pomo.running ? t("focus.pausePomodoro") : t("focus.resumePomodoro")}>
            {pomo.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button type="button" size="icon" variant="outline" className="size-8 rounded-full gc-btn" onClick={() => document.getElementById("pomodoroPanel")?.scrollIntoView({ behavior: "smooth" })} aria-label={t("focus.scrollToPomo")}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Command Palette ---------------- */

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const goals = useStore((s) => s.goals);
  const t = useT();

  /* v4.3 — live fuzzy results while typing free text (not /commands) */
  const results = useMemo(() => {
    const query = q.trim();
    if (query.length < 2 || query.startsWith("/")) return [];
    type Hit = { kind: "board" | "task"; goalId: string; goalTitle: string; catId?: string; taskId?: string; text: string; score: number };
    const hits: Hit[] = [];
    for (const g of goals) {
      const bs = fuzzyScore(query, g.title);
      if (bs > 0) hits.push({ kind: "board", goalId: g.id, goalTitle: g.title, text: g.title, score: bs + 40 });
      for (const c of g.categories) {
        for (const it of c.items) {
          const ts = fuzzyScore(query, `${it.text} ${it.notes || ""}`);
          if (ts > 0) hits.push({ kind: "task", goalId: g.id, goalTitle: g.title, catId: c.id, taskId: it.id, text: it.text, score: ts - (it.completed ? 60 : 0) });
        }
      }
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 7);
  }, [q, goals]);

  const jump = (hit: { kind: string; goalId: string; taskId?: string }) => {
    useStore.getState().setActiveGoal(hit.goalId);
    useStore.getState().setSearch(hit.kind === "task" ? q.trim() : "");
    useUi.setState({ paletteOpen: false });
    if (inputRef.current) inputRef.current.value = "";
    setQ("");
  };

  const run = () => {
    const raw = (inputRef.current?.value ?? "").trim();
    if (!raw) return;
    const msgs: string[] = [];
    for (const line of raw.split(/\n+/)) {
      const r = execSingleCommand(line.trim());
      if (r) msgs.push(r);
    }
    if (inputRef.current) inputRef.current.value = "";
    setQ("");
    useUi.setState({ paletteOpen: false });
    if (msgs.length) toast(msgs[0] + (msgs.length > 1 ? t("palette.moreToast", { count: msgs.length - 1 }) : ""));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) useUi.setState({ paletteOpen: false }); }}>
      <DialogContent className="gc-modal max-w-xl !gap-0 overflow-hidden p-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{t("palette.title")}</DialogTitle>
        <input
          ref={inputRef}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
          onChange={(e) => setQ(e.target.value)}
          className="w-full border-b bg-transparent p-4 text-base outline-none"
          style={{ borderColor: "var(--gc-border)" }}
          placeholder={t("palette.placeholder")}
          aria-label={t("palette.inputLabel")}
          autoFocus
        />
        {results.length > 0 && (
          <ul className="max-h-72 overflow-y-auto border-b p-1.5" style={{ borderColor: "var(--gc-border)" }} aria-label={t("palette.results")}>
            {results.map((h, i) => (
              <li key={`${h.taskId ?? h.goalId}-${i}`}>
                <button
                  type="button"
                  onClick={() => jump(h)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold hover:bg-[var(--gc-surface-2)]"
                >
                  <GcIcon name={h.kind === "board" ? "folder-open" : "check-circle"} size={13} />
                  <span className="min-w-0 flex-1 truncate">{h.text}</span>
                  <span className="shrink-0 text-[0.62rem] font-normal" style={{ color: "var(--gc-muted)" }}>{h.goalTitle}</span>
                  <kbd className="shrink-0 rounded border px-1 text-[0.6rem]" style={{ borderColor: "var(--gc-border)", color: "var(--gc-muted)" }}>↵</kbd>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2 px-4 py-3 text-[0.72rem]" style={{ color: "var(--gc-text2)" }}>
          <span>
            {t("palette.syntax")} <code>/category Task !priority ~pomos #minutes</code> {t("palette.or")} <code>/view</code>, <code>/theme</code>, <code>/pomo 25</code>, <code>/done 3</code>, <code>/goal exam</code>, <code>/review</code>, <code>/demo</code>, <code>/help</code>
          </span>
          <Button type="button" size="sm" className="gc-btn-primary" onClick={run}>{t("palette.run")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** v4.2 — run one /command from anywhere (quick-add bar routes here). */
export function runCommand(line: string): string | null {
  return execSingleCommand(line);
}

function execSingleCommand(line: string): string | null {
  const s = useStore.getState();
  const meta = /^\/(view|theme|engine|pomo|zen|atmosphere|rpg|export|done|goal|clear|review|focus|demo|help)\b\s*(.*)$/i.exec(line);
  if (meta) {
    const cmd = meta[1].toLowerCase();
    const arg = meta[2].trim();
    if (cmd === "view") {
      const v = arg.toLowerCase();
      if (["checklist", "week", "calendar", "timeline", "kanban", "matrix", "graph", "analytics"].includes(v)) {
        s.setView(v as never); // setView clamps to the edition
        return t("palette.viewSwitched", { name: v });
      }
      return t("palette.unknownView");
    }
    if (cmd === "theme") {
      const t2 = THEMES.find((x) => x.id === arg.toLowerCase());
      if (t2) { s.setTheme(t2.id); return t("palette.themeSet", { name: arg }); }
      return t("palette.unknownTheme", { names: THEMES.map((x) => x.id).join(", ") });
    }
    if (cmd === "engine") {
      if (ENGINES.some((e) => e.id === arg.toLowerCase())) { s.setParticles(arg.toLowerCase() as never); return t("palette.engineSet", { name: arg }); }
      return t("palette.unknownEngine");
    }
    if (cmd === "pomo") {
      const mins = parseInt(arg, 10);
      if (!isNaN(mins) && mins > 0 && mins <= 180) { s.setPomoMinutes(mins); return t("palette.pomoSet", { count: mins }); }
      if (["focus", "short", "long"].includes(arg.toLowerCase())) { s.setPomoMode(arg.toLowerCase() as never); return t("palette.pomoMode", { name: arg }); }
      return t("palette.pomoUsage");
    }
    if (cmd === "zen") { useUi.getState().open("zenOpen"); return t("palette.zenEntered"); }
    if (cmd === "atmosphere") { useUi.getState().open("themeModal"); return t("palette.atmosphereOpened"); }
    if (cmd === "rpg") {
      const a = arg.toLowerCase();
      const enabled = a === "on" ? true : a === "off" ? false : !s.settings.rpgEnabled;
      if (enabled !== s.settings.rpgEnabled) s.toggleRpg();
      return t("palette.rpgToggled", { state: enabled ? "ON" : "OFF" });
    }
    if (cmd === "export") { useUi.getState().open("exportModal"); return t("palette.exportOpened"); }
    /* v4 — Advance commands */
    if (cmd === "done") {
      const n = parseInt(arg, 10);
      if (isNaN(n) || n < 1) return t("palette.doneUsage");
      const goal = s.goals.find((g) => g.id === s.activeGoalId);
      if (!goal) return t("palette.noBoard");
      const flat = goal.categories.flatMap((c) => c.items.filter((it) => !it.completed));
      const target = flat[n - 1];
      if (!target) return flat.length === 1
        ? t("palette.rangeOne", { count: flat.length, index: n })
        : t("palette.rangeMany", { count: flat.length, index: n });
      const cat = goal.categories.find((c) => c.items.some((it) => it.id === target.id));
      if (cat) { s.toggleTask(cat.id, target.id); return t("palette.completed", { name: target.text }); }
      return t("palette.taskNotFound");
    }
    if (cmd === "goal") {
      const q = arg.toLowerCase();
      const hit = s.goals.find((g) => g.title.toLowerCase().includes(q)) ?? s.goals.find((g) => q.split(/\s+/).some((w) => w.length > 2 && g.title.toLowerCase().includes(w)));
      if (!hit) return t("palette.noBoardMatch", { name: arg, boards: s.goals.map((g) => g.title).join(" • ") });
      s.setActiveGoal(hit.id);
      return t("palette.switchedBoard", { name: hit.title });
    }
    if (cmd === "clear") {
      const goal = s.goals.find((g) => g.id === s.activeGoalId);
      if (!goal) return t("palette.noBoard");
      let removed = 0;
      useStore.setState({
        goals: s.goals.map((g) => g.id !== goal.id ? g : {
          ...g,
          categories: g.categories.map((c) => {
            const keep = c.items.filter((it) => {
              if (it.completed && it.recurrence === "none") { removed += 1; return false; }
              return true;
            });
            return { ...c, items: keep };
          }),
        }),
      });
      return removed > 0
        ? (removed > 1 ? t("palette.clearedMany", { count: removed }) : t("palette.clearedOne", { count: removed }))
        : t("palette.nothingToClear");
    }
    if (cmd === "review") {
      useUi.setState({ reviewModal: true });
      return t("palette.reviewOpened");
    }
    if (cmd === "focus") {
      const n = parseInt(arg, 10);
      if (isNaN(n) || n < 1) return t("palette.focusUsage");
      const goal = s.goals.find((g) => g.id === s.activeGoalId);
      if (!goal) return t("palette.noBoard");
      const pairs = goal.categories.flatMap((c) => c.items.filter((task) => !task.completed).map((task) => ({ cat: c, t: task })));
      const hit = pairs[n - 1];
      if (!hit) return pairs.length === 1
        ? t("palette.rangeOne", { count: pairs.length, index: n })
        : t("palette.rangeMany", { count: pairs.length, index: n });
      useUi.setState({ deepFocus: { catId: hit.cat.id, taskId: hit.t.id } });
      return t("palette.focusSet", { name: hit.t.text });
    }
    if (cmd === "demo") {
      s.loadDemoData();
      return t("palette.demoLoaded");
    }
    if (cmd === "help") {
      useUi.getState().open("settingsModal");
      return t("palette.help");
    }
  }

  // task quick-add: /category-hint Task text !priority ~pomos #minutes
  let rest = line;
  let catHint: string | null = null;
  const m = /^\/([\w-]+)\s+/.exec(rest);
  if (m) { catHint = m[1].toLowerCase(); rest = rest.slice(m[0].length); }
  let priority: "normal" | "high" | "urgent" = "normal";
  let pomos = 0;
  let pomoStart = 0;
  const pr = /!(urgent|high|normal)\b/i.exec(rest);
  if (pr) { priority = pr[1].toLowerCase() as never; rest = rest.replace(pr[0], ""); }
  const pm = /~(\d{1,2})\s*(p|pomos?)?\b/i.exec(rest);
  if (pm) { pomos = parseInt(pm[1], 10); rest = rest.replace(pm[0], ""); }
  const tm = /#(\d{1,3})\s*m\b/i.exec(rest);
  if (tm) { pomoStart = parseInt(tm[1], 10); rest = rest.replace(tm[0], ""); }
  const text = rest.trim();
  if (!text) return t("palette.nothingToAdd");

  const goal = s.goals.find((g) => g.id === s.activeGoalId);
  if (!goal) return t("palette.noBoard");
  let targetCat: Category | null = null;
  if (catHint) {
    for (const c of goal.categories) {
      const ct = c.title.toLowerCase().replace(/[-:]/g, " ").replace(/\s+/g, " ").trim();
      if (ct.includes(catHint) || catHint.includes(ct.split(" ")[0])) { targetCat = c; break; }
    }
  }
  if (!targetCat) targetCat = goal.categories[0] ?? null;

  const newTask = makeTask(text, { priority, pomosEstimate: pomos || 1 });
  if (targetCat) {
    useStore.setState({
      goals: s.goals.map((g) => g.id !== goal.id ? g : {
        ...g,
        categories: g.categories.map((c) => c.id === targetCat!.id ? { ...c, items: [...c.items, newTask] } : c),
      }),
    });
  } else {
    useStore.setState({
      goals: s.goals.map((g) => g.id !== goal.id ? g : {
        ...g,
        categories: [...g.categories, {
          id: `cat_${Date.now().toString(36)}`, title: `${catHint || "Inbox"} -`, media: "mono:clipboard-check",
          recurrence: "none", lastResetDate: new Date().toISOString().slice(0, 10), lastWeekKey: "", items: [newTask],
        }],
      }),
    });
  }
  let msg = t("palette.added", { category: (targetCat?.title ?? catHint ?? "Inbox").replace(/[-:]$/, "").trim(), text });
  if (priority !== "normal") msg += " " + t("palette.priorityTag", { priority });
  if (pomoStart > 0) {
    s.setPomoMinutes(pomoStart);
    useStore.setState({ pomo: { ...useStore.getState().pomo, attachedTaskId: newTask.id } });
    msg += " " + t("palette.timerReady", { count: pomoStart });
  }
  return msg;
}
