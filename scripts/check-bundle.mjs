#!/usr/bin/env node
/**
 * Bundle budget gate (task 17-g) — `node scripts/check-bundle.mjs`
 *
 * Measures the shipped client payload of a production Next.js build
 * (`NEXT_PUBLIC_GC_EDITION=pro bunx next build`, NO BUILD_TARGET=pages —
 * the standalone server build, no basePath).
 *
 * Strategy: the most robust zero-dependency proxy is to sum EVERY .js file
 * under `.next/static/chunks` (that directory holds all framework, app and
 * worker chunks the browser can ever fetch for this build, including
 * webpack runtime, polyfills and the framer-motion vendor chunk) plus every
 * .css under `.next/static/css`. `.next/build-manifest.json` is read to
 * report how many entry pages reference chunks, as a sanity signal that we
 * measured a real build.
 *
 * Budget history: 2.6 MB covers the ADVANCE edition — the app ships BOTH
 * the main chunks and the particle/worker chunks in that mode (see
 * src/lib/goalcheck/particles.ts), so the ceiling is deliberately generous.
 * Re-visit after code-splitting lands; tighten, don't loosen.
 *
 * Exit code: 0 under budget, 1 over budget or when no build was found.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/** Max total JS bytes across .next/static/chunks (2.6 MiB). */
const MAX_TOTAL_JS_BYTES = 2.6 * 1024 * 1024;
// CSS has no hard budget yet — reported for visibility only.
const NEXT_DIR = path.join(process.cwd(), ".next");
const CHUNKS_DIR = path.join(NEXT_DIR, "static", "chunks");
const CSS_DIR = path.join(NEXT_DIR, "static", "css");

/** Recursively collect [relativePath, bytes] for files ending in `ext`. */
async function collect(dir, ext, base = dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc; // dir missing → nothing to add
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collect(full, ext, base, acc);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      const { size } = await stat(full);
      acc.push([path.relative(base, full), size]);
    }
  }
  return acc;
}

function fmtBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

// ---------------------------------------------------------------- manifest
let manifest = null;
try {
  manifest = JSON.parse(await readFile(path.join(NEXT_DIR, "build-manifest.json"), "utf8"));
} catch {
  manifest = null;
}
const pageCount = manifest && manifest.pages ? Object.keys(manifest.pages).length : 0;

// ------------------------------------------------------------------- walk
const jsFiles = await collect(CHUNKS_DIR, ".js");
const cssFiles = await collect(CSS_DIR, ".css");

if (jsFiles.length === 0) {
  console.error(
    "\n✗ no JS chunks found under .next/static/chunks — run a production build first:\n" +
      "    NEXT_PUBLIC_GC_EDITION=pro bunx next build\n",
  );
  process.exit(1);
}

// ------------------------------------------------------- per-group table
// Group by first path segment under chunks/ (root chunks, app/, pages/, ...)
const groups = new Map();
let totalJs = 0;
for (const [rel, size] of jsFiles) {
  totalJs += size;
  const group = rel.includes(path.sep) ? rel.split(path.sep)[0] : "(root)";
  groups.set(group, (groups.get(group) ?? 0) + size);
}
const totalCss = cssFiles.reduce((sum, [, size]) => sum + size, 0);

const width = Math.max(...[...groups.keys()].map((g) => g.length), "(root)".length);
console.log("\nGoalCheck bundle budget — pro edition build");
console.log("=".repeat(56));
console.log(`${"chunk group".padEnd(width)}   files      bytes`);
console.log("-".repeat(56));
for (const [group, size] of [...groups.entries()].sort((a, b) => b[1] - a[1])) {
  const count = jsFiles.filter(([rel]) => (rel.includes(path.sep) ? rel.split(path.sep)[0] : "(root)") === group).length;
  console.log(`${group.padEnd(width)}   ${String(count).padStart(4)}   ${fmtBytes(size).padStart(10)}`);
}
console.log("-".repeat(56));
console.log(`${"TOTAL JS".padEnd(width)}   ${String(jsFiles.length).padStart(4)}   ${fmtBytes(totalJs).padStart(10)}`);
console.log(`${"TOTAL CSS (info only)".padEnd(width)}   ${String(cssFiles.length).padStart(4)}   ${fmtBytes(totalCss).padStart(10)}`);
console.log(
  `build-manifest.json: ${manifest ? `${pageCount} page entr${pageCount === 1 ? "y" : "ies"} referenced` : "NOT FOUND (continuing — chunk walk is the source of truth)"}`,
);

// ---------------------------------------------------------------- verdict
const budgetLabel = fmtBytes(MAX_TOTAL_JS_BYTES);
if (totalJs > MAX_TOTAL_JS_BYTES) {
  console.error(
    `\n✗ BUNDLE BUDGET EXCEEDED — ${fmtBytes(totalJs)} of JS > ${budgetLabel} budget\n` +
      `  (budget covers the advance edition: main chunks + workers).\n` +
      `  Split late-loaded code or lazy-load heavy widgets before loosening it.\n`,
  );
  process.exit(1);
}
console.log(`\n✓ within budget — ${fmtBytes(totalJs)} / ${budgetLabel} (${Math.round((totalJs / MAX_TOTAL_JS_BYTES) * 100)}% used)\n`);
