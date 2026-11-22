/* =========================================================
   Passphrase policy — what a NEW vault / export passphrase must be.

   The .gcenc format is designed to be dropped into Dropbox, Drive or
   Nextcloud, so the passphrase is the only thing between that file and
   its contents: offline guessing is the threat model, not an attacker
   on the device. The KDF is PBKDF2-SHA256 at 310_000 iterations
   (crypto.ts) — sound, but it can only make each guess expensive, not
   a short guess impossible. Four characters is ~1.7M–14M candidates
   for lowercase+digits: minutes to hours on one GPU, which made the
   AES-256-GCM wrapper decorative.

   The floor applies ON CREATION ONLY. Opening, pulling or re-decrypting
   an existing vault must keep accepting whatever length it was created
   with, or the fix would lock users out of their own data. Write paths
   enforce it (writeNow fails closed), decrypt paths never consult it.
   ========================================================= */

export const PASSPHRASE_MIN_LENGTH = 12;

export type PassphraseRejection = "empty" | "tooShort";

export type PassphraseVerdict =
  | { ok: true; value: string; weak: boolean }
  | { ok: false; reason: PassphraseRejection; length: number };

/** Code-point length — an emoji or a Devanagari syllable is one character to the user. */
export function passphraseLength(value: string): number {
  return [...value].length;
}

/**
 * Validate a passphrase the user is about to encrypt something with.
 * Returns the trimmed value the caller must pass to encryptString —
 * trimming here (not at the call site) keeps the key and the policy
 * from disagreeing.
 */
export function checkNewPassphrase(raw: string): PassphraseVerdict {
  const value = (raw ?? "").trim();
  const length = passphraseLength(value);
  if (length === 0) return { ok: false, reason: "empty", length };
  if (length < PASSPHRASE_MIN_LENGTH) return { ok: false, reason: "tooShort", length };
  return { ok: true, value, weak: isWeak(value) };
}

/**
 * Advisory only — never blocks. A single lowercase word stays guessable
 * at any length, while a multi-word phrase ("correct horse battery") is
 * exactly what we want, so only the no-capital, no-digit, no-symbol,
 * no-space shape is flagged.
 */
function isWeak(value: string): boolean {
  if (/\p{Lu}/u.test(value)) return false;      // has an uppercase letter
  if (/[^\p{L}\p{N}\s]/u.test(value)) return false; // has a symbol/punctuation
  if (/\s/.test(value)) return false;          // multi-word phrase
  return true;
}
