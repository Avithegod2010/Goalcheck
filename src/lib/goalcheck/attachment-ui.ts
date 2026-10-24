/* =========================================================
   GoalCheck — Attachment UI helpers (task 17-f)
   ---------------------------------------------------------
   Pure, unit-testable helpers backing the per-task file
   attachment UI on Checklist task rows:

     - validateFile   → stable reject token ("tooLarge" | "emptyName"),
                        the component maps tokens to t() keys;
     - makeAttachment → AttachmentMeta + blob pair ready for
                        putAttachmentBlob(meta.id, blob);
     - formatBytes    → "512 B" / "1.5 KB" / "1.0 MB" chip labels;
     - isImageMime    → whether a chip may render a thumbnail.

   Deliberately dependency-free (no idb / store imports) so the
   module stays pure: everything here is deterministic and
   testable without fake-indexeddb. The 5 MB cap mirrors
   MAX_ATTACHMENT_BYTES in attachments.ts — keep both in sync
   if the cap ever changes (enforced by tests).
   ========================================================= */

import type { AttachmentMeta } from "./types";

/** Hard cap for a single attachment (5 MB) — mirrors attachments.ts. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Stable reject tokens returned by validateFile; UI maps token → t() key. */
export type AttachmentRejectToken = "tooLarge" | "emptyName";

/** Error thrown by makeAttachment; carries the validateFile token. */
export class AttachmentValidationError extends Error {
  readonly token: AttachmentRejectToken;

  constructor(token: AttachmentRejectToken) {
    super(`attachment rejected: ${token}`);
    this.name = "AttachmentValidationError";
    this.token = token;
  }
}

/**
 * Validate a picked file BEFORE any bytes are touched.
 * Returns null when the file is acceptable, otherwise a stable reject
 * token ("tooLarge" | "emptyName") the caller translates for display.
 */
export function validateFile(f: { name: string; size: number }): AttachmentRejectToken | null {
  if (!f.name || f.name.trim() === "") return "emptyName";
  if (f.size > MAX_ATTACHMENT_BYTES) return "tooLarge";
  return null;
}

/**
 * Build the metadata descriptor + blob pair for one accepted file.
 * The blob is the File itself (a Blob subclass) — the caller stores it
 * via putAttachmentBlob(meta.id, blob). Throws AttachmentValidationError
 * (with the validateFile token) when the file must be rejected.
 */
export async function makeAttachment(file: File): Promise<{ meta: AttachmentMeta; blob: Blob }> {
  const token = validateFile(file);
  if (token) throw new AttachmentValidationError(token);
  const id = `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const meta: AttachmentMeta = {
    id,
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    addedAt: Date.now(),
  };
  return { meta, blob: file };
}

/**
 * Human byte size for attachment chips: B / KB / MB, one decimal,
 * dot separator, non-positive / non-finite → "0 B".
 */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** True when the MIME type renders as an <img> thumbnail in a chip. */
export function isImageMime(mime: string): boolean {
  return typeof mime === "string" && mime.toLowerCase().startsWith("image/");
}
