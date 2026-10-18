"use client";

/* =========================================================
   Shared atoms: media badge, buttons, pomodoro tick hook,
   animated number counter (framer-motion spring).
   ========================================================= */

import { useEffect, useRef, useState } from "react";
import { isImageUrl, isMonoIcon } from "@/lib/goalcheck/presets";
import { GcIcon } from "@/lib/goalcheck/icons";
import { useStore } from "@/lib/goalcheck/store";
import { completePomodoroSession } from "@/lib/goalcheck/store";
import { animate, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/* ---------- Media badge (mono animated icon | image | legacy emoji text) ---------- */

export function MediaBadge({ value, fallback, className, iconSize }: { value?: string; fallback?: string; className?: string; iconSize?: number }) {
  const media = (value && value.trim()) || fallback || "mono:clipboard-check";
  const base = className ?? "flex h-full w-full items-center justify-center overflow-hidden";
  if (isMonoIcon(media)) {
    return <GcIcon name={media.slice(5)} size={iconSize ?? 22} className="shrink-0" />;
  }
  if (isImageUrl(media)) {
    return (
      <img src={media} alt="Badge" className="h-full w-full object-cover" draggable={false} />
    );
  }
  /* legacy user-saved emoji chars still render as text */
  return <span className={base}>{media}</span>;
}

/* ---------- Animated number (springs to new values) ---------- */

export function AnimatedNumber({
  value, format, className, style, duration = 0.7,
}: { value: number; format?: (n: number) => string; className?: string; style?: React.CSSProperties; duration?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const render = (v: number) => { el.textContent = format ? format(v) : String(Math.round(v)); };
    if (reduced) { render(value); prev.current = value; return; }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: render,
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduced, duration, format]);

  return (
    <span ref={ref} className={className} style={style}>
      {format ? format(value) : Math.round(value)}
    </span>
  );
}

/* ---------- Buttons ---------- */

import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

export function GcButton({ className = "", ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={`gc-btn ${className}`}
    />
  );
}

/* ---------- Pomodoro remaining-time hook (timestamp based) ---------- */

export function usePomoRemaining(): number {
  const running = useStore((s) => s.pomo.running);
  const endsAt = useStore((s) => s.pomo.endsAt);
  const remainingMs = useStore((s) => s.pomo.remainingMs);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(iv);
  }, [running, endsAt]);

  if (!running) return remainingMs;
  void tick;
  return Math.max(0, endsAt - Date.now());
}

/** Drives pomodoro completion exactly once when the clock hits zero. */
export function usePomoCompletionDriver() {
  const running = useStore((s) => s.pomo.running);
  const endsAt = useStore((s) => s.pomo.endsAt);
  useEffect(() => {
    if (!running || !endsAt) return;
    const iv = setInterval(() => {
      if (Date.now() >= endsAt) {
        completePomodoroSession();
      }
    }, 250);
    return () => clearInterval(iv);
  }, [running, endsAt]);
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
}

/* ---------- section panel ---------- */

export function Panel({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`gc-panel gc-blur p-4 sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

export function PanelTitle({ icon, children, right }: { icon: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-wider" style={{ color: "var(--gc-text2)" }}>
        {icon}
        {children}
      </h2>
      {right}
    </div>
  );
}
