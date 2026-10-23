import type { MetadataRoute } from "next";

/*
 * PWA Web App Manifest — per-edition (GoalCheck / GoalCheck Advance).
 * start_url + scope honour the GitHub Pages basePath when the build was
 * made with BUILD_TARGET=pages (NEXT_PUBLIC_GC_BASE_PATH is injected by
 * next.config.ts). In dev / standalone / capacitor the base path is "".
 */

const IS_PRO = process.env.NEXT_PUBLIC_GC_EDITION !== "base";
const BASE = process.env.NEXT_PUBLIC_GC_BASE_PATH || "";

/* Required under `output: "export"` so the manifest route prerenders as a static file. */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE}/`,
    name: IS_PRO ? "GoalCheck Advance" : "GoalCheck",
    short_name: "GoalCheck",
    description: IS_PRO
      ? "Local-first multi-goal checklists, focus timer & analytics. No account, no network — your data stays on your device."
      : "Local-first multi-goal checklists & focus timer. No account, no network — your data stays on your device.",
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#060913",
    theme_color: "#060913",
    categories: ["productivity", "utilities"],
    /* v4.2 — PWA share target: "Share → GoalCheck" from other apps lands on
       start_url with ?title/&text/&url; page.tsx ingests them into the
       Quick Paste modal (native Android uses the SEND intent instead). */
    share_target: {
      action: `${BASE}/`,
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
    /* v4.3 — app shortcuts: long-press the installed icon to jump straight
       to a view (page.tsx ingests ?view= and setView clamps per edition). */
    shortcuts: [
      {
        name: IS_PRO ? "Week planner" : "Open GoalCheck",
        short_name: "Planner",
        url: `${BASE}/?view=week`,
        icons: [{ src: `${BASE}/icons/icon-192.png`, sizes: "192x192" }],
      },
      {
        name: "Month calendar",
        short_name: "Calendar",
        url: `${BASE}/?view=calendar`,
        icons: [{ src: `${BASE}/icons/icon-192.png`, sizes: "192x192" }],
      },
      {
        name: "Roadmap timeline",
        short_name: "Roadmap",
        url: `${BASE}/?view=timeline`,
        icons: [{ src: `${BASE}/icons/icon-192.png`, sizes: "192x192" }],
      },
    ],
    icons: [
      {
        src: `${BASE}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${BASE}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${BASE}/icons/icon-192-maskable.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${BASE}/icons/icon-512-maskable.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
