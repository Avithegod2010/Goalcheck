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

   v4.2 — VAULT MODE: with syncFileEncrypted the workspace is
   AES-GCM encrypted with a session passphrase (crypto.ts) and
   written as a .gcenc file. The passphrase lives only in this
   module's memory — never persisted. "Pull from sync file"
   decrypts and restores, so the vault file in ANY cloud folder
   (Dropbox/Drive/Nextcloud/Syncthing) becomes an E2E-encrypted
   sync across devices with zero servers and zero accounts.
   ========================================================= */

import { useStore } from "./store";
import { encryptString, decryptString, isEncryptedPayload } from "./crypto";

type PickerWindow = Window & {
  showSaveFilePicker?: (opts?: { suggestedName?: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (opts?: { types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle[]>;
};

let handle: FileSystemFileHandle | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let lastWritten = "";

/* vault passphrase — session memory only, never persisted */
let vaultPass: string | null = null;
export function setVaultPassphrase(pass: string | null): void {
  vaultPass = pass && pass.trim() ? pass.trim() : null;
}
export function hasVaultPassphrase(): boolean {
  return vaultPass !== null;
}
export function vaultNeedsPassphrase(): boolean {
  return !!useStore.getState().settings.syncFileEncrypted && !vaultPass;
}

export function syncFileSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as PickerWindow).showSaveFilePicker === "function";
}

export function isSyncLinked(): boolean {
  return handle !== null;
}

export async function linkSyncFile(): Promise<boolean> {
  const w = window as PickerWindow;
  if (!w.showSaveFilePicker) return false;
  const encrypted = useStore.getState().settings.syncFileEncrypted;
  try {
    handle = await w.showSaveFilePicker({
      suggestedName: encrypted ? "goalcheck-vault.gcenc" : "goalcheck-workspace-sync.json",
      types: encrypted
        ? [{ description: "GoalCheck encrypted vault", accept: { "application/octet-stream": [".gcenc"] } }]
        : [{ description: "GoalCheck workspace JSON", accept: { "application/json": [".json"] } }],
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
    const encrypted = useStore.getState().settings.syncFileEncrypted;
    const out = encrypted && vaultPass ? await encryptString(json, vaultPass) : json;
    if (out === lastWritten) return true;
    const writable = await handle.createWritable();
    await writable.write(out);
    await writable.close();
    lastWritten = out;
    return true;
  } catch {
    return false;
  }
}

/**
 * v4.2 — restore from the linked sync file (plain JSON or encrypted vault).
 * Returns an error message on failure, null on success.
 */
export async function pullFromSyncFile(passphrase?: string): Promise<string | null> {
  if (!handle) return "No sync file is linked in this session.";
  try {
    const file = await handle.getFile();
    const text = await file.text();
    if (!text.trim()) return "The linked file is empty — nothing to restore yet.";
    let json = text;
    if (isEncryptedPayload(text)) {
      const pass = passphrase || vaultPass;
      if (!pass) return "This vault file is encrypted — enter the passphrase first.";
      json = await decryptString(text, pass);
    }
    const ok = useStore.getState().importWorkspace(json);
    return ok ? null : "The file did not contain a valid GoalCheck workspace.";
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      return "Browser blocked file access — re-link the sync file and try again.";
    }
    return "Wrong passphrase or corrupted vault file.";
  }
}

/** Debounced auto-save — subscribe with useStore.subscribe in a top-level effect. */
export function scheduleSyncWrite(): void {
  const st = useStore.getState();
  if (!handle || !st.settings.syncFileEnabled) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { void writeNow(); }, 2500);
}

/* =========================================================
   v4.3 — AUTO-SNAPSHOT ROTATION
   A user-picked DIRECTORY receives dated workspace snapshots
   (goalcheck-snap-YYYY-MM-DD.json). Cadence comes from
   settings.snapshotCadence; the N newest snapshots are kept,
   older ones are deleted (rotation). Directory handles also
   cannot be persisted, so the folder is re-picked per session.
   ========================================================= */

type DirPickerWindow = Window & {
  showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
};

let snapDir: FileSystemDirectoryHandle | null = null;
let snapChecking = false;

export function snapshotFolderLinked(): boolean {
  return snapDir !== null;
}

export async function linkSnapshotFolder(): Promise<boolean> {
  const w = window as DirPickerWindow;
  if (!w.showDirectoryPicker || !syncFileSupported()) return false;
  try {
    snapDir = await w.showDirectoryPicker({ mode: "readwrite" });
    return true;
  } catch {
    return false;
  }
}

export function unlinkSnapshotFolder(): void {
  snapDir = null;
}

/** Run the cadence check on app boot (and optionally on an interval). */
export async function maybeAutoSnapshot(): Promise<void> {
  if (snapChecking || !snapDir) return;
  const { settings, exportWorkspace } = useStore.getState();
  const cadence = settings.snapshotCadence;
  if (cadence === "off") return;
  snapChecking = true;
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    const fileName = `goalcheck-snap-${todayKey}.json`;
    /* skip when today's snapshot already exists */
    try {
      await snapDir.getFileHandle(fileName, { create: false });
      return; // already snapshotted today
    } catch { /* not present — continue */ }

    const json = exportWorkspace();
    const fh = await snapDir.getFileHandle(fileName, { create: true });
    const w = await fh.createWritable();
    await w.write(json);
    await w.close();

    /* rotation: keep the N newest goalcheck-snap-*.json entries */
    const keep = Math.max(1, Math.min(20, settings.snapshotsToKeep || 5));
    const snaps: { name: string; date: string }[] = [];
    /* iterate the directory (lib.dom's async iterator is async-iterable at runtime) */
    const dir = snapDir as unknown as AsyncIterable<[string, FileSystemHandle]>;
    for await (const [name, entry] of dir) {
      if (entry.kind === "file" && /^goalcheck-snap-\d{4}-\d{2}-\d{2}\.json$/.test(name)) {
        snaps.push({ name, date: name.slice(15, 25) });
      }
    }
    snaps.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
    for (const old of snaps.slice(keep)) {
      try { await snapDir.removeEntry(old.name); } catch { /* best effort */ }
    }
  } catch {
    /* snapshots are a resilience enhancement — never break the app */
  } finally {
    snapChecking = false;
  }
}
