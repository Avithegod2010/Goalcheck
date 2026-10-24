import { describe, expect, it } from "vitest";
import {
  ATTACHMENTS_STORE, KV_STORE, hasIndexedDB, idbDelete, idbGet, idbListKeys,
  idbSet, idbStorage,
} from "@/lib/goalcheck/idb";
import {
  deleteAttachmentBlob, getAttachmentBlob, putAttachmentBlob, purgeOrphanAttachmentBlobs,
} from "@/lib/goalcheck/attachments";

/*
 * SSR / no-IndexedDB guard — the vitest jsdom environment has no
 * `indexedDB` global, exactly like server prerender. Every engine
 * entrypoint must degrade to a safe no-op instead of crashing.
 */

describe("idb engine without IndexedDB (SSR guard)", () => {
  it("reports that no IndexedDB exists", () => {
    expect(hasIndexedDB()).toBe(false);
  });

  it("adapter getItem resolves null", async () => {
    expect(await idbStorage.getItem("goalcheck_pro_state")).toBeNull();
  });

  it("adapter setters resolve without effect", async () => {
    await expect(idbStorage.setItem("goalcheck_pro_state", "{}")).resolves.toBeUndefined();
    await expect(idbStorage.removeItem("goalcheck_pro_state")).resolves.toBeUndefined();
  });

  it("helpers degrade to no-ops", async () => {
    expect(await idbGet(KV_STORE, "k")).toBeNull();
    await expect(idbSet(KV_STORE, "k", "v")).resolves.toBeUndefined();
    await expect(idbDelete(KV_STORE, "k")).resolves.toBeUndefined();
    expect(await idbListKeys(ATTACHMENTS_STORE)).toEqual([]);
  });

  it("attachment API fails soft: reject on put, null on get, 0 purged", async () => {
    await expect(putAttachmentBlob("att_x", new Blob(["hi"]))).rejects.toThrow(/unavailable/i);
    expect(await getAttachmentBlob("att_x")).toBeNull();
    await expect(deleteAttachmentBlob("att_x")).resolves.toBeUndefined();
    expect(await purgeOrphanAttachmentBlobs([])).toBe(0);
  });
});
