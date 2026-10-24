import { describe, expect, it, vi } from "vitest";
import {
  MAX_ATTACHMENT_BYTES, AttachmentValidationError, formatBytes, isImageMime,
  makeAttachment, validateFile,
} from "@/lib/goalcheck/attachment-ui";
import { MAX_ATTACHMENT_BYTES as STORE_MAX_ATTACHMENT_BYTES } from "@/lib/goalcheck/attachments";

/*
 * attachment-ui — pure helper tests (task 17-f).
 * Runs in jsdom, which provides the File constructor; no IndexedDB is
 * touched here (that's attachments.test.ts's job).
 */

function fileOf(name: string, size: number, type = "text/plain"): File {
  return new File([new Uint8Array(Math.max(0, size))], name, { type });
}

describe("validateFile", () => {
  it("accepts a normal small file (null = ok)", () => {
    expect(validateFile({ name: "notes.txt", size: 42 })).toBeNull();
  });

  it("accepts a file of EXACTLY 5 MB (boundary)", () => {
    expect(validateFile({ name: "big.bin", size: MAX_ATTACHMENT_BYTES })).toBeNull();
  });

  it("rejects a file 1 byte over the cap as tooLarge", () => {
    expect(validateFile({ name: "big.bin", size: MAX_ATTACHMENT_BYTES + 1 })).toBe("tooLarge");
  });

  it("rejects an empty file name as emptyName", () => {
    expect(validateFile({ name: "", size: 10 })).toBe("emptyName");
    expect(validateFile({ name: "   ", size: 10 })).toBe("emptyName");
  });
});

describe("formatBytes", () => {
  it("renders 0 (and junk) as 0 B", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });

  it("renders bytes without decimals", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("renders kilobytes with one decimal", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("renders megabytes with one decimal", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(5242880)).toBe("5.0 MB");
  });
});

describe("isImageMime", () => {
  it("accepts image/* mimes (case-insensitive)", () => {
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/svg+xml")).toBe(true);
    expect(isImageMime("IMAGE/JPEG")).toBe(true);
  });

  it("rejects non-image and empty mimes", () => {
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime("text/plain")).toBe(false);
    expect(isImageMime("")).toBe(false);
  });
});

describe("makeAttachment", () => {
  it("builds the meta shape from a File (jsdom File)", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const f = fileOf("photo.png", 2048, "image/png");
      const { meta, blob } = await makeAttachment(f);
      expect(meta.id).toMatch(/^att-[a-z0-9]+-[a-z0-9]{6}$/);
      expect(meta.name).toBe("photo.png");
      expect(meta.mime).toBe("image/png");
      expect(meta.size).toBe(2048);
      expect(meta.addedAt).toBe(now);
      expect(blob).toBe(f); // the File itself doubles as the Blob
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("falls back to application/octet-stream for typeless files", async () => {
    const f = new File([new Uint8Array(4)], "blob.bin");
    const { meta } = await makeAttachment(f);
    expect(meta.mime).toBe("application/octet-stream");
  });

  it("generates unique ids", async () => {
    const a = await makeAttachment(fileOf("a.txt", 1));
    const b = await makeAttachment(fileOf("b.txt", 1));
    expect(a.meta.id).not.toBe(b.meta.id);
  });

  it("throws AttachmentValidationError with token for an oversized file", async () => {
    const f = fileOf("huge.bin", MAX_ATTACHMENT_BYTES + 1);
    await expect(makeAttachment(f)).rejects.toBeInstanceOf(AttachmentValidationError);
    await expect(makeAttachment(f)).rejects.toMatchObject({ token: "tooLarge" });
  });

  it("throws with token emptyName for an unnamed file", async () => {
    await expect(makeAttachment(fileOf("", 1)))
      .rejects.toMatchObject({ token: "emptyName" });
  });
});

describe("cap parity", () => {
  it("MAX_ATTACHMENT_BYTES mirrors the storage-layer cap", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_ATTACHMENT_BYTES).toBe(STORE_MAX_ATTACHMENT_BYTES);
  });
});
