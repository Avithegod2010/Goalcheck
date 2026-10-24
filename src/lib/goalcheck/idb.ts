/* =========================================================
   GoalCheck — IndexedDB storage engine (schema v5)
   ---------------------------------------------------------
   Persistence for the workspace moved off localStorage in
   v5 (task 17-a). This module owns the ONE IndexedDB
   database used by the app:

     db:  "goalcheck-idb"  (version 1)
       kv           — out-of-line keys; holds raw JSON strings
                      (the zustand persist envelope lives here
                      under STORAGE_KEY, plus bookkeeping keys)
       attachments  — keyPath "id"; holds { id, blob } records
                      (see src/lib/goalcheck/attachments.ts)

   Exports:
     - idbStorage            — zustand createJSONStorage adapter
                               (async getItem/setItem/removeItem
                               over the `kv` store, storing raw
                               strings)
     - idbGet / idbSet / idbDelete / idbListKeys — generic
       helpers used by attachments.ts, migration and Data Doctor
     - ensureLegacyImport    — one-time belt-and-braces import of
       the pre-v5 localStorage payload into IDB (runs inside
       idbStorage.getItem, guarded by an IDB marker key; the
       localStorage copy is NEVER deleted)

   SSR safety: when `indexedDB` is undefined (server prerender,
   tests without an IDB impl) every helper degrades to a no-op —
   getItem resolves null, setters resolve, listKeys resolves [].
   ========================================================= */

import { STORAGE_KEY } from "./types";

export const IDB_NAME = "goalcheck-idb";
export const IDB_VERSION = 1;
export const KV_STORE = "kv";
export const ATTACHMENTS_STORE = "attachments";

export type IdbStoreName = typeof KV_STORE | typeof ATTACHMENTS_STORE;

/** kv key that records that the one-time localStorage import already ran. */
export const LEGACY_IMPORT_MARKER = "__legacy_localstorage_import_done";

/** True only when a real IndexedDB factory exists (browsers / workers). */
export function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

/* ---------- connection (single cached open) ---------- */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      let req: IDBOpenDBRequest;
      try {
        req = indexedDB.open(IDB_NAME, IDB_VERSION);
      } catch (e) {
        dbPromise = null;
        reject(e instanceof Error ? e : new Error("indexedDB.open threw"));
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
        if (!db.objectStoreNames.contains(ATTACHMENTS_STORE)) {
          db.createObjectStore(ATTACHMENTS_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        /* Another tab upgrading the schema, or an external deleteDatabase,
           asks this connection to close — honour it and reopen lazily. */
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error(`Could not open IndexedDB "${IDB_NAME}"`));
      };
    });
  }
  return dbPromise;
}

/* ---------- low-level helpers ---------- */

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}

/**
 * Read one value. Returns null when the key is missing (or when no
 * IndexedDB exists — SSR / plain-jsdom guard).
 */
export async function idbGet<T = unknown>(storeName: IdbStoreName, key: IDBValidKey): Promise<T | null> {
  if (!hasIndexedDB()) return null;
  const db = await openDb();
  const req = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
  const result = await requestToPromise(req);
  return (result === undefined ? null : result) as T | null;
}

/**
 * Write one value. `key === null` means "take the key from the record"
 * (for keyPath stores like `attachments`); every other store (`kv`)
 * uses out-of-line keys. No-op without IndexedDB.
 */
export async function idbSet(storeName: IdbStoreName, key: IDBValidKey | null, value: unknown): Promise<void> {
  if (!hasIndexedDB()) return;
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  const os = tx.objectStore(storeName);
  if (key === null) os.put(value);
  else os.put(value, key);
  await txDone(tx);
}

/** Delete one key. No-op without IndexedDB. */
export async function idbDelete(storeName: IdbStoreName, key: IDBValidKey): Promise<void> {
  if (!hasIndexedDB()) return;
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(key);
  await txDone(tx);
}

/** List every key in a store (Data Doctor / orphan sweeps). */
export async function idbListKeys(storeName: IdbStoreName): Promise<IDBValidKey[]> {
  if (!hasIndexedDB()) return [];
  const db = await openDb();
  const req = db.transaction(storeName, "readonly").objectStore(storeName).getAllKeys();
  return await requestToPromise(req);
}

/* ---------- one-time legacy localStorage import ---------- */

let legacyImportOnce: Promise<void> | null = null;

/**
 * Copy the pre-v5 localStorage payload (`goalcheck_pro_state`) into the
 * IDB `kv` store so existing users keep every byte after the v5 upgrade.
 *
 * - runs at most once per session AND at most once per IDB lifetime
 *   (guarded by LEGACY_IMPORT_MARKER inside IDB itself — if a user wipes
 *   IDB but keeps localStorage, the next run re-imports the backup);
 * - NEVER deletes the localStorage copy (belt-and-braces backup);
 * - swallows all errors so hydration can never be blocked by the import.
 */
export async function ensureLegacyImport(): Promise<void> {
  if (!hasIndexedDB() || typeof localStorage === "undefined") return;
  if (!legacyImportOnce) {
    legacyImportOnce = (async () => {
      try {
        if (await idbGet<string>(KV_STORE, LEGACY_IMPORT_MARKER)) return;
        const legacy = localStorage.getItem(STORAGE_KEY);
        if (legacy !== null) await idbSet(KV_STORE, STORAGE_KEY, legacy);
        await idbSet(KV_STORE, LEGACY_IMPORT_MARKER, new Date().toISOString());
      } catch {
        /* never block hydration over the belt-and-braces import */
      }
    })();
  }
  await legacyImportOnce;
}

/* ---------- zustand StateStorage adapter ---------- */

/**
 * Drop-in for `createJSONStorage(() => idbStorage)` — the async twin of
 * the old localStorage wrapper. Stores the persist envelope as a raw
 * JSON string in the `kv` store under STORAGE_KEY.
 */
export const idbStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!hasIndexedDB()) return null; // SSR / no-IDB guard
    await ensureLegacyImport(); // one-time localStorage -> IDB migration
    try {
      return await idbGet<string>(KV_STORE, key);
    } catch {
      return null; // degraded read must never break rehydration
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!hasIndexedDB()) return; // SSR / no-IDB guard: resolve no-op
    await idbSet(KV_STORE, key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (!hasIndexedDB()) return;
    await idbDelete(KV_STORE, key);
  },
};
