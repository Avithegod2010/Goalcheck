#!/usr/bin/env node
/* =========================================================
   gen-brand-assets.mjs — the GoalCheck Android adaptive icon
   + splash, composed from the brand glyph (public/logo.svg).

   Outputs (into capacitor/assets/, consumed by @capacitor/assets):
     icon-foreground.png   1024×1024  white glyph inside the adaptive
                                    safe zone (inner 66% circle)
     icon-background.png   1024×1024  brand gradient (theme default)
     icon-only.png         1024×1024  rounded-square legacy icon
     splash.png            2732×2732  dark splash, centered glyph + glow
     splash-dark.png       2732×2732  same (dark is the only theme here)

   Prereq: `cd capacitor && bun install` (provides sharp via
   @capacitor/assets' dependency tree). Rerun after any brand change,
   then `bunx @capacitor/assets generate --android` inside capacitor/.
   ========================================================= */

import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "capacitor", "assets");

/* sharp lives in the capacitor sub-project's node_modules */
const requireFromCapacitor = createRequire(join(ROOT, "capacitor", "index.js"));
let sharp;
try {
  sharp = requireFromCapacitor("sharp");
} catch {
  console.error("✗ sharp not found — run:  cd capacitor && bun install");
  process.exit(1);
}

/* Brand glyph paths lifted verbatim from public/logo.svg (30×30 viewBox).
   The mark is the three-stroke "G" — reads perfectly in mono white. */
const GLYPH = `
  <path d="M15.47,7.1l-1.3,1.85c-0.2,0.29-0.54,0.47-0.9,0.47h-7.1V7.09C6.16,7.1,15.47,7.1,15.47,7.1z"/>
  <polygon points="24.3,7.1 13.14,22.91 5.7,22.91 16.86,7.1"/>
  <path d="M14.53,22.91l1.31-1.86c0.2-0.29,0.54-0.47,0.9-0.47h7.09v2.33H14.53z"/>`;

/* glyph bbox in the 30×30 viewBox: x 5.7→24.3 (w 18.6), y 7.09→22.91 (h 15.82) */
const GLYPH_W = 18.6;
const GLYPH_H = 15.82;

/** SVG group that centers the glyph at `targetW` px inside a `canvas` square. */
function glyphGroup(targetW, canvas) {
  const scale = targetW / 30;
  const cx = 15 * scale; // glyph center in the 30-viewBox is (15, 15)
  const tx = canvas / 2 - cx;
  const ty = canvas / 2 - cx;
  return `<g transform="translate(${tx},${ty}) scale(${scale})" fill="#ffffff">${GLYPH}</g>`;
}

const GRADIENT_DEFS = `
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="0.5" stop-color="#a855f7"/>
      <stop offset="1" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>`;

async function render(name, svg, width, height) {
  const out = join(ASSETS, name);
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(width, height, { fit: "fill" })
    .png()
    .toFile(out);
  console.log(`✓ ${name} (${width}×${height})`);
}

/* ---------- 1. adaptive foreground: glyph inside the safe zone ---------- */
/* safe zone = inner 66% circle → radius 337px. Glyph at 512px wide keeps
   its half-diagonal (√(256² + 218²) ≈ 336) just inside it. */
await render(
  "icon-foreground.png",
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${glyphGroup(512, 1024)}</svg>`,
  1024,
  1024
);

/* ---------- 2. adaptive background: brand gradient, full bleed ---------- */
await render(
  "icon-background.png",
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${GRADIENT_DEFS}<rect width="1024" height="1024" fill="url(#brand)"/></svg>`,
  1024,
  1024
);

/* ---------- 3. legacy / round icon: rounded square + glyph ---------- */
await render(
  "icon-only.png",
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
     ${GRADIENT_DEFS}
     <rect width="1024" height="1024" rx="190" fill="url(#brand)"/>
     ${glyphGroup(570, 1024)}
   </svg>`,
  1024,
  1024
);

/* ---------- 4. splash: dark canvas, glow, centered glyph ---------- */
const SPLASH = 2732;
const splashSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${SPLASH}" height="${SPLASH}" viewBox="0 0 ${SPLASH} ${SPLASH}">
    <defs>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#a855f7" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#a855f7" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${SPLASH}" height="${SPLASH}" fill="#060913"/>
    <circle cx="${SPLASH / 2}" cy="${SPLASH / 2}" r="640" fill="url(#glow)"/>
    ${glyphGroup(470, SPLASH)}
  </svg>`;
await render("splash.png", splashSvg, SPLASH, SPLASH);
await render("splash-dark.png", splashSvg, SPLASH, SPLASH);

/* ---------- sanity: verify foreground glyph is inside the safe zone ---------- */
const fg = join(ASSETS, "icon-foreground.png");
if (!existsSync(fg)) {
  console.error("✗ icon-foreground.png missing after render");
  process.exit(1);
}
const meta = await sharp(fg).metadata();
if (meta.width !== 1024 || meta.height !== 1024) {
  console.error("✗ unexpected foreground dimensions", meta.width, meta.height);
  process.exit(1);
}
console.log("\n✓ brand assets generated in capacitor/assets/ — next:");
console.log("  cd capacitor && bunx @capacitor/assets generate --android");
