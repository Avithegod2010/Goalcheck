/* =========================================================
   native — Capacitor Android shell glue (web-safe).

   Every helper here is a NO-OP in the browser: they only act
   when the web app runs inside the Capacitor native shell
   (isNativePlatform()). This keeps one web codebase for
   GitHub Pages, the standalone server AND the Android APKs.

   Capabilities:
   - initNativeShell(): hardware BACK button — close the
     topmost dialog (Escape) or exit the app.
   - nativeBackgroundNotify(): post a local notification ONLY
     when the app is backgrounded (the in-app chime/toast
     covers the foreground case; Android swallows WebAudio
     and DOM toasts when the WebView is hidden).

   Privacy: @capacitor/local-notifications is a LOCAL device
   feature — no network, no Play Services. The zero-INTERNET
   guarantee is unaffected.
   ========================================================= */

import { Capacitor } from "@capacitor/core";

/** True only inside the native Android/iOS shell. */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Highest notification id Android allows (int32). */
const MAX_NOTIF_ID = 2_147_483_647;

/**
 * Post a local notification when the app is in the background.
 * Foreground events keep using chimes + in-app toasts.
 */
export async function nativeBackgroundNotify(title: string, body: string): Promise<void> {
  if (!isNative()) return;
  if (typeof document !== "undefined" && !document.hidden) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perms = await LocalNotifications.checkPermissions();
    if (perms.display !== "granted") return; // never nag — user can enable in Settings
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * MAX_NOTIF_ID),
          title,
          body,
        },
      ],
    });
  } catch {
    /* notifications are an enhancement — never break the flow over them */
  }
}

/**
 * Ask (once, lazily) for the Android 13+ notification permission.
 * Called when the user starts their first focus session — a natural
 * moment that never surprises with a cold permission prompt.
 */
export async function ensureNotificationPermission(): Promise<void> {
  if (!isNative()) return;
  try {
    const KEY = "gc_notif_perm_asked";
    if (localStorage.getItem(KEY) === "1") return;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const before = await LocalNotifications.checkPermissions();
    if (before.display !== "granted") {
      const after = await LocalNotifications.requestPermissions();
      if (after.display === "granted") localStorage.setItem(KEY, "1");
    } else {
      localStorage.setItem(KEY, "1");
    }
  } catch {
    /* ignore */
  }
}

/**
 * v4.2 — Share-sheet / Quick-Settings-tile / home-screen-widget glue.
 *
 * Contract mirrors capacitor/scripts/native-glue.mjs → plugin
 * "GoalCheckNative": updateWidget({title,subtitle,progress,running}),
 * setTileActive({active}), getPendingShare(); listener events
 * "shareText" {text} and "quickAdd".
 */

type GoalCheckNativePlugin = {
  updateWidget(opts: { title: string; subtitle: string; progress: number; running: boolean }): Promise<void>;
  setTileActive(opts: { active: boolean }): Promise<void>;
  getPendingShare(): Promise<{ text: string | null }>;
  addListener(eventName: "shareText", cb: (data: { text: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "quickAdd", cb: () => void): Promise<PluginListenerHandle>;
  addListener(eventName: string, cb: (data?: unknown) => void): Promise<PluginListenerHandle>;
};

interface PluginListenerHandle {
  remove: () => Promise<void>;
}

function nativePlugin(): GoalCheckNativePlugin | null {
  if (!isNative()) return null;
  try {
    const { registerPlugin } = Capacitor as unknown as {
      registerPlugin: (name: string) => GoalCheckNativePlugin;
    };
    return registerPlugin("GoalCheckNative");
  } catch {
    return null;
  }
}

/**
 * Listen for Android share-sheet text + Quick-Settings tile taps.
 * Also pulls a cold-start share (delivered before JS booted).
 * Returns a cleanup fn. No-op in the browser.
 */
export function initShareIntake(onText: (text: string) => void, onQuickAdd: () => void): () => void {
  const plugin = nativePlugin();
  if (!plugin) return () => {};
  let disposed = false;
  const removes: (() => void)[] = [];
  void (async () => {
    try {
      const pending = await plugin.getPendingShare();
      if (!disposed && pending?.text) onText(pending.text);
    } catch { /* optional */ }
    try {
      const h1 = await plugin.addListener("shareText", (d) => { if (!disposed && d?.text) onText(d.text); });
      const h2 = await plugin.addListener("quickAdd", () => { if (!disposed) onQuickAdd(); });
      if (disposed) { void h1.remove(); void h2.remove(); return; }
      removes.push(() => void h1.remove(), () => void h2.remove());
    } catch { /* optional */ }
  })();
  return () => { disposed = true; removes.forEach((r) => r()); };
}

let widgetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Push the current workspace summary to the Android home-screen widget
 * (debounced, native-only, silently ignored in the browser).
 */
export function pushWidgetState(state: { title: string; subtitle: string; progress: number; running: boolean }): void {
  const plugin = nativePlugin();
  if (!plugin) return;
  if (widgetTimer) clearTimeout(widgetTimer);
  widgetTimer = setTimeout(() => {
    void plugin.updateWidget({
      title: state.title || "GoalCheck",
      subtitle: state.subtitle || "",
      progress: Math.max(0, Math.min(100, Math.round(state.progress))),
      running: !!state.running,
    }).catch(() => { /* widget is an enhancement */ });
  }, 1500);
}

/**
 * Hardware BACK button: if any Radix dialog is open, close the topmost
 * one (synthetic Escape — Radix handles it natively); otherwise exit.
 * Returns a cleanup function. No-op in the browser.
 */
export function initNativeShell(): () => void {
  if (!isNative()) return () => {};

  let disposed = false;
  let removeListener: (() => void) | null = null;

  (async () => {
    try {
      const { App } = await import("@capacitor/app");
      if (disposed) return;
      const handle = await App.addListener("backButton", () => {
        const openDialog =
          typeof document !== "undefined" ? document.querySelector('[role="dialog"]') : null;
        if (openDialog) {
          // Radix UI dialogs listen for Escape on document — reuse that path
          // so we close exactly the topmost dialog with all its own semantics.
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
          );
          return;
        }
        void App.exitApp();
      });
      if (disposed) {
        void handle.remove();
        return;
      }
      removeListener = () => void handle.remove();
    } catch {
      /* shell glue is optional */
    }
  })();

  return () => {
    disposed = true;
    removeListener?.();
  };
}
