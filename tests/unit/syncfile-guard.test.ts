import { beforeEach, describe, expect, it } from "vitest";
import { decryptString } from "@/lib/goalcheck/crypto";
import { useStore } from "@/lib/goalcheck/goalcheck-exports";
import {
  linkSyncFile,
  setVaultPassphrase,
  unlinkSyncFile,
  writeNow,
} from "@/lib/goalcheck/syncfile";

/*
 * The sync-file writer is the only thing that produces vault ciphertext.
 * Two promises must hold at that boundary regardless of what the UI did:
 *   1. encryption enabled never writes plaintext into a .gcenc file (audit
 *      H1 — the old code fell through to the raw workspace JSON);
 *   2. no ciphertext is produced under a passphrase below the creation
 *      floor (audit M1 — the old floor was 4 characters, which the UI
 *      could still set, so the guard has to live in the writer too).
 * The passphrase is module-scoped session memory, so these tests drive the
 * real link -> write path with a stubbed File System Access picker.
 */

type Writes = string[];

function stubPicker(writes: Writes) {
  (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = async () => ({
    createWritable: async () => ({
      write: async (chunk: string) => { writes.push(chunk); },
      close: async () => {},
    }),
  });
}

beforeEach(() => {
  unlinkSyncFile();
  setVaultPassphrase(null);
  useStore.getState().setSyncFileEncrypted(false);
});

describe("sync-file writer guards", () => {
  it("writes plain JSON when vault mode is off", async () => {
    const writes: Writes = [];
    stubPicker(writes);
    expect(await linkSyncFile()).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].startsWith("gcenc1.")).toBe(false);
    expect(writes[0]).toContain('"goals"');
  });

  it("refuses to link an encrypted file with no passphrase", async () => {
    /* regression marker: pre-H1 this linked and wrote the plaintext
       workspace into goalcheck-vault.gcenc. */
    const writes: Writes = [];
    stubPicker(writes);
    useStore.getState().setSyncFileEncrypted(true);
    expect(await linkSyncFile()).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it("refuses to link an encrypted file under the old 4-character minimum", async () => {
    const writes: Writes = [];
    stubPicker(writes);
    useStore.getState().setSyncFileEncrypted(true);
    setVaultPassphrase("abcd");
    expect(await linkSyncFile()).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it("encrypts once the passphrase meets the floor, and the ciphertext decrypts", async () => {
    const writes: Writes = [];
    stubPicker(writes);
    useStore.getState().setSyncFileEncrypted(true);
    setVaultPassphrase("  correct horse battery  "); // trimmed by the setter
    expect(await linkSyncFile()).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].startsWith("gcenc1.")).toBe(true);
    expect(writes[0]).not.toContain('"goals"'); // no plaintext in the file
    const plain = await decryptString(writes[0], "correct horse battery");
    const parsed = JSON.parse(plain) as { state?: { goals?: unknown[] } };
    expect(Array.isArray(parsed.state?.goals)).toBe(true);
  });

  it("stops writing when the passphrase is cleared mid-session", async () => {
    const writes: Writes = [];
    stubPicker(writes);
    useStore.getState().setSyncFileEncrypted(true);
    setVaultPassphrase("correct horse battery");
    expect(await linkSyncFile()).toBe(true);
    expect(writes).toHaveLength(1);
    setVaultPassphrase(null);
    expect(await writeNow()).toBe(false);
    expect(writes).toHaveLength(1);
  });

  it("stops writing if a caller swaps in a weak passphrase after linking", async () => {
    const writes: Writes = [];
    stubPicker(writes);
    useStore.getState().setSyncFileEncrypted(true);
    setVaultPassphrase("correct horse battery");
    expect(await linkSyncFile()).toBe(true);
    setVaultPassphrase("abcd");
    expect(await writeNow()).toBe(false);
    expect(writes).toHaveLength(1);
  });
});
