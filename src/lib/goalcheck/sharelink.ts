/* =========================================================
   sharelink — local-first board share tokens (Task 17-e, schema v5).

   FORMAT
   - encode: JSON `{ v: 1, goal }` → UTF-8 bytes → gzip (when
     CompressionStream exists) → base64url → "GC1Z.<payload>"
     with a plain (uncompressed) fallback "GC1.<payload>".
   - decode: accepts a raw token OR a full URL (the token is extracted
     from a "#share=" or "?share=" parameter), base64url-decodes, and
     inflates when the "GC1Z." prefix is present.
   - Payloads are Unicode-safe (TextEncoder/TextDecoder with an inline
     fallback), URL-safe (base64url, no padding), and never contain
     attachment BYTES — attachment metadata may travel in the board JSON,
     but blobs live in the device's IndexedDB store and are not embedded.

   WHY A BUILT-IN INFLATE (instead of DecompressionStream)?
   - `decodeBoardShare` must be SYNCHRONOUS (returns `GoalBoard | null`,
     never throws — callers use it inside event handlers / hash parsing),
     while DecompressionStream is async-only (stream → Response →
     arrayBuffer). `decodeBoardShareAsync` would change the contract, so
     the ~120-line puff-style RFC 1951/1952 inflate below does the job
     synchronously on every platform, independent of stream support.
   - The ENCODE side still uses CompressionStream when available (native,
     fast) and falls back to "GC1." when missing or failing.

   OWNERSHIP / NON-GOALS
   - The codec does NOT normalize and does NOT resolve id collisions:
     it returns the decoded board as-is. `store.importSharedBoard()`
     normalizes, dedupes ids, activates and notifies.
   ========================================================= */

import type { GoalBoard } from "./types";

/** Tokens longer than this are refused by the UI (URL length limits). */
export const SHARE_MAX_TOKEN_CHARS = 30_000;

const GZIP_PREFIX = "GC1Z.";
const PLAIN_PREFIX = "GC1.";

/* ------------------------------------------------------------------ */
/* UTF-8 helpers (TextEncoder/TextDecoder with inline fallbacks so    */
/* the codec also works where the Encoding Standard API is missing).  */
/* ------------------------------------------------------------------ */

function utf8Encode(s: string): Uint8Array {
  if (typeof TextEncoder === "function") return new TextEncoder().encode(s);
  const bin = unescape(encodeURIComponent(s)); // legacy but universal escape helpers
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
  return out;
}

function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder === "function") return new TextDecoder().decode(bytes);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return decodeURIComponent(escape(bin)); // legacy but universal escape helpers
}

