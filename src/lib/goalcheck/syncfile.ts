"use client";

/* =========================================================
   v4 — Advance: Sync-file writer (WebDAV/Syncthing-friendly)
   Links a local .json file via the File System Access API and
   auto-writes the workspace backup to it on every state change
   (debounced). The file handle is session-scoped (browsers do
   not allow persisting handles via localStorage); re-link once
   per session. Drop the file into a Syncthing/WebDAV folder
   and your workspace syncs across devices with zero servers.
   Graceful: hidden entirely when the API is unsupported.
   ========================================================= */

import { useStore } from "./store";

type PickerWindow = Window & {
  showSaveFilePicker?: (opts?: { suggestedName?: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle>;
};

let handle: FileSystemFileHandle | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let lastWritten = "";

export function syncFileSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as PickerWindow).showSaveFilePicker === "function";
}

export function isSyncLinked(): boolean {
  return handle !== null;
}

export async function linkSyncFile(): Promise<boolean> {
  const w = window as PickerWindow;
  if (!w.showSaveFilePicker) return false;
  try {
    handle = await w.showSaveFilePicker({
      suggestedName: "goalcheck-workspace-sync.json",
      types: [{ description: "GoalCheck workspace JSON", accept: { "application/json": [".json"] } }],
    });
    await writeNow();
    useStore.getState().touchBackup();
    return true;
  } catch {
    return false;
  }
}

export function unlinkSyncFile(): void {
  handle = null;
  lastWritten = "";
}

export async function writeNow(): Promise<boolean> {
  if (!handle) return false;
  try {
    const json = useStore.getState().exportWorkspace();
    if (json === lastWritten) return true;
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    lastWritten = json;
    return true;
  } catch {
    return false;
  }
}

/** Debounced auto-save — subscribe with useStore.subscribe in a top-level effect. */
export function scheduleSyncWrite(): void {
  const st = useStore.getState();
  if (!handle || !st.settings.syncFileEnabled) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { void writeNow(); }, 2500);
}
