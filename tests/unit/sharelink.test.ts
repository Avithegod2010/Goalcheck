import { afterAll, describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import {
  SHARE_MAX_TOKEN_CHARS, boardShareUrl, decodeBoardShare, encodeBoardShare,
} from "@/lib/goalcheck/sharelink";
import type { GoalBoard, Task } from "@/lib/goalcheck/types";

/*
 * Task 17-e — share-link codec (src/lib/goalcheck/sharelink.ts).
 *
 * The vitest jsdom environment has no CompressionStream/DecompressionStream
 * (like old browsers), so the PLAIN "GC1." fallback path is the default here.
 * Real gzip payloads are produced with node:zlib and fed through the "GC1Z."
 * decode path, which exercises the built-in synchronous inflate against an
 * INDEPENDENT gzip implementation. When the runtime DOES ship
 * CompressionStream (Node 18+/browsers), the encode-side gzip path is
 * asserted end-to-end as well.
 *
 * NOTE: id collisions are deliberately NOT the codec's problem — it returns
 * the decoded board verbatim; store.importSharedBoard() dedupes ids.
 */

function makeTask(text: string, i: number): Task {
  return {
    id: `task_${i}`,
    text,
    completed: i % 3 === 0,
    priority: i % 2 === 0 ? "high" : "normal",
    notes: "",
    status: i % 3 === 0 ? "done" : "todo",
    subtasks: [],
    pomosEstimate: 0,
    pomoCount: 0,
    dependsOn: "",
    dueDate: "",
    timeSpent: 0,
    recurrence: "none",
    respawnedFrom: "",
    completedAt: 0,
    estimate: 0,
    attachments: [],
    createdAt: 0,
  };
}

function makeBoard(title = "Ship the app 🚀 —ünïcodé 日本語"): GoalBoard {
  return {
    id: "goal_share_test_1",
    title,
    subtitle: "local-first share link",
    media: "mono:target-radar",
    archived: false,
    createdAt: 1_700_000_000_000,
    categories: [
      {
        id: "cat_1",
        title: "Setup -",
        media: "mono:clipboard-check",
        recurrence: "none",
        lastResetDate: "2024-01-01",
        lastWeekKey: "",
        items: [makeTask("write the tests ✅", 0), makeTask("review the codec", 1)],
      },
      {
        id: "cat_2",
        title: "Later -",
        media: "mono:clipboard-check",
        recurrence: "none",
        lastResetDate: "2024-01-01",
        lastWeekKey: "",
        items: [],
      },
    ],
  };
}

function b64url(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString("base64url");
}

const savedCS = globalThis.CompressionStream;

afterAll(() => {
  // restore whatever the environment had (vitest stubs are auto-reset too)
  vi.unstubAllGlobals();
  (globalThis as { CompressionStream?: unknown }).CompressionStream = savedCS;
});

describe("sharelink codec (Task 17-e)", () => {
  it("round-trips a unicode + emoji board through the plain fallback path", async () => {
    vi.stubGlobal("CompressionStream", undefined); // force jsdom-like fallback
    const board = makeBoard();
    const token = await encodeBoardShare(board);
    const out = decodeBoardShare(token);
    expect(out).not.toBeNull();
    expect(out?.id).toBe(board.id);
    expect(out?.title).toBe("Ship the app 🚀 —ünïcodé 日本語");
    expect(out?.subtitle).toBe(board.subtitle);
    expect(out?.categories).toHaveLength(2);
    expect(out?.categories[0].items[0].text).toBe("write the tests ✅");
  });

  it("falls back to the GC1. prefix when CompressionStream is missing, output is base64url", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    const token = await encodeBoardShare(makeBoard());
    expect(token.startsWith("GC1.")).toBe(true);
    expect(token).not.toMatch(/[+/=]/); // URL-safe, unpadded
  });

  it("prefers the GC1Z. gzip prefix when CompressionStream exists (end-to-end when real)", async () => {
    const hasRealCS = typeof globalThis.CompressionStream === "function";
    if (hasRealCS) {
      // env has native streams: full encode→decode round-trip through gzip+inflate
      const board = makeBoard();
      const token = await encodeBoardShare(board);
      expect(token.startsWith("GC1Z.")).toBe(true);
      const out = decodeBoardShare(token);
      expect(out?.id).toBe(board.id);
      expect(out?.title).toBe(board.title);
      expect(out?.categories[0].items[1].text).toBe("review the codec");
    } else {
      // jsdom: stub a CompressionStream whose output is non-empty but NOT a
      // real gzip member — proves the GC1Z. prefix is chosen whenever a
      // CompressionStream exists AND that decoding invalid gzip → null.
      class BogusGzip {
        readable = new ReadableStream<Uint8Array>({
          start(c) { c.enqueue(new Uint8Array([1, 2, 3, 4, 5])); c.close(); },
        });
        writable = new WritableStream<Uint8Array>();
        constructor(_: string) {}
      }
      vi.stubGlobal("CompressionStream", BogusGzip);
      const token = await encodeBoardShare(makeBoard());
      expect(token.startsWith("GC1Z.")).toBe(true);
      expect(decodeBoardShare(token)).toBeNull(); // defensive: bad gzip → null
    }
  });

  it("decodes real node-zlib gzip via the GC1Z. path (independent inflate check)", () => {
    const board = makeBoard();
    const gz = gzipSync(Buffer.from(JSON.stringify({ v: 1, goal: board }), "utf8"));
    const token = "GC1Z." + b64url(gz);
    const out = decodeBoardShare(token);
    expect(out).not.toBeNull();
    expect(out?.id).toBe(board.id);
    expect(out?.title).toBe(board.title);
    expect(out?.categories).toHaveLength(2);
    expect(out?.categories[0].items[1].text).toBe("review the codec");
  });

  it("inflate handles a larger multi-block gzip payload (dynamic huffman)", () => {
    const board = makeBoard("Big board");
    const cat = board.categories[0];
    for (let i = 0; i < 400; i++) {
      cat.items.push(makeTask(`task number ${i} with some repeated filler text ${i % 7}`, i + 10));
    }
    const gz = gzipSync(Buffer.from(JSON.stringify({ v: 1, goal: board }), "utf8"));
    const out = decodeBoardShare("GC1Z." + b64url(gz));
    expect(out?.categories[0].items).toHaveLength(402);
    expect(out?.categories[0].items[399].text).toBe("task number 397 with some repeated filler text 5");
  });

  it("decodes a token embedded in a full URL (#share= and ?share=)", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    const token = await encodeBoardShare(makeBoard());
    expect(decodeBoardShare(`https://app.example.com/dashboard#share=${token}`)?.id).toBe("goal_share_test_1");
    expect(decodeBoardShare(`https://app.example.com/?share=${token}`)?.id).toBe("goal_share_test_1");
    // stops cleanly at the next query parameter
    expect(decodeBoardShare(`https://x.test/#share=${token}&utm=mail`)?.id).toBe("goal_share_test_1");
  });

  it("unwraps the { v: 1, goal } envelope and tolerates a bare board JSON", () => {
    const board = makeBoard();
    const env = "GC1." + b64url(Buffer.from(JSON.stringify({ v: 1, goal: board }), "utf8"));
    const bare = "GC1." + b64url(Buffer.from(JSON.stringify(board), "utf8"));
    expect(decodeBoardShare(env)?.id).toBe(board.id);
    expect(decodeBoardShare(bare)?.id).toBe(board.id);
  });

  it("rejects garbage, empty input and broken payloads with null (never throws)", () => {
    expect(decodeBoardShare("")).toBeNull();
    expect(decodeBoardShare("totally not a token")).toBeNull();
    expect(decodeBoardShare("GC1.!!!not-base64!!!")).toBeNull();
    expect(decodeBoardShare("GC2.nope")).toBeNull(); // unknown prefix
    // valid base64 but not gzip
    expect(decodeBoardShare("GC1Z." + b64url(Buffer.from("this is not gzip data at all")))).toBeNull();
    expect(decodeBoardShare("GC1." + b64url(Buffer.from("{truncated json")))).toBeNull();
  });

  it("structural validation rejects non-board JSON ({foo:1}, strings, arrays)", () => {
    const tokenOf = (o: unknown) => "GC1." + b64url(Buffer.from(JSON.stringify(o), "utf8"));
    expect(decodeBoardShare(tokenOf({ foo: 1 }))).toBeNull();
    expect(decodeBoardShare(tokenOf("just a string"))).toBeNull();
    expect(decodeBoardShare(tokenOf([1, 2, 3]))).toBeNull();
    expect(decodeBoardShare(tokenOf({ id: "x", title: 7, categories: [] }))).toBeNull(); // title not string
    expect(decodeBoardShare(tokenOf({ id: "", title: "t", categories: [] }))).toBeNull(); // empty id
    expect(decodeBoardShare(tokenOf({ id: "x", title: "t" }))).toBeNull(); // categories missing
  });

  it("returns the decoded id verbatim — id collisions are the importer's job", () => {
    // If this board's id already exists in a workspace, decodeBoardShare still
    // returns it unchanged; store.importSharedBoard() dedupes on import.
    const board = makeBoard();
    const token = "GC1." + b64url(Buffer.from(JSON.stringify({ v: 1, goal: board }), "utf8"));
    expect(decodeBoardShare(token)?.id).toBe("goal_share_test_1");
  });

  it("boardShareUrl builds origin + pathname + #share= (and survives SSR)", () => {
    const url = boardShareUrl("TOK_EN");
    expect(url).toContain("#share=TOK_EN");
    expect(url.startsWith("http://localhost:3000/")).toBe(true); // vitest jsdom default
  });

  it("exports a sane SHARE_MAX_TOKEN_CHARS guard", () => {
    expect(SHARE_MAX_TOKEN_CHARS).toBeGreaterThan(0);
    expect(SHARE_MAX_TOKEN_CHARS).toBeLessThanOrEqual(100_000);
  });
});
