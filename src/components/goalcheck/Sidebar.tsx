"use client";

/* =========================================================
   Sidebar: Pomodoro (SVG ring, modes, task binding, chime),
   Goal boards nav, 1-click templates, Audio-reactive studio.
   Fluidity: spring-driven ring, layoutId active pills, stagger.
   ========================================================= */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, useActiveGoal, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { Panel, PanelTitle, MediaBadge, AnimatedNumber, usePomoRemaining, formatMs } from "./atoms";
import { GcIcon } from "@/lib/goalcheck/icons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TEMPLATES } from "@/lib/goalcheck/presets";
import { calculateStats } from "@/lib/goalcheck/logic";
import { startAudioStream, stopAudioStream, readFft } from "@/lib/goalcheck/audio";
import { Play, Pause, RotateCcw, Plus, Bell, Timer, Square } from "lucide-react";

/* ---------------- Pomodoro widget ---------------- */

const RING_CIRCUMFERENCE = 2 * Math.PI * 75; // 471

export function PomodoroWidget() {
  const pomo = useStore((s) => s.pomo);
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const setPomoMode = useStore((s) => s.setPomoMode);
  const startPause = useStore((s) => s.startPausePomo);
  const reset = useStore((s) => s.resetPomo);
  const remaining = usePomoRemaining();

  const goal = useActiveGoal();
  const totalMs = (pomo.mode === "short" ? 5 : pomo.mode === "long" ? 15 : pomo.focusMinutes) * 60_000;
  const fraction = totalMs > 0 ? 1 - remaining / totalMs : 0;
  const boundLabel = (() => {
    for (const g of goals) {
      if (g.id !== activeGoalId) continue;
      for (const c of g.categories) for (const it of c.items) if (it.id === pomo.attachedTaskId) return it.text;
    }
    return "";
  })();

  return (
    <Panel id="pomodoroPanel" className="flex flex-col items-center gap-4">
      <PanelTitle
        icon={<Timer className="h-4 w-4" />}
        right={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 gc-btn"
            title="Test chime"
            aria-label="Test chime"
            onClick={() => window.dispatchEvent(new CustomEvent("gc-test-chime"))}
          >
            <Bell className="h-4 w-4" />
          </Button>
        }
      >
        Pomodoro Focus
      </PanelTitle>

      {/* mode tabs with sliding pill */}
      <div className="grid w-full grid-cols-3 gap-1 rounded-xl border p-1" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
        {([["focus", "Focus"], ["short", "Short 5m"], ["long", "Long 15m"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setPomoMode(mode)}
            className={`relative rounded-lg px-1 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 ${pomo.mode === mode ? "text-white" : ""}`}
            style={pomo.mode === mode ? undefined : { color: "var(--gc-text2)" }}
          >
            {pomo.mode === mode && (
              <motion.span layoutId="pomoModePill" className="tab-pill" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
            )}
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </div>

      {/* SVG ring — spring-animated dashoffset, breathing glow while running */}
      <motion.div
        className="relative flex h-40 w-40 items-center justify-center"
        role="timer"
        aria-label={`Pomodoro ${formatMs(remaining)} remaining`}
        animate={pomo.running ? { scale: [1, 1.015, 1] } : { scale: 1 }}
        transition={pomo.running ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <svg viewBox="0 0 180 180" className={`h-full w-full -rotate-90 ${pomo.running ? "pomo-running-glow" : ""}`}>
          <defs>
            <linearGradient id="pomoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--gc-accent)" />
              <stop offset="100%" stopColor="var(--gc-success)" />
            </linearGradient>
          </defs>
          <circle cx="90" cy="90" r="75" fill="none" stroke="var(--gc-surface-2)" strokeWidth="9" />
          <motion.circle
            cx="90" cy="90" r="75" fill="none"
            stroke="url(#pomoGradient)" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            initial={false}
            animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - fraction) }}
            transition={{ duration: 0.45, ease: "linear" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <motion.span
            key={Math.ceil(remaining / 1000)}
            className="font-mono text-3xl font-extrabold tracking-tight"
            aria-live="polite"
            initial={{ opacity: 0.55, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {formatMs(remaining)}
          </motion.span>
          <span className="mt-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide" style={{ background: "var(--gc-soft)", color: "var(--gc-accent)" }}>
            {pomo.mode === "focus" ? "Focus Block" : pomo.mode === "short" ? "Short Break" : "Long Break"}
          </span>
        </div>
      </motion.div>

      {/* controls */}
      <div className="flex w-full items-center gap-2">
        <motion.button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold gc-btn-primary"
          onClick={startPause}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={pomo.running ? "pause" : "play"}
              className="flex items-center gap-2"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {pomo.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {pomo.running ? "Pause Timer" : "Start Focus"}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <motion.button
          type="button"
          className="gc-btn rounded-lg p-2.5"
          onClick={reset}
          title="Reset timer"
          aria-label="Reset timer"
          whileHover={{ rotate: -140, scale: 1.08 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
        >
          <RotateCcw className="h-4 w-4" />
        </motion.button>
      </div>

      {/* task binding */}
      <div className="w-full rounded-xl border p-3" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
        <div className="mb-1.5 flex items-center justify-between text-[0.68rem] font-bold uppercase" style={{ color: "var(--gc-text2)" }}>
          <span>Attached Task</span>
        </div>
        <Select value={pomo.attachedTaskId || "__none"} onValueChange={(v) => { if (v !== "__none") useStore.getState().bindPomo(v); else useStore.setState({ pomo: { ...useStore.getState().pomo, attachedTaskId: "" } }); }}>
          <SelectTrigger aria-label="Attach a task to this focus session" className="w-full gc-input !h-auto py-2 text-xs">
            <SelectValue placeholder="-- No task attached --" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="__none">-- No specific task attached --</SelectItem>
            {(goal?.categories ?? []).flatMap((c) =>
              c.items.filter((it) => !it.completed).map((it) => (
                <SelectItem key={it.id} value={it.id}>{c.title.replace(/[-:]$/, "").trim()}: {it.text}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <AnimatePresence>
          {boundLabel && (
            <motion.p
              key="bound"
              className="mt-1.5 flex items-center gap-1.5 truncate text-[0.7rem]"
              style={{ color: "var(--gc-text2)" }}
              title={boundLabel}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <GcIcon name="tomato-timer" size={12} /> {boundLabel}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

/* ---------------- Goal boards nav ---------------- */

export function GoalNav() {
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const setActive = useStore((s) => s.setActiveGoal);
  const openBoardModal = useUi((s) => s.openBoardModal);

  return (
    <Panel>
      <PanelTitle
        icon={<GcIcon name="target-radar" size={15} />}
        right={
          <Button type="button" variant="ghost" size="icon" className="size-7 gc-btn" aria-label="Create new board" onClick={() => openBoardModal("create")}>
            <Plus className="h-4 w-4" />
          </Button>
        }
      >
        My Goal Boards
      </PanelTitle>
      <div className="flex flex-col gap-1">
        {goals.map((g, i) => {
          const stats = calculateStats(g);
          const active = g.id === activeGoalId;
          return (
            <motion.button
              key={g.id}
              type="button"
              onClick={() => setActive(g.id)}
              className="relative flex w-full items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-2 text-left focus-visible:outline-2"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
              aria-current={active ? "true" : undefined}
            >
              {active && (
                <motion.span
                  layoutId="goalActiveBg"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "var(--gc-soft)", border: "1px solid var(--gc-glow)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
                  <MediaBadge value={g.media} fallback="mono:target-radar" iconSize={17} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.82rem] font-bold">{g.title}</span>
                  <span className="block text-[0.68rem]" style={{ color: "var(--gc-text2)" }}>{stats.completed}/{stats.total} completed</span>
                </span>
              </span>
              <motion.span
                key={`${g.id}-${stats.percent}`}
                className="relative shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.7rem] font-bold"
                style={active ? { background: "var(--gc-accent)", color: "#060913" } : { background: "var(--gc-surface-2)", color: "var(--gc-text2)" }}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 460, damping: 18 }}
              >
                {stats.percent}%
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </Panel>
  );
}

/* ---------------- Templates ---------------- */

export function Templates() {
  const loadTemplate = useStore((s) => s.loadTemplate);
  return (
    <Panel>
      <PanelTitle icon={<GcIcon name="book-flutter" size={15} />}>1-Click Templates</PanelTitle>
      <div className="flex flex-col gap-2">
        {Object.values(TEMPLATES).map((tpl, i) => (
          <motion.button
            key={tpl.key}
            type="button"
            onClick={() => loadTemplate(tpl.key)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left"
            style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: Math.min(i * 0.05, 0.25), ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ x: 4, borderColor: "var(--gc-accent)" }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--gc-soft)", color: "var(--gc-accent)" }}>
                <MediaBadge value={tpl.icon} fallback="mono:rocket-launch" iconSize={20} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[0.8rem] font-bold">{tpl.title}</span>
                <span className="block truncate text-[0.68rem]" style={{ color: "var(--gc-text2)" }}>{tpl.blurb}</span>
              </span>
            </span>
            <span className="shrink-0 text-[0.72rem] font-extrabold" style={{ color: "var(--gc-text)" }}>＋ Load</span>
          </motion.button>
        ))}
      </div>
    </Panel>
  );
}

/* ---------------- Audio-reactive studio ---------------- */

const STREAMS = [
  { id: "lofi", label: "Lo-Fi Chillhop + Vinyl", icon: "drum-beat" },
  { id: "synthwave", label: "Synthwave Delay Arp", icon: "piano-keys" },
  { id: "cosmic", label: "Cosmic Evolving Pad", icon: "network-nodes" },
  { id: "rain", label: "Rain, Thunder & Plinks", icon: "cloud-rain" },
  { id: "waves", label: "Ocean Waves", icon: "wave-ocean" },
  { id: "forest", label: "Night Forest Crickets", icon: "seed-grow" },
  { id: "mic", label: "Live Microphone Input", icon: "mic-live" },
];

export function AudioStudio() {
  const audioStream = useStore((s) => s.settings.audioStream);
  const audioGain = useStore((s) => s.settings.audioGain);
  const setAudio = useStore((s) => s.setAudio);
  const [running, setRunning] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const gainRef = useRef(audioGain);
  useEffect(() => { gainRef.current = audioGain; }, [audioGain]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const frame = () => {
      const data = readFft();
      const W = canvas.width, H = canvas.height;
      ctx2d.clearRect(0, 0, W, H);
      if (data) {
        (window as unknown as { __gcAudioLevel?: number }).__gcAudioLevel =
          ((window as unknown as { __gcAudioLevelRaw?: number }).__gcAudioLevelRaw ?? 0) * gainRef.current;
        const bins = data.bins;
        const bw = W / bins.length;
        const accent = getComputedStyle(document.documentElement).getPropertyValue("--gc-accent").trim() || "#6366f1";
        for (let i = 0; i < bins.length; i++) {
          const v = bins[i] / 255;
          const bh = Math.max(2, v * (H - 4));
          ctx2d.fillStyle = accent;
          ctx2d.globalAlpha = 0.35 + v * 0.65;
          ctx2d.fillRect(i * bw + 0.5, H - bh, bw - 1.2, bh);
        }
        ctx2d.globalAlpha = 1;
        setMeter("bass", data.bass); setMeter("mid", data.mid); setMeter("treble", data.treble);
      } else {
        (window as unknown as { __gcAudioLevel?: number }).__gcAudioLevel = 0;
        setMeter("bass", 0); setMeter("mid", 0); setMeter("treble", 0);
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const toggle = async () => {
    if (running) {
      stopAudioStream();
      setRunning(false);
    } else {
      const ok = await startAudioStream(audioStream);
      setRunning(ok);
    }
  };

  return (
    <Panel>
      <PanelTitle
        icon={<GcIcon name="wave-sound" size={15} />}
        right={
          <AnimatePresence>
            {running && (
              <motion.span
                key="live"
                className="rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold"
                style={{ background: "var(--gc-success-soft)", color: "var(--gc-success)" }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [1, 1.12, 1], opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ scale: { duration: 1.2, repeat: Infinity } }}
              >
                LIVE
              </motion.span>
            )}
          </AnimatePresence>
        }
      >
        Audio-Reactive Studio
      </PanelTitle>
      <div className="flex flex-col gap-3">
        <canvas ref={canvasRef} width={260} height={48} className="w-full rounded-lg" style={{ background: "var(--gc-input)" }} aria-hidden="true" />
        {(["bass", "mid", "treble"] as const).map((k) => (
          <div key={k} className="flex items-center gap-2 text-[0.68rem] font-extrabold">
            <span className="w-12 uppercase" style={{ color: k === "bass" ? "var(--gc-danger)" : k === "mid" ? "var(--gc-warning)" : "var(--gc-accent)" }}>{k}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--gc-surface-2)" }}>
              <div id={`${k}MeterFill`} className="h-full w-0 rounded-full transition-[width] duration-100" style={{ background: "var(--gc-grad)" }} />
            </div>
            <span id={`${k}MeterVal`} className="w-8 text-right font-mono">0%</span>
          </div>
        ))}
        <Select value={audioStream} onValueChange={(v) => { setAudio({ audioStream: v }); if (running) { stopAudioStream(); startAudioStream(v).then(setRunning); } }}>
          <SelectTrigger aria-label="Choose an ambient audio stream" className="w-full gc-input text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STREAMS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2"><GcIcon name={s.icon} size={13} /> {s.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold gc-btn-primary"
            onClick={toggle}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.94 }}
          >
            {running ? <><Square className="h-3.5 w-3.5" /> Stop Beat</> : <><Play className="h-3.5 w-3.5" /> Start Beat</>}
          </motion.button>
          <div className="flex flex-1 items-center gap-2">
            <span className="text-[0.65rem] font-bold" style={{ color: "var(--gc-text2)" }}>Gain</span>
            <Slider value={[audioGain]} min={0.5} max={3} step={0.1} onValueChange={([v]) => setAudio({ audioGain: v })} className="flex-1" aria-label="Particle reactivity gain" />
          </div>
        </div>
        <p className="text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>
          Synthesized locally with Web Audio — zero network. Particles dance to the beat.
        </p>
      </div>
    </Panel>
  );
}

function setMeter(kind: string, val: number) {
  const fill = document.getElementById(`${kind}MeterFill`);
  const valEl = document.getElementById(`${kind}MeterVal`);
  const pct = Math.round(val * 100);
  if (fill) fill.style.width = `${pct}%`;
  if (valEl) valEl.textContent = `${pct}%`;
}
