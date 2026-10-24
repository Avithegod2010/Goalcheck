import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ATTACHMENTS_STORE, IDB_NAME, KV_STORE } from "@/lib/goalcheck/idb";
import { STORAGE_KEY } from "@/lib/goalcheck/types";

/*
 * IndexedDB engine tests (schema v5) — run against fake-indexeddb.
 * Every test fetches a FRESH module instance (vi.resetModules) so the
 * cached connection + one-time legacy-import flag reset deterministically.
 */

function wipeIdb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(IDB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => setTimeout(resolve, 50);
  });
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  await wipeIdb();
});

async function freshIdb() {
  vi.resetModules();
  return import("@/lib/goalcheck/idb");
}

describe("idb helpers (kv + attachments stores)", () => {
  it("creates both object stores on first open", async () => {
    const idb = await freshIdb();
    await idb.idbSet(KV_STORE, "warmup", "1"); // forces open + upgrade
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(IDB_NAME);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    expect(db.objectStoreNames.contains("kv")).toBe(true);
    expect(db.objectStoreNames.contains("attachments")).toBe(true);
    expect(db.version).toBe(1);
    db.close();
  });

  it("round-trips raw strings through the kv store (out-of-line keys)", async () => {
    const idb = await freshIdb();
    await idb.idbSet(KV_STORE, "goalcheck_pro_state", '{"state":{},"version":5}');
    expect(await idb.idbGet<string>(KV_STORE, "goalcheck_pro_state")).toBe('{"state":{},"version":5}');
    expect(await idb.idbGet(KV_STORE, "missing-key")).toBeNull();
  });

  it("deletes keys and lists the remaining ones", async () => {
    const idb = await freshIdb();
    await idb.idbSet(KV_STORE, "a", "1");
    await idb.idbSet(KV_STORE, "b", "2");
    await idb.idbSet(KV_STORE, "c", "3");
    expect(new Set((await idb.idbListKeys(KV_STORE)).map(String))).toEqual(new Set(["a", "b", "c"]));
    await idb.idbDelete(KV_STORE, "b");
    expect(new Set((await idb.idbListKeys(KV_STORE)).map(String))).toEqual(new Set(["a", "c"]));
    expect(await idb.idbGet(KV_STORE, "b")).toBeNull();
  });

  it("stores records by keyPath id in the attachments store", async () => {
    const idb = await freshIdb();
    await idb.idbSet(ATTACHMENTS_STORE, null, { id: "att_1", marker: "x" });
    await idb.idbSet(ATTACHMENTS_STORE, null, { id: "att_2", marker: "y" });
    expect(await idb.idbGet<{ id: string; marker: string }>(ATTACHMENTS_STORE, "att_1")).toMatchObject({ id: "att_1", marker: "x" });
    expect(new Set((await idb.idbListKeys(ATTACHMENTS_STORE)).map(String))).toEqual(new Set(["att_1", "att_2"]));
    await idb.idbDelete(ATTACHMENTS_STORE, "att_2");
    expect(await idb.idbGet(ATTACHMENTS_STORE, "att_2")).toBeNull();
  });

  it("overwrites the same kv key on repeated setItem", async () => {
    const idb = await freshIdb();
    await idb.idbSet(KV_STORE, "k", "first");
    await idb.idbSet(KV_STORE, "k", "second");
    expect(await idb.idbGet<string>(KV_STORE, "k")).toBe("second");
    expect(await idb.idbListKeys(KV_STORE)).toHaveLength(1);
  });
});

describe("idbStorage — zustand StateStorage adapter", () => {
  it("stores and returns raw strings (getItem/setItem/removeItem)", async () => {
    const idb = await freshIdb();
    expect(await idb.idbStorage.getItem(STORAGE_KEY)).toBeNull();
    await idb.idbStorage.setItem(STORAGE_KEY, '{"state":{"theme":"nebula"},"version":5}');
    expect(await idb.idbStorage.getItem(STORAGE_KEY)).toBe('{"state":{"theme":"nebula"},"version":5}');
    await idb.idbStorage.removeItem(STORAGE_KEY);
    expect(await idb.idbStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("ensureLegacyImport — one-time localStorage -> IDB copy", () => {
  it("copies the legacy payload into IDB and keeps the localStorage backup", async () => {
    const legacy = '{"state":{"theme":"sakura"},"version":4}';
    localStorage.setItem(STORAGE_KEY, legacy);
    const idb = await freshIdb();
    await idb.ensureLegacyImport();
    expect(await idb.idbGet<string>(KV_STORE, STORAGE_KEY)).toBe(legacy);
    expect(await idb.idbGet(KV_STORE, idb.LEGACY_IMPORT_MARKER)).toBeTruthy();
    // belt-and-braces: the localStorage copy is never deleted
    expect(localStorage.getItem(STORAGE_KEY)).toBe(legacy);
  });

  it("sets the marker even when there is nothing to import (fresh installs)", async () => {
    const idb = await freshIdb();
    await idb.ensureLegacyImport();
    expect(await idb.idbGet(KV_STORE, idb.LEGACY_IMPORT_MARKER)).toBeTruthy();
    expect(await idb.idbGet(KV_STORE, STORAGE_KEY)).toBeNull();
  });

  it("runs exactly once per IDB lifetime — later localStorage changes are ignored", async () => {
    const legacy = '{"state":{"theme":"first"},"version":4}';
    localStorage.setItem(STORAGE_KEY, legacy);
    const idb = await freshIdb();
    await idb.ensureLegacyImport();
    localStorage.setItem(STORAGE_KEY, '{"state":{"theme":"second"},"version":4}');
    await idb.ensureLegacyImport();
    expect(await idb.idbGet<string>(KV_STORE, STORAGE_KEY)).toBe(legacy);
  });

  it("re-imports the backup when IDB was wiped (marker gone) — self-healing", async () => {
    const legacy = '{"state":{"theme":"again"},"version":4}';
    localStorage.setItem(STORAGE_KEY, legacy);
    let idb = await freshIdb();
    await idb.ensureLegacyImport();
    await wipeIdb(); // user cleared site data but kept localStorage
    idb = await freshIdb();
    expect(await idb.idbGet<string>(KV_STORE, STORAGE_KEY)).toBeNull();
    await idb.ensureLegacyImport();
    expect(await idb.idbGet<string>(KV_STORE, STORAGE_KEY)).toBe(legacy);
  });
});