/* ------------------------------------------------------------------ */
/* base64url (RFC 4648 §5, unpadded)                                  */
/* ------------------------------------------------------------------ */

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(token: string): Uint8Array {
  let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const bin = atob(b64); // throws on invalid input → caught by decode
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/* ------------------------------------------------------------------ */
/* ENCODE — { v: 1, goal } → gzip? → base64url → prefixed token       */
/* ------------------------------------------------------------------ */

type GzipStreamCtor = new (format: string) => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array | null> {
  const CS = (globalThis as { CompressionStream?: unknown }).CompressionStream;
  if (typeof CS !== "function") return null;
  try {
    /* BodyInit typing: feed the bytes through a ReadableStream source */
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const gz = body.pipeThrough(new (CS as GzipStreamCtor)("gzip"));
    const buf = await new Response(gz).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null; // any compression failure → plain fallback
  }
}

/**
 * Serialize a board into a share token. NEVER mutates the board and
 * NEVER includes attachment blob bytes (they are not part of the JSON).
 */
export async function encodeBoardShare(goal: GoalBoard): Promise<string> {
  const json = JSON.stringify({ v: 1, goal });
  const bytes = utf8Encode(json);
  const gz = await gzipCompress(bytes);
  if (gz && gz.length > 0) return GZIP_PREFIX + bytesToBase64url(gz);
  return PLAIN_PREFIX + bytesToBase64url(bytes);
}

/* ------------------------------------------------------------------ */
/* DECODE — token | URL → GoalBoard | null (sync, never throws)       */
/* ------------------------------------------------------------------ */

/** Pull the token out of a raw token or a full URL. */
function extractShareToken(input: string): string {
  const s = (input ?? "").trim();
  if (!s) return "";
  for (const marker of ["#share=", "?share="]) {
    const at = s.indexOf(marker);
    if (at === -1) continue;
    let rest = s.slice(at + marker.length);
    /* token payload is base64url — stop at any query/HTML boundary */
    const cut = rest.search(/[&<>\s"']/);
    if (cut !== -1) rest = rest.slice(0, cut);
    try {
      return decodeURIComponent(rest);
    } catch {
      return rest; // not percent-encoded — use as-is
    }
  }
  return s; // assume the input itself is a raw token
}

/**
 * Structural validation ONLY (string id + string title + Array
 * categories). Deliberately shallow — deeper normalization (defaults,
 * dedupe, archived flag) is `importSharedBoard`'s job.
 */
function asGoalBoard(parsed: unknown): GoalBoard | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const g = parsed as { id?: unknown; title?: unknown; categories?: unknown };
  if (typeof g.id !== "string" || g.id.length === 0) return null;
  if (typeof g.title !== "string") return null;
  if (!Array.isArray(g.categories)) return null;
  return parsed as GoalBoard;
}

/**
 * Decode a share token (raw, or a full URL containing #share=/?share=).
 * Returns the decoded board as-is (id collisions are handled by the
 * importer, NOT here) or null on ANY failure. Never throws.
 */
export function decodeBoardShare(token: string): GoalBoard | null {
  try {
    if (typeof token !== "string") return null;
    const s = extractShareToken(token);
    if (!s) return null;

    let compressed = false;
    let payload: string;
    if (s.startsWith(GZIP_PREFIX)) {
      compressed = true;
      payload = s.slice(GZIP_PREFIX.length);
    } else if (s.startsWith(PLAIN_PREFIX)) {
      payload = s.slice(PLAIN_PREFIX.length);
    } else {
      return null;
    }
    if (!payload) return null;

    const bytes = base64urlToBytes(payload);
    if (!bytes.length) return null;

    const plain = compressed ? gunzipBytes(bytes) : bytes;
    if (!plain || !plain.length) return null;

    const parsed: unknown = JSON.parse(utf8Decode(plain));
    /* { v: 1, goal } envelope → unwrap; tolerate a bare board JSON too */
    const candidate =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as { v?: unknown; goal?: unknown }).v === 1 && "goal" in parsed
          ? (parsed as { goal: unknown }).goal
          : parsed
        : null;
    return asGoalBoard(candidate);
  } catch {
    return null;
  }
}

/**
 * Full share URL for a token. SSR/test-safe: without `window` it
 * degrades to a bare "#share=…" fragment.
 */
export function boardShareUrl(token: string): string {
  if (typeof window === "undefined") return `#share=${token}`;
  return `${window.location.origin}${window.location.pathname}#share=${token}`;
}

/* ================================================================== */
/* Synchronous gzip inflate (RFC 1951 DEFLATE inside RFC 1952 gzip).  */
/* Puff-style Huffman decoding — compact, allocation-light, no deps.  */
/* ================================================================== */

const MAXBITS = 15;

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface BitState {
  data: Uint8Array;
  pos: number;
  bitbuf: number;
  bitcnt: number;
}

interface Huff {
  count: number[];
  symbol: number[];
}

function readBits(st: BitState, need: number): number {
  let val = st.bitbuf;
  while (st.bitcnt < need) {
    if (st.pos >= st.data.length) throw new Error("inflate: unexpected end of input");
    val |= st.data[st.pos++] << st.bitcnt;
    st.bitcnt += 8;
  }
  st.bitbuf = val >>> need;
  st.bitcnt -= need;
  return val & ((1 << need) - 1);
}

function construct(lengths: number[]): Huff {
  const count = new Array(MAXBITS + 1).fill(0);
  for (let i = 0; i < lengths.length; i++) count[lengths[i]]++;
  if (count[0] === lengths.length) throw new Error("inflate: empty code");
  let left = 1;
  for (let len = 1; len <= MAXBITS; len++) {
    left = (left << 1) - count[len];
    if (left < 0) throw new Error("inflate: over-subscribed code");
  }
  const offs = new Array(MAXBITS + 1).fill(0);
  for (let len = 1; len < MAXBITS; len++) offs[len + 1] = offs[len] + count[len];
  const symbol: number[] = new Array(lengths.length);
  for (let s = 0; s < lengths.length; s++) if (lengths[s] !== 0) symbol[offs[lengths[s]]++] = s;
  return { count, symbol };
}

function decodeSym(st: BitState, h: Huff): number {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let len = 1; len <= MAXBITS; len++) {
    code |= readBits(st, 1);
    const count = h.count[len];
    if (code - count < first) return h.symbol[index + (code - first)];
    index += count;
    first = (first + count) << 1;
    code <<= 1;
  }
  throw new Error("inflate: invalid code");
}

interface Output {
  buf: Uint8Array;
  len: number;
  ensure(n: number): void;
}

function makeOutput(hint: number): Output {
  const out: Output = {
    buf: new Uint8Array(Math.max(256, hint)),
    len: 0,
    ensure(n: number) {
      if (out.len + n <= out.buf.length) return;
      let cap = out.buf.length * 2;
      while (cap < out.len + n) cap *= 2;
      const next = new Uint8Array(cap);
      next.set(out.buf.subarray(0, out.len));
      out.buf = next;
    },
  };
  return out;
}

function inflateCodes(st: BitState, litlen: Huff, dist: Huff, out: Output): void {
  for (;;) {
    const symbol = decodeSym(st, litlen);
    if (symbol < 256) {
      out.ensure(1);
      out.buf[out.len++] = symbol;
    } else if (symbol === 256) {
      return; // end of block
    } else {
      const li = symbol - 257;
      if (li >= LBASE.length) throw new Error("inflate: invalid length symbol");
      const length = LBASE[li] + readBits(st, LEXT[li]);
      const ds = decodeSym(st, dist);
      if (ds >= DBASE.length) throw new Error("inflate: invalid distance symbol");
      const distance = DBASE[ds] + readBits(st, DEXT[ds]);
      if (distance > out.len) throw new Error("inflate: distance too far back");
      out.ensure(length);
      for (let i = 0; i < length; i++) {
        out.buf[out.len] = out.buf[out.len - distance];
        out.len++;
      }
    }
  }
}

