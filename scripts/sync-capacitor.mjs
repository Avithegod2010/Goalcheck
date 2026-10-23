#!/usr/bin/env node
/**
 * sync-capacitor.mjs — bridge between the Next.js static export and the
 * Capacitor Android shell. Node builtins only (fs / path / child_process).
 *
 * Usage:
 *   node scripts/sync-capacitor.mjs advance   # GC_EDITION=pro  edition
 *   node scripts/sync-capacitor.mjs base      # GC_EDITION=base edition
 *
 * Wired as the second half of the root scripts:
 *   bun run build:capacitor:advance
 *   bun run build:capacitor:base
 *
 * What it does:
 *   1. Verifies out/index.html exists (i.e. `next build` with
 *      BUILD_TARGET=capacitor actually produced the static export).
 *   2. Replaces capacitor/www/ with a copy of out/.
 *   3. Makes sure capacitor/node_modules is installed (needed by cap CLI).
 *   4. If the native android/ project was scaffolded for a DIFFERENT edition
 *      (appId is baked into build.gradle / MainActivity package / strings.xml
 *      by `cap add`), regenerates it for the requested edition — including
 *      the zero-INTERNET manifest patch, the native glue re-injection
 *      (widget/tile/share, via scripts/native-glue.mjs) and icon/splash
 *      generation.
 *   5. Runs `cap sync android` (copies www → android assets, updates plugins).
 *   6. Re-applies the ZERO-INTERNET manifest patch (idempotent) and hard-fails
 *      if any INTERNET uses-permission survives, then re-injects the native
 *      glue (idempotent — custom Kotlin/XML sources are wiped by any regen).
 */

