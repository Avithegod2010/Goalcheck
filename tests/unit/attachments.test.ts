import "fake-indexeddb/auto";
import { Blob as NodeBlob } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ATTACHMENTS_STORE, IDB_NAME, idbListKeys } from "@/lib/goalcheck/idb";
import {
  MAX_ATTACHMENT_BYTES, attachmentUrl, deleteAttachmentBlob, getAttachmentBlob,
  putAttachmentBlob, purgeOrphanAttachmentBlobs,
} from "@/lib/goalcheck/attachments";

/*
 * Attachment blob store tests (schema v5) — fake-indexeddb backend.
 * NOTE: Blobs must come from the Node realm (node:buffer) — jsdom-realm
 * Blobs do not survive fake-indexeddb's structured clone. In a real
 * browser the same API receives real DOM Blobs.
 */

function blobOf(content: string, type = "text/plain"): Blob {
  return new NodeBlob([content], { type }) as unknown as Blob;
}

function zeroBlob(bytes: number): Blob {
  return new NodeBlob([new Uint8Array(bytes)]) as unknown as Blob;
}

function wipeIdb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(IDB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => setTimeout(resolve, 50);
  });
}

beforeEach(async () => {
  localStorage.clear();
  await wipeIdb();
});

describe("attachment blob store", () => {
  it("round-trips a blob (bytes + mime + size)", async () => {
    await putAttachmentBlob("att_1", blobOf("hello attachments", "text/markdown"));
    const out = await getAttachmentBlob("att_1");
    expect(out).not.toBeNull();
    expect(out!.size).toBe(17);
    expect(out!.type).toBe("text/markdown");
    expect(await out!.text()).toBe("hello attachments");
  });

  it("returns null for unknown ids", async () => {
    expect(await getAttachmentBlob("nope")).toBeNull();
  });

  it("rejects blobs above the 5 MB cap and writes nothing", async () => {
    await expect(putAttachmentBlob("too-big", zeroBlob(MAX_ATTACHMENT_BYTES + 1))).rejects.toThrow(/too large/i);
    expect(await getAttachmentBlob("too-big")).toBeNull();
  });

  it("accepts a blob exactly at the 5 MB cap", async () => {
    await putAttachmentBlob("edge", zeroBlob(MAX_ATTACHMENT_BYTES));
    expect((await getAttachmentBlob("edge"))!.size).toBe(MAX_ATTACHMENT_BYTES);
  });

  it("rejects empty ids", async () => {
    await expect(putAttachmentBlob("", blobOf("x"))).rejects.toThrow(/id is required/i);
  });

  it("deletes blobs", async () => {
    await putAttachmentBlob("att_del", blobOf("bye"));
    await deleteAttachmentBlob("att_del");
    expect(await getAttachmentBlob("att_del")).toBeNull();
    await expect(deleteAttachmentBlob("att_del")).resolves.toBeUndefined(); // idempotent
  });

  it("keeps one record per meta id (re-put overwrites)", async () => {
    await putAttachmentBlob("a", blobOf("v1"));
    await putAttachmentBlob("b", blobOf("v2"));
    await putAttachmentBlob("a", blobOf("v3"));
    const keys = (await idbListKeys(ATTACHMENTS_STORE)).map(String);
    expect(new Set(keys)).toEqual(new Set(["a", "b"]));
    expect(await (await getAttachmentBlob("a"))!.text()).toBe("v3");
  });

  it("purges only orphaned blobs and returns the removed count", async () => {
    await putAttachmentBlob("keep-1", blobOf("a"));
    await putAttachmentBlob("orphan-1", blobOf("b"));
    await putAttachmentBlob("orphan-2", blobOf("c"));
    const purged = await purgeOrphanAttachmentBlobs(["keep-1", "meta-without-blob"]);
    expect(purged).toBe(2);
    expect(await getAttachmentBlob("keep-1")).not.toBeNull();
    expect(await getAttachmentBlob("orphan-1")).toBeNull();
    expect(await getAttachmentBlob("orphan-2")).toBeNull();
  });

  it("purges nothing when every blob is referenced", async () => {
    await putAttachmentBlob("a", blobOf("a"));
    await putAttachmentBlob("b", blobOf("b"));
    expect(await purgeOrphanAttachmentBlobs(["a", "b", "extra-meta"])).toBe(0);
    expect((await idbListKeys(ATTACHMENTS_STORE)).length).toBe(2);
  });

  it("attachmentUrl hands out an object URL for existing blobs only", async () => {
    const urlMock = vi.fn(() => "blob:mock-url");
    const holder = URL as unknown as Record<string, unknown>;
    const original = holder.createObjectURL;
    holder.createObjectURL = urlMock;
    try {
      await putAttachmentBlob("u1", blobOf("x"));
      expect(await attachmentUrl("u1")).toBe("blob:mock-url");
      expect(urlMock).toHaveBeenCalledTimes(1);
      expect(await attachmentUrl("missing")).toBeNull();
    } finally {
      if (original === undefined) delete holder.createObjectURL;
      else holder.createObjectURL = original;
    }
  });
});
