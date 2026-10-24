/* =========================================================
   GoalCheck — Attachment blob store (schema v5)
   ---------------------------------------------------------
   Binary half of the v5 attachment feature: file BYTES live
   in the IndexedDB `attachments` store as { id, blob }
   records (keyPath "id"), while the workspace JSON carries
   only the lightweight AttachmentMeta descriptor on the task
   (see types.ts).

   Contract shared with the UI (task 17-b+):
     - putAttachmentBlob rejects above MAX_ATTACHMENT_BYTES
       (5 MB) BEFORE anything is written;
     - meta.id === blob key, so purgeOrphanAttachmentBlobs
       (Data Doctor) can sweep blobs whose meta no longer
       exists in any task;
     - attachmentUrl hands out an object URL — the CALLER owns
       it and must URL.revokeObjectURL it when done.
   ========================================================= */

import { ATTACHMENTS_STORE, hasIndexedDB, idbDelete, idbGet, idbListKeys, idbSet } from "./idb";

/** Hard cap for a single attachment blob (5 MB). */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

interface StoredAttachment {
  id: string;
  blob: Blob;
}

/** Store the bytes for one attachment under its meta id. */
export async function putAttachmentBlob(id: string, blob: Blob): Promise<void> {
  if (!id) throw new Error("putAttachmentBlob: attachment id is required.");
  if (blob.size > MAX_ATTACHMENT_BYTES) {
    const mb = (MAX_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0);
    throw new Error(`Attachment too large (${blob.size} bytes) — the limit is ${mb} MB.`);
  }
  if (!hasIndexedDB()) {
    throw new Error("Attachment storage is unavailable (IndexedDB missing).");
  }
  await idbSet(ATTACHMENTS_STORE, null, { id, blob } satisfies StoredAttachment);
}

/** Read one attachment blob (null when missing / no IndexedDB). */
export async function getAttachmentBlob(id: string): Promise<Blob | null> {
  if (!id || !hasIndexedDB()) return null;
  const rec = await idbGet<StoredAttachment | Blob>(ATTACHMENTS_STORE, id);
  if (rec === null) return null;
  /* records are { id, blob }; a bare Blob value means someone stored
     it without the wrapper — accept it instead of failing */
  if ("blob" in (rec as object)) return (rec as StoredAttachment).blob ?? null;
  return rec as Blob;
}

/** Delete one attachment blob (no-op when missing). */
export async function deleteAttachmentBlob(id: string): Promise<void> {
  if (!id || !hasIndexedDB()) return;
  await idbDelete(ATTACHMENTS_STORE, id);
}

/**
 * Object URL for one attachment, or null when the blob is missing.
 * The caller owns the URL — revoke it (URL.revokeObjectURL) to free memory.
 */
export async function attachmentUrl(id: string): Promise<string | null> {
  const blob = await getAttachmentBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/**
 * Data Doctor sweep: delete every blob whose id is NOT referenced by any
 * task's attachments meta. Returns the number of orphaned blobs removed.
 */
export async function purgeOrphanAttachmentBlobs(validIds: string[]): Promise<number> {
  if (!hasIndexedDB()) return 0;
  const valid = new Set(validIds);
  const keys = await idbListKeys(ATTACHMENTS_STORE);
  let purged = 0;
  for (const key of keys) {
    if (typeof key !== "string" || valid.has(key)) continue;
    await idbDelete(ATTACHMENTS_STORE, key);
    purged += 1;
  }
  return purged;
}
