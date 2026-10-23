"use client";

/* =========================================================
   v4.2 — Local crypto (WebCrypto, zero dependencies).

   Powers two features:
   - Encrypted export/import (.gcenc files)
   - Encrypted vault sync-file (auto-save through any
     user-owned cloud folder — Dropbox/Drive/Nextcloud —
     without the app itself ever touching a network)

   Format: "gcenc1.<b64 salt>.<b64 iv>.<b64 ciphertext>"
   KDF:    PBKDF2-SHA256, 310_000 iterations (OWASP 2023+)
   AEAD:   AES-GCM-256 (authenticates the whole payload)
   ========================================================= */

const ITERATIONS = 310_000;
const MAGIC = "gcenc1";

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("WebCrypto unavailable in this browser");
  return c.subtle;
}

/** True when the text looks like a GoalCheck encrypted payload. */
export function isEncryptedPayload(text: string): boolean {
  return typeof text === "string" && text.startsWith(MAGIC + ".");
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await subtle().importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt UTF-8 text with a passphrase → portable "gcenc1…" string. */
export async function encryptString(plain: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error("Passphrase required");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plain),
  );
  return `${MAGIC}.${toB64(salt)}.${toB64(iv)}.${toB64(ct)}`;
}

/** Decrypt a "gcenc1…" payload. Throws on wrong passphrase / tampering. */
export async function decryptString(payload: string, passphrase: string): Promise<string> {
  if (!isEncryptedPayload(payload)) throw new Error("Not a GoalCheck encrypted file");
  const [, saltB64, ivB64, ctB64] = payload.split(".");
  if (!saltB64 || !ivB64 || !ctB64) throw new Error("Corrupted encrypted file");
  const salt = fromB64(saltB64);
  const iv = fromB64(ivB64);
  const key = await deriveKey(passphrase, salt);
  const plain = await subtle().decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, fromB64(ctB64) as BufferSource);
  return new TextDecoder().decode(plain);
}
