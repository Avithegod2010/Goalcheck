"use client";

/* =========================================================
   v4.3 — Local due-date reminders (opt-in, zero network).
   While the app is open, a 15-minute check fires a system
   notification listing tasks that are due today or overdue.
   Deduplicated once per day per date-key via localStorage,
   so a task never nags twice in one day. On native Android
   the same payload rides the Capacitor local-notification
   plugin (already permission-gated there).
   ========================================================= */

import { useStore } from "./store";
import { localDateKey } from "./logic";
import { isNative } from "./native";

const DEDUPE_KEY = "gc_reminders_last_fire";

function alreadyFiredToday(): boolean {
  try {
    return localStorage.getItem(DEDUPE_KEY) === localDateKey(new Date());
  } catch {
    return false;
  }
}

function markFiredToday(): void {
  try {
    localStorage.setItem(DEDUPE_KEY, localDateKey(new Date()));
  } catch {
    /* ignore */
  }
}

async function fireNotification(count: number, lines: string[]): Promise<void> {
  const title = count === 1 ? "1 task needs your attention" : `${count} tasks need your attention`;
  const body = lines.slice(0, 5).join("\n") + (lines.length > 5 ? `\n+${lines.length - 5} more…` : "");

  if (isNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perms = await LocalNotifications.checkPermissions();
      if (perms.display !== "granted") return;
      await LocalNotifications.schedule({
        notifications: [{ id: Math.floor(Date.now() / 1000) % 2_147_483_647, title, body }],
      });
      return;
    } catch {
      /* fall through to web path */
    }
  }

  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag: "gc-due-reminders", icon: "icons/icon-192.png" });
    } else {
      new Notification(title, { body, tag: "gc-due-reminders" });
    }
  } catch {
    /* notifications are an enhancement */
  }
}

/** Scan the workspace for due-today/overdue open tasks and notify once per day. */
export async function runReminderCheck(force = false): Promise<void> {
  const { settings, goals } = useStore.getState();
  if (!settings.remindersEnabled) return;
  if (!force && alreadyFiredToday()) return;
  if (typeof document !== "undefined" && document.hidden && !force) {
    /* backgrounded tabs still check — the SW notification path works */ }

  const todayKey = localDateKey(new Date());
  const lines: string[] = [];
  let count = 0;
  for (const g of goals) {
    for (const c of g.categories) {
      for (const it of c.items) {
        if (it.completed || !it.dueDate) continue;
        const due = it.dueDate.slice(0, 10);
        if (due <= todayKey) {
          count++;
          lines.push(`${due < todayKey ? "⚠ " : "• "}${it.text} (${g.title})`);
        }
      }
    }
  }
  if (count === 0) {
    markFiredToday(); // nothing due — don't re-scan all day
    return;
  }
  await fireNotification(count, lines);
  markFiredToday();
}