import { existsSync, mkdirSync, readFileSync, rmSync, cpSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { applyNativeGlue } from "./native-glue.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CAP = join(ROOT, "capacitor");
// Next 16 static export location depends on distDir:
//   custom distDir (`.next-capacitor`, set for BUILD_TARGET=capacitor) → export lands INSIDE it
//   default distDir (.next) → export lands in `out/`
const EXPORT_CANDIDATES = [join(ROOT, ".next-capacitor"), join(ROOT, "out")];
const WWW = join(CAP, "www");
const ANDROID = join(CAP, "android");
const MANIFEST = join(ANDROID, "app", "src", "main", "AndroidManifest.xml");

/** Must stay in sync with capacitor/capacitor.config.ts. */
const EDITIONS = {
  advance: { gcEdition: "pro", appId: "io.github.avithegod2010.goalcheckadvance", appName: "GoalCheck Advance" },
  base: { gcEdition: "base", appId: "io.github.avithegod2010.goalcheck", appName: "GoalCheck" },
};

const ZERO_INTERNET_MARKER = "ZERO-INTERNET GUARANTEE";

const ZERO_INTERNET_COMMENT = `<!--
  ═══════════════════════════════════════════════════════════════════════
  ZERO-INTERNET GUARANTEE — DO NOT RE-ADD INTERNET.

  GoalCheck's core privacy promise is that the app is LOCAL-ONLY: it
  never phones home, has no analytics, no telemetry, no remote config
  and no network access of any kind. Capacitor's default template adds
  \`android.permission.INTERNET\` so the WebView could load remote URLs;
  GoalCheck serves the entire UI from local assets, so the permission
  is deliberately REMOVED. With it gone, the OS makes "no network"
  technically true — not just a policy statement.

  Rules for every future change:
    1. NEVER add the INTERNET uses-permission element (android.permission.INTERNET)
       to this file — or via any Capacitor/Cordova plugin that declares
       it in its own manifest. Any plugin whose merged manifest requires
       INTERNET must be REJECTED (verify after every \`cap sync\` /
       dependency change with:
         aapt2 dump permissions app-debug.apk
       or Android Studio → APK Analyzer. Expect zero INTERNET entries).
    2. Runtime notification permissions (POST_NOTIFICATIONS, SCHEDULE_
       EXACT_ALARM, RECEIVE_BOOT_COMPLETED, VIBRATE) are merged in from
       @capacitor/local-notifications and are fine — they are local
       device features, not network access.
  ═══════════════════════════════════════════════════════════════════════
-->`;

function fail(msg) {
  console.error(`\n✗ sync-capacitor: ${msg}`);
  process.exit(1);
}

function run(cmd, { cwd = CAP, env = {} } = {}) {
  console.log(`\n$ (cwd: ${cwd}) ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd, env: { ...process.env, ...env } });
}

function log(step, msg) {
  console.log(`\n━━─ [${step}] ${msg}`);
}

/** Edition currently baked into android/app/build.gradle (or null). */
function bakedEdition() {
  if (!existsSync(join(ANDROID, "app", "build.gradle"))) return null;
  const gradle = readFileSync(join(ANDROID, "app", "build.gradle"), "utf8");
  for (const [key, ed] of Object.entries(EDITIONS)) {
    if (gradle.includes(`applicationId "${ed.appId}"`)) return key;
  }
  return "unknown";
}

/** Idempotently neutralize the template's ignores of cap-sync output.
 *
 * `cap add android` ships android/.gitignore with these lines ignored:
 *   capacitor-cordova-android-plugins / app/src/main/assets/public /
 *   app/src/main/assets/capacitor.config.json|capacitor.plugins.json /
 *   app/src/main/res/xml/config.xml
 * GoalCheck COMMITTS all of them (cap sync output) so the native shell builds
 * reproducibly with a plain `./gradlew assembleDebug`, without node/bun.
 * Must run after EVERY `cap add` (template regen restores the ignores).
 */
function patchAndroidGitignore() {
  const p = join(ANDROID, ".gitignore");
  if (!existsSync(p)) fail(`android/.gitignore not found at ${p}`);
  let gi = readFileSync(p, "utf8");
  const lines = [
    "capacitor-cordova-android-plugins",
    "app/src/main/assets/public",
    "app/src/main/assets/capacitor.config.json",
    "app/src/main/assets/capacitor.plugins.json",
    "app/src/main/res/xml/config.xml",
  ];
  let changed = false;
  for (const line of lines) {
    const re = new RegExp(`^${line.replace(/[/.]/g, "\\$&")}$`, "m");
    if (re.test(gi)) {
      gi = gi.replace(re, `# committed intentionally (cap sync output) — see scripts/sync-capacitor.mjs\n# ${line}`);
      changed = true;
    }
  }
  if (changed) writeFileSync(p, gi);
  console.log("✓ android/.gitignore: cap-sync output (assets/public, plugins, config) kept committed");
}

/** Idempotently remove INTERNET permission + insert explanation comment. */
function applyZeroInternetPatch() {
  if (!existsSync(MANIFEST)) fail(`AndroidManifest.xml not found at ${MANIFEST}`);
  let xml = readFileSync(MANIFEST, "utf8");

  // 1. Strip any INTERNET uses-permission element (all occurrences).
  const internetPerm = /^[ \t]*<uses-permission[^>]*android\.permission\.INTERNET[^>]*/gm;
  xml = xml.replace(internetPerm, "");

  // 2. Insert the explanation comment (once) right before </manifest>.
  if (!xml.includes(ZERO_INTERNET_MARKER)) {
    xml = xml.replace(/\s*<\/manifest>\s*$/, `\n    ${ZERO_INTERNET_COMMENT}\n</manifest>\n`);
  }

  writeFileSync(MANIFEST, xml);

  // 3. Hard assertion — never ship a shell that declares INTERNET.
  const final = readFileSync(MANIFEST, "utf8");
  if (/<uses-permission[^>]*INTERNET/.test(final)) {
    fail("AndroidManifest.xml still declares android.permission.INTERNET after patching — refusing to continue.");
  }
  console.log("✓ zero-internet patch verified (no INTERNET uses-permission in app manifest)");
}

// ─── main ────────────────────────────────────────────────────────────────