function fixedTrees(): [Huff, Huff] {
  const lit = new Array(288);
  for (let i = 0; i < 144; i++) lit[i] = 8;
  for (let i = 144; i < 256; i++) lit[i] = 9;
  for (let i = 256; i < 280; i++) lit[i] = 7;
  for (let i = 280; i < 288; i++) lit[i] = 8;
  const dist = new Array(30).fill(5);
  return [construct(lit), construct(dist)];
}

function inflateRaw(st: BitState, out: Output): void {
  const FIXED = fixedTrees();
  let last = 0;
  do {
    last = readBits(st, 1);
    const type = readBits(st, 2);
    if (type === 0) {
      /* stored block — discard partial bits, then LEN/NLEN + raw copy */
      st.bitbuf = 0;
      st.bitcnt = 0;
      if (st.pos + 4 > st.data.length) throw new Error("inflate: truncated stored block");
      const len = st.data[st.pos] | (st.data[st.pos + 1] << 8);
      const nlen = st.data[st.pos + 2] | (st.data[st.pos + 3] << 8);
      st.pos += 4;
      if ((len ^ 0xffff) !== nlen) throw new Error("inflate: stored length mismatch");
      if (st.pos + len > st.data.length) throw new Error("inflate: stored block overrun");
      out.ensure(len);
      out.buf.set(st.data.subarray(st.pos, st.pos + len), out.len);
      out.len += len;
      st.pos += len;
    } else if (type === 1) {
      inflateCodes(st, FIXED[0], FIXED[1], out);
    } else if (type === 2) {
      const nlen = readBits(st, 5) + 257;
      const ndist = readBits(st, 5) + 1;
      const ncode = readBits(st, 4) + 4;
      const clens = new Array(19).fill(0);
      for (let i = 0; i < ncode; i++) clens[CLEN_ORDER[i]] = readBits(st, 3);
      const clenTree = construct(clens);
      const lengths = new Array(nlen + ndist).fill(0);
      let idx = 0;
      while (idx < nlen + ndist) {
        const sym = decodeSym(st, clenTree);
        if (sym < 16) {
          lengths[idx++] = sym;
        } else {
          let val = 0;
          let rep = 0;
          if (sym === 16) {
            if (idx === 0) throw new Error("inflate: repeat with no previous length");
            val = lengths[idx - 1];
            rep = readBits(st, 2) + 3;
          } else if (sym === 17) {
            rep = readBits(st, 3) + 3;
          } else {
            rep = readBits(st, 7) + 11;
          }
          if (idx + rep > nlen + ndist) throw new Error("inflate: length repeat overrun");
          while (rep-- > 0) lengths[idx++] = val;
        }
      }
      if (lengths[256] === 0) throw new Error("inflate: missing end-of-block code");
      inflateCodes(st, construct(lengths.slice(0, nlen)), construct(lengths.slice(nlen)), out);
    } else {
      throw new Error("inflate: invalid block type");
    }
  } while (!last);
}

/** gzip (RFC 1952) container → DEFLATE → raw bytes; null on any failure. */
function gunzipBytes(raw: Uint8Array): Uint8Array | null {
  try {
    if (raw.length < 18) return null; // smallest possible gzip member
    if (raw[0] !== 0x1f || raw[1] !== 0x8b) return null; // magic
    if (raw[2] !== 8) return null; // must be DEFLATE
    const flg = raw[3];
    let pos = 10; // fixed header: magic(2) CM(1) FLG(1) MTIME(4) XFL(1) OS(1)
    if (flg & 0x04) {
      /* FEXTRA */
      if (pos + 2 > raw.length) return null;
      pos += 2 + (raw[pos] | (raw[pos + 1] << 8));
    }
    if (flg & 0x08) {
      /* FNAME */
      while (pos < raw.length && raw[pos] !== 0) pos++;
      pos++;
    }
    if (flg & 0x10) {
      /* FCOMMENT */
      while (pos < raw.length && raw[pos] !== 0) pos++;
      pos++;
    }
    if (flg & 0x02) pos += 2; /* FHCRC */
    if (pos >= raw.length - 8) return null;

    /* ISIZE (uncompressed size mod 2^32) — used only as an alloc hint */
    const isize =
      raw[raw.length - 4] |
      (raw[raw.length - 3] << 8) |
      (raw[raw.length - 2] << 16) |
      (raw[raw.length - 1] << 24);

    const st: BitState = { data: raw, pos, bitbuf: 0, bitcnt: 0 };
    const out = makeOutput(isize > 0 && isize < SHARE_MAX_TOKEN_CHARS * 8 ? isize : 1024);
    inflateRaw(st, out);
    return out.buf.subarray(0, out.len);
  } catch {
    return null;
  }
}
