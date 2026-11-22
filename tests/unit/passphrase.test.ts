import { describe, expect, it } from "vitest";
import {
  PASSPHRASE_MIN_LENGTH,
  checkNewPassphrase,
  passphraseLength,
} from "@/lib/goalcheck/passphrase";

/*
 * Vault / export passphrase policy (audit M1).
 *
 * The .gcenc file and the encrypted export are designed to sit in a
 * third-party cloud folder, so the passphrase is the only thing between
 * that file and the whole workspace. PBKDF2-SHA256 at 310k iterations
 * makes each guess expensive but cannot make a 4-character guess
 * impossible — the old floor (`length < 4`) was the weak link, not the
 * cipher. These tests pin the floor, the trimming contract and the
 * advisory "weak" flag, and they never touch the decrypt path.
 */

describe("passphraseLength", () => {
  it("counts user-visible characters, not UTF-16 units", () => {
    expect(passphraseLength("abcd")).toBe(4);
    expect(passphraseLength("🔐🔐")).toBe(2);
    expect(passphraseLength("पासवर्ड")).toBe(7);
  });
});

describe("checkNewPassphrase", () => {
  it("keeps the documented floor at 12 characters", () => {
    expect(PASSPHRASE_MIN_LENGTH).toBe(12);
  });

  it("refuses a blank passphrase as empty rather than too short", () => {
    for (const raw of ["", "   ", "\t\n"]) {
      const verdict = checkNewPassphrase(raw);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.reason).toBe("empty");
    }
  });

  it("refuses the old 4-character minimum", () => {
    /* regression marker: `pass.trim().length < 4` accepted this, then
       encryptString() AES-GCM-wrapped the whole workspace with it — a GPU
       exhausts 4 lowercase characters in minutes. */
    const verdict = checkNewPassphrase("abcd");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe("tooShort");
      expect(verdict.length).toBe(4);
    }
  });

  it("accepts exactly the floor and refuses one character below it", () => {
    const atFloor = checkNewPassphrase("abcdefghijkl");
    expect(atFloor.ok).toBe(true);
    const below = checkNewPassphrase("abcdefghijk");
    expect(below.ok).toBe(false);
    if (!below.ok) expect(below.length).toBe(11);
  });

  it("measures code points, so emoji count as one character each", () => {
    expect(checkNewPassphrase("🔐".repeat(12)).ok).toBe(true);
    expect(checkNewPassphrase("🔐".repeat(11)).ok).toBe(false);
  });

  it("returns the trimmed value that the caller must encrypt with", () => {
    const verdict = checkNewPassphrase("  correct horse battery  ");
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.value).toBe("correct horse battery");
  });

  it("never hands back a value for a rejected passphrase", () => {
    const verdict = checkNewPassphrase("short");
    expect(verdict.ok).toBe(false);
    expect("value" in verdict).toBe(false);
  });

  it("leaves long multi-word phrases unflagged", () => {
    const verdict = checkNewPassphrase("correct horse battery");
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.weak).toBe(false);
  });

  it("does not flag a passphrase that adds capitals or symbols", () => {
    for (const pass of ["Correcthorsebattery", "correct-horse-battery", "correct horse 7"]) {
      const verdict = checkNewPassphrase(pass);
      expect(verdict.ok).toBe(true);
      if (verdict.ok) expect(verdict.weak).toBe(false);
    }
  });

  it("flags a single lowercase word (or digits only) even when long", () => {
    for (const pass of ["correcthorsebattery", "123456789012", "correcthorsebattery1"]) {
      const verdict = checkNewPassphrase(pass);
      expect(verdict.ok).toBe(true);
      if (verdict.ok) expect(verdict.weak).toBe(true);
    }
  });

  it("is advisory only — a weak passphrase is still accepted", () => {
    const verdict = checkNewPassphrase("correcthorsebattery");
    expect(verdict.ok).toBe(true);
  });
});
