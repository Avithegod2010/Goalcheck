"use client";

/* =========================================================
   v4.3 — Deep-Focus mode: one task, one timer, nothing else.
   Fullscreen overlay that binds the task to the pomodoro
   engine, offers Start/Pause + Complete + Exit, a quick
   ambient-stream switcher and live session digits. Escape
   exits. Locked tasks (unmet dependency) are refused.
   ========================================================= */

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { usePomoRemaining, formatMs } from "@/components/goalcheck/atoms";
import { GcIcon } from "@/lib/goalcheck/icons";
import { isLightTheme } from "@/lib/goalcheck/themes";
import { GC_STREAMS } from "@/components/goalcheck/Sidebar";
import { Button } from "@/components/ui/button";
import { Pause, Play, X, Check } from "lucide-react";

export function DeepFocus() {
  const target = useUi((s) => s.deepFocus);
  const close = useUi((s) => s.closeDeepFocus);
  const goals = useStore((s) => s.goals);
  const pomo = useStore((s) => s.pomo);
  const remaining = usePomoRemaining();
  const startPause = useStore((s) => s.startPausePomo);
  const bindPomo = useStore((s) => s.bindPomo);
  const toggleTask = useStore((s) => s.toggleTask);
  const setAudio = useStore((s) => s.setAudio);
  const audioStream = useStore((s) => s.settings.audioStream);
  const theme = useStore((s) => s.theme);

  const ctx = useMemo(() => {
    if (!target) return null;
    const goal = goals.find((g) => g.categories.some((c) => c.id === target.catId));
    const cat = goal?.categories.find((c) => c.id === target.catId);
    const task = cat?.items.find((it) => it.id === target.taskId);
    if (!goal || !cat || !task) return null;
    let locked = false;
    if (task.dependsOn) {
      const prereq = goal.categories.flatMap((c) => c.items).find((t) => t.id === task.dependsOn);
      locked = !!prereq && !prereq.completed;
    }
    return { goal, cat, task, locked };
  }, [target, goals]);

  /* Escape exits; bind task to pomodoro when opening */
  useEffect(() => {
    if (!target) return;
    bindPomo(target.taskId);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [target, bindPomo, close]);

  /* auto-close when the task completes elsewhere */
  useEffect(() => {
    if (target && ctx && ctx.task.completed) close();
  }, [target, ctx, close]);

  const total = (pomo.mode === "focus" ? pomo.focusMinutes : pomo.mode === "short" ? 5 : 15) * 60_000;
  const pct = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0;
  const donePomos = ctx?.task.pomoCount ?? 0;
  const estPomos = ctx?.task.pomosEstimate ?? 0;

  return (
    <AnimatePresence>
      {target && ctx && (
        <motion.div
          className="fixed inset-0 z-[420] flex items-center justify-center p-6"
          style={{
            background: isLightTheme(theme) ? "rgba(255,255,255,0.95)" : "rgba(2,6,23,0.96)",
            backdropFilter: "blur(12px)",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Deep focus on: ${ctx.task.text}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <motion.div
            className="flex w-full max-w-lg flex-col items-center gap-5 text-center"
            initial={{ scale: 0.92, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
          >
            <span className="flex items-center gap-2 rounded-full px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-widest text-white" style={{ background: "var(--gc-grad)" }}>
              <GcIcon name="target-radar" size={13} /> Deep Focus
            </span>

            <h2 className="text-2xl font-extrabold leading-snug" style={{ textDecoration: ctx.task.completed ? "line-through" : undefined }}>
              {ctx.task.text}
            </h2>
            <p className="-mt-3 text-xs font-bold" style={{ color: "var(--gc-text2)" }}>
              {ctx.goal.title} · {ctx.cat.title}
              {estPomos > 0 && <> · 🍅 {donePomos}/{estPomos}</>}
            </p>

            <div className="relative flex h-44 w-44 items-center justify-center">
              <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--gc-border)" strokeWidth="6" />
                <motion.circle
                  cx="60" cy="60" r="54" fill="none" stroke="var(--gc-accent)" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 54}
                  animate={{ strokeDashoffset: 2 * Math.PI * 54 * (1 - Math.max(0, Math.min(100, pct)) / 100) }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </svg>
              <div className="font-mono text-4xl font-black tracking-tight" aria-live="polite">{formatMs(remaining)}</div>
            </div>

            {ctx.locked && (
              <p className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "color-mix(in srgb, var(--gc-warning) 62%, var(--gc-text))" }}>
                <GcIcon name="lock-shield" size={13} /> Dependency not finished yet — finish the prerequisite first.
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" className="gc-btn-primary" onClick={startPause} disabled={ctx.locked}>
                {pomo.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {pomo.running ? "Pause" : "Start focus"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gc-btn"
                disabled={ctx.locked || ctx.task.completed}
                onClick={() => {
                  if (useStore.getState().activeTimer) useStore.getState().stopTimer();
                  toggleTask(ctx.cat.id, ctx.task.id);
                }}
              >
                <Check className="h-4 w-4" /> Done
              </Button>
              <Button type="button" variant="outline" className="gc-btn" onClick={close}>
                <X className="h-4 w-4" /> Exit
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--gc-text2)" }}>
              <GcIcon name="headphones-beat" size={14} />
              <select
                aria-label="Ambient stream"
                value={audioStream}
                onChange={(e) => setAudio({ audioStream: e.target.value })}
                className="gc-input rounded-lg px-2 py-1 text-xs"
              >
                {GC_STREAMS.map((s: { id: string; label: string }) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <span className="font-mono">{estPomos > 0 ? `🍅 ${donePomos}/${estPomos}` : ""}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
