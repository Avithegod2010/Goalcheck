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
import { APP_NAME } from "@/lib/goalcheck/editions";
import { initNativeShell } from "@/lib/goalcheck/native";
import { t, useT } from "@/lib/goalcheck/i18n";

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
      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          /* v4.3 — update-available toast: a waiting SW means a new deploy
             is ready; never auto-reload, let the user choose the moment. */
          const announce = (sw: ServiceWorker | null) => {
            if (!sw) return;
            notify(t("pwa.updateReady"), "rocket-launch", {
              description: t("pwa.updateReload"),
              action: {
                label: t("pwa.reload"),
                onClick: () => {
                  sw.postMessage("SKIP_WAITING");
                  window.location.reload();
                },
              },
              duration: 30000,
            });
          };
          if (reg.waiting) announce(reg.waiting);
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) announce(nw);
            });
          });
        })
        .catch(() => {
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
      notify(t("pwa.installed"), "rocket-launch");
    };
    window.addEventListener("beforeinstallprompt", onInstallable);
    window.addEventListener("appinstalled", onInstalled);

    /* ---- storage-quota bridge (store.ts dispatches gc-storage-quota) ---- */
    const onQuota = () => {
      notify(t("pwa.quotaTrimmed"), "image-pic", {
        description: t("pwa.quotaTrimmedDesc"),
      });
    };
    const onQuotaFailed = () => {
      notify(t("pwa.quotaFull"), "image-pic", {
        description: t("pwa.quotaFullDesc"),
      });
    };
    window.addEventListener("gc-storage-quota", onQuota);
    window.addEventListener("gc-storage-quota-failed", onQuotaFailed);

    /* ---- native shell glue (Android): hardware back button ---- */
    const disposeNative = initNativeShell();

    /* ---- welcome toast after a runtime edition switch ---- */
    try {
      if (sessionStorage.getItem("gc_edition_switched") === "1") {
        sessionStorage.removeItem("gc_edition_switched");
        notify(t("pwa.welcome", { name: APP_NAME }), "rocket-launch");
      }
    } catch {
      /* cosmetic only */
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallable);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("gc-storage-quota", onQuota);
      window.removeEventListener("gc-storage-quota-failed", onQuotaFailed);
      disposeNative();
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
  const t = useT();

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
      aria-label={t("pwa.installApp")}
      className="gc-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5"
      style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--gc-text)" }}>
        <GcIcon name="rocket-launch" size={15} />
        {t("pwa.installPitch")}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="gc-btn-primary rounded-lg px-3 py-1.5 text-xs font-extrabold text-white"
          onClick={install}
        >
          {t("pwa.installButton")}
        </button>
        <button
          type="button"
          aria-label={t("pwa.dismissAria")}
          className="rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-70"
          style={{ color: "var(--gc-text2)" }}
          onClick={dismiss}
        >
          {t("pwa.notNow")}
        </button>
      </div>
    </motion.section>
  );
}
