"use client";

/* =========================================================
   PWA glue — service-worker registration, install prompt
   capture and storage-quota toast bridge.
   ---------------------------------------------------------
   - PwaBootstrap mounts once (layout) and does the invisible
     work: registers /sw.js (prod only), captures the
     `beforeinstallprompt` event onto window.__gcInstallPrompt
     and re-broadcasts as `gc-installable`, listens for
     `appinstalled`, and turns storage-quota prunes (see
     store.ts) into user-facing toasts.
   - InstallCard is the visible "Install app" card shown in
     the main column when the browser allows installation.
   ========================================================= */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GcIcon } from "@/lib/goalcheck/icons";
import { notify } from "@/lib/goalcheck/notify";

export const INSTALL_DISMISS_KEY = "gc_install_dismissed_at";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Invisible glue — mount once in the root layout. */
export function PwaBootstrap() {
  useEffect(() => {
    /* ---- service worker (production builds only) ---- */
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      // document.baseURI already carries the Pages basePath
      const swUrl = new URL("sw.js", document.baseURI).href;
      navigator.serviceWorker.register(swUrl).catch(() => {
        /* SW is an enhancement — never break the app over it */
      });
    }

    /* ---- install prompt capture ---- */
    const onInstallable = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __gcInstallPrompt?: BeforeInstallPromptEvent | null }).__gcInstallPrompt =
        e as BeforeInstallPromptEvent;
      window.dispatchEvent(new CustomEvent("gc-installable"));
    };
    const onInstalled = () => {
      (window as unknown as { __gcInstallPrompt?: BeforeInstallPromptEvent | null }).__gcInstallPrompt = null;
      notify("App installed — find GoalCheck on your home screen!", "rocket-launch");
    };
    window.addEventListener("beforeinstallprompt", onInstallable);
    window.addEventListener("appinstalled", onInstalled);

    /* ---- storage-quota bridge (store.ts dispatches gc-storage-quota) ---- */
    const onQuota = () => {
      notify("Storage was full — the largest embedded images were trimmed to save your data.", "image-pic", {
        description: "Export a JSON backup to keep a full copy.",
      });
    };
    const onQuotaFailed = () => {
      notify("Storage is completely full and nothing could be trimmed.", "image-pic", {
        description: "Export a backup now, then remove large images.",
      });
    };
    window.addEventListener("gc-storage-quota", onQuota);
    window.addEventListener("gc-storage-quota-failed", onQuotaFailed);

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallable);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("gc-storage-quota", onQuota);
      window.removeEventListener("gc-storage-quota-failed", onQuotaFailed);
    };
  }, []);

  return null;
}

/** "Install app" card — shown when the browser exposes the prompt. */
export function InstallCard() {
  /* one-shot mount-time checks (SSR-safe): was the prompt already captured? was the card dismissed? */
  const [initialReady] = useState(
    () =>
      typeof window !== "undefined" &&
      !!(window as unknown as { __gcInstallPrompt?: BeforeInstallPromptEvent | null }).__gcInstallPrompt
  );
  const [dismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    const at = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
    return Date.now() - at < 14 * 86_400_000; // 14 days
  });
  const [promptReady, setPromptReady] = useState(false);

  const installable = initialReady || promptReady;

  useEffect(() => {
    if (initialReady) return;
    const check = () => setPromptReady(true);
    window.addEventListener("gc-installable", check);
    return () => window.removeEventListener("gc-installable", check);
  }, [initialReady]);

  const [hidden, setHidden] = useState(false);

  const install = async () => {
    const win = window as unknown as { __gcInstallPrompt?: BeforeInstallPromptEvent | null };
    const prompt = win.__gcInstallPrompt;
    if (prompt) {
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } catch {
        /* user or browser cancelled — nothing to do */
      }
      win.__gcInstallPrompt = null;
    }
    setHidden(true);
  };

  const dismiss = () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    setHidden(true);
  };

  if (!installable || hidden) return null;

  return (
    <motion.section
      aria-label="Install app"
      className="gc-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5"
      style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--gc-text)" }}>
        <GcIcon name="rocket-launch" size={15} />
        Install GoalCheck as an app — full screen &amp; offline.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="gc-btn-primary rounded-lg px-3 py-1.5 text-xs font-extrabold text-white"
          onClick={install}
        >
          Install
        </button>
        <button
          type="button"
          aria-label="Dismiss install suggestion"
          className="rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-70"
          style={{ color: "var(--gc-text2)" }}
          onClick={dismiss}
        >
          Not now
        </button>
      </div>
    </motion.section>
  );
}
