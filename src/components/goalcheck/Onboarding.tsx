"use client";

/* =========================================================
   v4 — Advance: First-run onboarding tour
   Three animated coach-mark steps, edition-aware copy.
   Shown once; replayable from Settings. Skips entirely when
   the user prefers reduced motion (copy is static, buttons
   remain — motion is decorative only).
   ========================================================= */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/goalcheck/goalcheck-exports";
import { GcIcon } from "@/lib/goalcheck/icons";
import { Button } from "@/components/ui/button";
import { IS_PRO, APP_NAME } from "@/lib/goalcheck/editions";

interface Step {
  icon: string;
  title: string;
  body: string;
}

export default function Onboarding() {
  const done = useStore((s) => s.settings.onboardingDone);
  const hydrated = useStore((s) => s._hydrated);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);

  if (!hydrated || done) return null;

  const steps: Step[] = IS_PRO
    ? [
        { icon: "clipboard-check", title: `Welcome to ${APP_NAME}`, body: "Boards hold categories, categories hold tasks. Your data lives 100% on this device — no account, no network." },
        { icon: "tomato-timer", title: "Focus with intention", body: "Bind a task to the Pomodoro timer, hit Start, and the floating pill keeps count across the app. Sessions feed XP, streaks and analytics." },
        { icon: "command-key", title: "Power tools everywhere", body: "Press Ctrl+K for the command bar: /view, /theme, /pomo 25, /done 3, /goal exam — and build streaks in the new Habits panel." },
      ]
    : [
        { icon: "clipboard-check", title: `Welcome to ${APP_NAME}`, body: "Boards hold categories, categories hold tasks. Your data lives 100% on this device — no account, no network." },
        { icon: "tomato-timer", title: "Focus with intention", body: "Bind a task to the Pomodoro timer and hit Start — the floating pill keeps count across the app." },
        { icon: "shield-guard", title: "Backup early, backup often", body: "Settings → Export keeps a one-tap JSON backup. Everything stays local, so the backup is yours alone." },
      ];

  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[10000] flex items-end justify-center p-4 sm:items-center"
        style={{ background: "color-mix(in srgb, var(--gc-bg) 78%, transparent)", backdropFilter: "blur(6px)" }}
        role="dialog"
        aria-modal="true"
        aria-label={`${APP_NAME} onboarding`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="gc-panel w-full max-w-md rounded-3xl p-6"
          initial={{ y: 46, scale: 0.94, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 30, scale: 0.96, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
        >
          <motion.div
            key={`icon-${step}`}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "var(--gc-grad)", color: "#fff", boxShadow: "0 8px 30px var(--gc-glow)" }}
            initial={{ rotate: -10, scale: 0.7 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 15 }}
          >
            <GcIcon name={s.icon} size={32} />
          </motion.div>

          <h2 className="text-center text-lg font-extrabold tracking-tight">{s.title}</h2>
          <p className="mt-2 min-h-[3.5rem] text-center text-sm leading-relaxed" style={{ color: "var(--gc-text2)" }}>
            {s.body}
          </p>

          <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden="true">
            {steps.map((_, i) => (
              <motion.span
                key={i}
                className="h-1.5 rounded-full"
                animate={{ width: i === step ? 22 : 8, opacity: i === step ? 1 : 0.4 }}
                style={{ background: i === step ? "var(--gc-accent)" : "var(--gc-border-strong)" }}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gc-btn"
              onClick={completeOnboarding}
            >
              Skip
            </Button>
            <div className="flex gap-2">
              {/* v4.3 — "try with sample data" for first-run visitors */}
              {!last && step === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gc-btn"
                  onClick={() => {
                    useStore.getState().loadDemoData();
                    completeOnboarding();
                  }}
                  title="Explore with a ready-made workspace — replace it any time from Settings"
                >
                  Try demo data
                </Button>
              )}
              {!last && (
                <Button type="button" variant="outline" size="sm" className="gc-btn" onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={step === 0}>
                  Back
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                className="gc-btn-primary"
                onClick={() => (last ? completeOnboarding() : setStep((v) => v + 1))}
              >
                {last ? "Let's go" : "Next"}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