const edition = process.argv[2] ?? "advance";
const ed = EDITIONS[edition];
if (!ed) {
  fail(`unknown edition "${edition}" — expected "advance" or "base"`);
}
console.log(`sync-capacitor: edition="${edition}" (GC_EDITION=${ed.gcEdition}, appId=${ed.appId})`);

// 1. Static export must exist — locate it (custom distDir first, out/ fallback).
const OUT = EXPORT_CANDIDATES.find((dir) => existsSync(join(dir, "index.html")));
if (!OUT) {
  fail(
    `static export not found (looked in ${EXPORT_CANDIDATES.map((d) => d.replace(ROOT + "/", ""))}). Run it first, e.g.\n` +
      `  NEXT_PUBLIC_GC_EDITION=${ed.gcEdition} BUILD_TARGET=capacitor bunx next build`
  );
}
console.log(`sync-capacitor: using static export at ${OUT.replace(ROOT + "/", "")}`);

// 2. Replace capacitor/www with the fresh export (keep the .gitkeep).
log("www", `replacing capacitor/www with ${OUT.replace(ROOT + "/", "")}`);
rmSync(WWW, { recursive: true, force: true });
cpSync(OUT, WWW, { recursive: true });
writeFileSync(join(WWW, ".gitkeep"), "");

// 3. Ensure the Capacitor CLI is installed inside capacitor/ (its deps are
// deliberately independent of the web app's root package.json).
if (!existsSync(join(CAP, "node_modules", "@capacitor", "cli"))) {
  log("deps", "installing capacitor/node_modules (bun install)");
  run("bun install", { cwd: CAP });
}

// 4. Regenerate the native project if it was baked for another edition.
const baked = bakedEdition();
if (baked !== edition) {
  log("android", `android/ is ${baked ? `baked for "${baked}"` : "missing"} — regenerating for "${edition}"`);
  rmSync(ANDROID, { recursive: true, force: true });
  run("bunx cap add android", { env: { GC_EDITION: ed.gcEdition } });

  // `cap add` restores the template manifest with INTERNET — patch before icons.
  applyZeroInternetPatch();

  // `cap add` also wiped every custom native file — re-inject the widget /
  // tile / share glue (Kotlin sources, res XMLs, manifest + gradle patches).
  // Idempotent; parses applicationId so it bakes the right package per edition.
  log("glue", "re-injecting native glue (widget/tile/share) after regen");
  applyNativeGlue(ANDROID);

  patchAndroidGitignore();

  // Regenerate edition-independent icons/splash from capacitor/assets/.
  log("assets", "generating Android icons + splash from capacitor/assets/");
  run(
    "bunx @capacitor/assets generate --android " +
      "--iconBackgroundColor '#7c3aed' --iconBackgroundColorDark '#060913' " +
      "--splashBackgroundColor '#060913' --splashBackgroundColorDark '#060913'",
    { cwd: CAP }
  );
} else {
  log("android", `android/ already baked for "${edition}" — skipping regeneration`);
}

// 5. cap sync: www → android/app/src/main/assets/public + plugin update.
log("sync", "cap sync android");
run("bunx cap sync android", { env: { GC_EDITION: ed.gcEdition } });

// 6. Always re-verify the zero-internet guarantee (idempotent patch) and
//    keep the template .gitignore from excluding cap-sync output. Then make
//    sure the native glue is present (no-op when already injected).
log("manifest", "applying zero-internet patch");
applyZeroInternetPatch();
patchAndroidGitignore();

log("glue", "native glue applied (widget/tile/share)");
applyNativeGlue(ANDROID);

console.log(`
✓ sync-capacitor done:
  - capacitor/www/                 ← out/ (${edition})
  - android appId                  ← ${ed.appId} ("${ed.appName}")
  - android assets/public          ← synced via cap sync
  - native glue (widget/tile/share) ← re-injected via scripts/native-glue.mjs
  - INTERNET permission            ← absent (zero-internet guarantee)
Next: cd capacitor/android && ./gradlew assembleDebug
`);
