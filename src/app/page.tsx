"use client";

/* =========================================================
   GoalCheck Pro — single-page workspace
   Mobile-first, sticky-footer-safe (min-h-screen flex column).
   Fluidity: MotionConfig honours prefers-reduced-motion, view
   transitions slide via AnimatePresence, sidebar staggers in.
   ========================================================= */

import { useEffect } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { useStore, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { useGlobalShortcuts } from "@/components/goalcheck/ui";
import { GcIcon } from "@/lib/goalcheck/icons";
import { usePomoCompletionDriver } from "@/components/goalcheck/atoms";
import Effects from "@/components/goalcheck/Effects";
import { Header } from "@/components/goalcheck/Header";
import { PomodoroWidget, GoalNav, Templates, AudioStudio } from "@/components/goalcheck/Sidebar";
import { HeroCard, QuickAddBar, FilterBar } from "@/components/goalcheck/Hero";
import { ChecklistGrid } from "@/components/goalcheck/Checklist";
import { KanbanView, MatrixView, MindMapView, AnalyticsView, HeatmapCard } from "@/components/goalcheck/Views";
import { ModalHost } from "@/components/goalcheck/modals";
import { ZenHud, FloatingPill, CommandPalette } from "@/components/goalcheck/Overlays";
import { HabitsWidget } from "@/components/goalcheck/Habits";
import Onboarding from "@/components/goalcheck/Onboarding";
import { InstallCard } from "@/components/goalcheck/Pwa";
import { playChime } from "@/lib/goalcheck/audio";
import { scheduleSyncWrite } from "@/lib/goalcheck/syncfile";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, isLightTheme } from "@/lib/goalcheck/themes";
import { APP_NAME, BUILD_APP_NAME, APP_TITLE, BUILD_EDITION, EDITION, hasFeature } from "@/lib/goalcheck/editions";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  const hydrated = useStore((s) => s._hydrated);

  /* system color-mode watcher */
  const colorMode = useStore((s) => s.settings.colorMode);
  const setTheme = useStore((s) => s.setTheme);
  useEffect(() => {
    if (colorMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setTheme(mq.matches ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [colorMode, setTheme]);

  /* pomodoro engine (drift-free completion) */
  usePomoCompletionDriver();

  /* Ctrl+K palette + gc-open-rpg custom event */
  useEffect(useGlobalShortcuts(), []);

  /* v4 — sync-file auto-save: debounce-write the workspace to the linked file */
  useEffect(() => {
    const unsub = useStore.subscribe(() => scheduleSyncWrite());
    return unsub;
  }, []);

  /* chime test + periodic recurring reset checks */
  useEffect(() => {
    const onChime = () => {
      const st = useStore.getState().settings;
      playChime("pomo-done", st.chimePack, st.chimeVolume);
    };
    window.addEventListener("gc-test-chime", onChime);
    const iv = setInterval(() => useStore.getState().applyRecurringResets(), 30 * 60_000);
    return () => {
      window.removeEventListener("gc-test-chime", onChime);
      clearInterval(iv);
    };
  }, []);

  /* runtime edition switch — keep the browser tab title in sync.
     The metadata <title> is React-owned and is (re)applied asynchronously
     during head hydration, which clobbers one-shot assignments. A short,
     bounded sync loop converges whenever React finishes settling and
     stops on its own (no permanent polling). */
  useEffect(() => {
    if (EDITION === BUILD_EDITION) return;
    let ticks = 0;
    let stable = 0;
    const iv = window.setInterval(() => {
      ticks += 1;
      if (document.title !== APP_TITLE) {
        document.title = APP_TITLE;
        stable = 0;
      } else if (++stable >= 2 || ticks > 15) {
        window.clearInterval(iv);
      }
    }, 250);
    return () => window.clearInterval(iv);
  }, [hydrated]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="gc-app flex min-h-screen flex-col">
        <Effects />
        {/* Header + onboarding render edition-dependent module constants —
            they mount only after store rehydration so a runtime edition
            switch (Normal⇄Advance) can never cause a hydration mismatch. */}
        {hydrated && <Header />}

        <main className="relative z-10 mx-auto w-full max-w-[1440px] flex-1 px-3 py-4 sm:px-5 sm:py-6">
          {!hydrated ? (
            <LoadingSkeleton />
          ) : (
            <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
              {/* Sidebar — staggered entrance (edition-aware widgets) */}
              <aside className="flex flex-col gap-5" aria-label="Sidebar">
                {[PomodoroWidget, GoalNav,
                  ...(hasFeature("habits") ? [HabitsWidget] : []),
                  ...(hasFeature("templates") ? [Templates] : []),
                  ...(hasFeature("audio-studio") ? [AudioStudio] : []),
                ].map((W, i) => (
                  <motion.div
                    key={W.name}
                    initial={{ opacity: 0, x: -22 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.08 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <W />
                  </motion.div>
                ))}
              </aside>

              {/* Main board */}
              <div className="flex min-w-0 flex-col gap-5">
                <InstallCard />
                <BackupNudge />
                <HeroCard />
                <MainBoard />
              </div>
            </div>
          )}
        </main>

        <footer className="relative z-10 mt-auto border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs"
          style={{ borderColor: "var(--gc-border)", color: "var(--gc-text2)" }}
        >
          {/* hydration-safe: prerender + first client render agree on the BUILD
              name; the rehydrate flip re-renders with the runtime edition */}
          {hydrated ? APP_NAME : BUILD_APP_NAME} — local-first &amp; FOSS. Your data never leaves this device.{" "}
          <span className="hidden sm:inline">Free source code &amp; releases on GitHub.</span>
        </footer>

        <ModalHost />
        {hasFeature("zen") && <ZenHud />}
        {hasFeature("command-palette") && <CommandPalette />}
        <FloatingPill />
        {hydrated && <Onboarding />}
      </div>
    </MotionConfig>
  );
}

/* v4 — gentle backup nudge after 7 days without an export */
function BackupNudge() {
  const lastBackupAt = useStore((s) => s.settings.lastBackupAt);
  const dismissedAt = useStore((s) => s.settings.backupNudgeDismissedAt);
  const dismiss = useStore((s) => s.dismissBackupNudge);
  const ui = useUi();

  const now = Date.now();
  const stale = lastBackupAt === 0 || now - lastBackupAt > 7 * 86_400_000;
  const recentlyDismissed = now - dismissedAt < 7 * 86_400_000;
  if (!stale || recentlyDismissed) return null;

  return (
    <motion.section
      aria-label="Backup recommendation"
      className="gc-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5"
      style={{ borderColor: "var(--gc-warning-soft)", background: "var(--gc-surface-2)" }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--gc-text)" }}>
        <GcIcon name="shield-guard" size={15} />
        {lastBackupAt === 0
          ? "Your workspace lives only on this device — keep a JSON backup handy."
          : "It's been over a week since your last backup. Takes one tap."}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="gc-btn-primary rounded-lg px-3 py-1.5 text-xs font-extrabold text-white"
          onClick={() => ui.open("exportModal")}
        >
          Backup now
        </button>
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-70"
          style={{ color: "var(--gc-text2)" }}
          onClick={dismiss}
        >
          Dismiss for 7 days
        </button>
      </div>
    </motion.section>
  );
}

function MainBoard() {
  const view = useStore((s) => s.view);
  const heatmapEnabled = useStore((s) => s.settings.heatmapEnabled);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        className="flex min-w-0 flex-col gap-5"
        initial={{ opacity: 0, y: 14, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.995 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        {view === "checklist" && (
          <>
            <FilterBar />
            <QuickAddBar />
            {hasFeature("heatmap") && heatmapEnabled && <HeatmapCard />}
            <ChecklistGrid />
          </>
        )}
        {view === "kanban" && hasFeature("views.advanced") && (<><FilterBar /><KanbanView /></>)}
        {view === "matrix" && hasFeature("views.advanced") && (<><FilterBar /><MatrixView /></>)}
        {view === "graph" && hasFeature("views.advanced") && (<><FilterBar /><MindMapView /></>)}
        {view === "analytics" && hasFeature("views.advanced") && (<><FilterBar /><AnalyticsView /></>)}
      </motion.div>
    </AnimatePresence>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]" aria-busy="true" aria-label="Loading workspace">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-[430px] rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
