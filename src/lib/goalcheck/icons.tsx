"use client";

/* =========================================================
   GoalCheck Pro — Custom MONO ANIMATED icon set
   ---------------------------------------------------------
   The app's own visual language: every "emoji" you see in the
   chrome is a hand-drawn single-colour SVG that inherits
   currentColor (so it always matches the active theme) and
   carries a looping micro-animation (stroke marching, flame
   flicker, steam rising, radar sweep...).

   Zero stock emoji anywhere in the UI. Fully offline, no fonts.
   ========================================================= */

import type { ReactNode } from "react";

export type GcIconGroup = "views" | "status" | "actions" | "objects" | "audio" | "rpg";

export interface GcIconDef {
  label: string;
  group: GcIconGroup;
  el: ReactNode;
}

/* Shorthand helpers keep the table readable */
const P = (d: string, key?: string, cls?: string) => (
  <path key={key} d={d} className={cls} />
);
const C = (cx: number, cy: number, r: number, key?: string, cls?: string) => (
  <circle key={key} cx={cx} cy={cy} r={r} className={cls} />
);
const R = (x: number, y: number, w: number, h: number, rx: number, key?: string, cls?: string) => (
  <rect key={key} x={x} y={y} width={w} height={h} rx={rx} className={cls} />
);
const L = (x1: number, y1: number, x2: number, y2: number, key?: string, cls?: string) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} className={cls} />
);

export const GC_ICONS = {
  /* ---------------- views & navigation ---------------- */
  "clipboard-check": { label: "Checklist", group: "views" as const, el: (<>{R(5, 3, 14, 18, 2, "r")}{R(9, 1.5, 6, 3.5, 1, "h")}{P("M9 13l2.2 2.2L15.5 11", "ck", "ia-check")}</>) },
  "kanban-cols": { label: "Kanban", group: "views" as const, el: (<>{R(3, 4, 5.5, 16, 1.5, "a")}{R(9.25, 4, 5.5, 11, 1.5, "b", "ia-slide2")}{R(15.5, 4, 5.5, 14, 1.5, "c", "ia-slide3")}</>) },
  "compass-needle": { label: "Matrix", group: "views" as const, el: (<>{C(12, 12, 9, "o")}<path d="M15.5 8.5l-2.2 5-5 2.2 2.2-5z" className="ia-swing" style={{ transformOrigin: "12px 12px" }} key="n" />{C(12, 12, 1, "c", "dot")}</>) },
  "network-nodes": { label: "Mind Map", group: "views" as const, el: (<>{C(12, 5, 2.6, "n1", "ia-twinkle")}{C(5.5, 17, 2.6, "n2")}{C(18.5, 17, 2.6, "n3", "ia-twinkle2")}{L(10.7, 7, 7, 15, "l1")}{L(13.3, 7, 17, 15, "l2")}{L(8.1, 17, 15.9, 17, "l3", "ia-dash")}</>) },
  "chart-bars": { label: "Analytics", group: "views" as const, el: (<>{L(3, 21, 21, 21, "base")}{R(5, 12, 3.5, 9, 1, "b1", "ia-slide1")}{R(10.2, 7, 3.5, 14, 1, "b2", "ia-slide2")}{R(15.5, 3, 3.5, 18, 1, "b3", "ia-slide3")}</>) },
  "hourglass-flow": { label: "Remaining", group: "views" as const, el: (<>{P("M6 3h12M6 21h12M7 3c0 4.5 3.5 6 5 9-1.5 3-5 4.5-5 9M17 3c0 4.5-3.5 6-5 9 1.5 3 5 4.5 5 9", "b")}{P("M10 6.5h4", "sand", "ia-dash")}</>) },
  "check-circle": { label: "Completed", group: "views" as const, el: (<>{C(12, 12, 9, "o")}{P("M8 12.5l2.8 2.8L16.5 9", "ck", "ia-check")}</>) },
  "calendar-tick": { label: "Calendar", group: "views" as const, el: (<>{R(3, 5, 18, 16, 2, "b")}{P("M8 3v4M16 3v4M3 10h18", "t")}{P("M9 15.5l2 2 4-4", "ck", "ia-check")}</>) },
  "clock-hand": { label: "Time", group: "views" as const, el: (<>{C(12, 12, 9, "o")}{L(12, 12, 12, 6.5, "h1")}{L(12, 12, 16.5, 13.5, "h2", "ia-hand")}</>) },
  "repeat-cycle": { label: "Recurring", group: "views" as const, el: (<>{P("M4 12a8 8 0 0 1 13.6-5.6L20 8.5M20 12a8 8 0 0 1-13.6 5.6L4 15.5", "loop", "ia-spin-slow")}{P("M20 4v4.5h-4.5M4 20v-4.5h4.5", "arrows")}</>) },
  "note-pen": { label: "Note", group: "views" as const, el: (<>{P("M5 4h11l3 3v13H5z", "b")}{P("M8.5 9.5h7M8.5 13h7M8.5 16.5h4", "lines", "ia-dash")}</>) },
  "folder-open": { label: "Folder", group: "views" as const, el: (<>{P("M3 6a1.5 1.5 0 0 1 1.5-1.5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 8.5V10H3z", "back")}{P("M3 10h18l-2 9.5H5z", "front", "ia-bob")}</>) },

  /* ---------------- status & priority ---------------- */
  "flame-ember": { label: "Streak", group: "status" as const, el: P("M12 22c4.4 0 7.5-3 7.5-7.2 0-3.6-2.4-6.2-4.3-8.6C13.6 4.2 12.6 2.6 12.5 1c-3 2-4 4.6-3.7 7C7.5 7 6.6 5.6 6.5 4 4.9 6 4.5 9 4.5 11.5 4.5 18.5 7.6 22 12 22z", "f", "ia-flicker") },
  "star-shine": { label: "High Priority", group: "status" as const, el: (<>{P("M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z", "s", "ia-twinkle")}{P("M19 3.5l.8 1.6M4.5 19.5l.8 1.6", "spark", "ia-twinkle2")}</>) },
  "zap-star": { label: "Energy", group: "status" as const, el: P("M13 2L4.5 13.5H11L9.5 22 19 10h-6.5L13 2z", "z", "ia-pulse") },
  "tomato-timer": { label: "Pomodoro", group: "status" as const, el: (<>{C(12, 14, 8, "b")}{P("M12 6c-.8-1.6.4-3 1.8-3.4M12 6c.5-2-1-3.5-3-3.8M12 6c1.5-1.5 3.5-1 4.5.5", "leaf", "ia-wobble")}{P("M9.5 12.2c.6-1 1.5-1.6 2.5-1.7", "shine", "ia-pulse")}</>) },
  "trophy-star": { label: "Trophy", group: "status" as const, el: (<>{P("M8 3h8v6a4 4 0 0 1-8 0V3z", "cup")}{P("M8 4H5a3 3 0 0 0 3 5M16 4h3a3 3 0 0 1-3 5M12 13v4M8 21h8M9 17h6", "st")}{P("M12 5.2l.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2.7-1.4z", "star", "ia-twinkle")}</>) },
  "party-pop": { label: "Celebrate", group: "status" as const, el: (<>{P("M5.5 14.5L9 21l5.5-8.5L11 9z", "cone", "ia-bob")}{P("M12.5 8.5l2-4M15 11l4-1.5M14.5 13.5l3.5 2", "rays", "ia-dash")}{C(17.5, 4.5, 1, "d1", "ia-twinkle")}{C(21, 14, 1, "d2", "ia-twinkle2")}{C(13, 2.8, 1, "d3", "ia-twinkle")}</>) },
  "gem-spark": { label: "Gem", group: "status" as const, el: (<>{P("M7 4h10l4 5-9 12L3 9z", "g")}{P("M3 9h18M9.5 9L12 21 14.5 9M7 4l2.5 5M17 4l-2.5 5", " facets", "ia-dash")}</>) },

  /* ---------------- actions ---------------- */
  "lock-shield": { label: "Lock", group: "actions" as const, el: (<>{R(5.5, 10, 13, 10, 2, "b")}{P("M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10", "sh", "ia-bob")}{C(12, 15, 1.4, "k", "dot")}</>) },
  "puzzle-piece": { label: "Micro-steps", group: "actions" as const, el: P("M9.5 3.5a2 2 0 0 1 4 0V5H17a2 2 0 0 1 2 2v3.5h-1.5a2 2 0 0 0 0 4H19V18a2 2 0 0 1-2 2h-3.5v-1.5a2 2 0 0 0-4 0V20H6a2 2 0 0 1-2-2v-3.5h1.5a2 2 0 0 0 0-4H4V7a2 2 0 0 1 2-2h3.5z", "p", "ia-wobble") },
  "broom-sweep": { label: "Clear Done", group: "actions" as const, el: (<>{P("M14.5 3.5l6 6-7.5 3.5-2-2z", "handle")}{P("M11 11l-5.5 5.5c-1.5 1.5-2 4.5-2 4.5s3-.5 4.5-2L13.5 13z", "bristles", "ia-swing")}<path d="M3.5 21c2-.5 4-1.5 5.5-3" key="s" className="ia-dash" /></>) },
  "image-pic": { label: "Customize", group: "actions" as const, el: (<>{R(3, 4, 18, 16, 2, "b")}{C(8.5, 9.5, 1.6, "sun", "ia-twinkle")}{P("M5 18l5-6 3.5 4 2.5-2.5 3 4.5", "mtn", "ia-dash")}</>) },
  "note-lines": { label: "Notes", group: "actions" as const, el: (<>{P("M6 3.5h12v17H6z", "b")}{P("M9 8h6M9 12h6M9 16h3.5", "l", "ia-dash")}</>) },
  "pencil-line": { label: "Edit", group: "actions" as const, el: (<>{P("M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z", "p")}{P("M14.5 6.5l3 3", "tip")}{L(4, 22, 20, 22, "u", "ia-dash")}</>) },
  "trash-flame": { label: "Delete", group: "actions" as const, el: (<>{P("M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l1 13h9l1-13", "b")}{P("M10 11v5.5M14 11v5.5", "l", "ia-pulse")}</>) },
  "plus-round": { label: "Add", group: "actions" as const, el: (<>{C(12, 12, 9, "o", "ia-breathe")}{P("M12 8v8M8 12h8", "p")}</>) },
  "undo-ccw": { label: "Undo", group: "actions" as const, el: (<>{P("M4 10h9a5.5 5.5 0 0 1 0 11H8", "arc", "ia-dash")}{P("M8 6l-4 4 4 4", "arrow")}</>) },
  "gear-wheel": { label: "Settings", group: "actions" as const, el: (<>{C(12, 12, 3.2, "hub")}<g className="ia-spin" key="teeth">{P("M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1", "t")}</g></>) },
  "sliders-tune": { label: "Tune", group: "actions" as const, el: (<>{P("M4 6h16M4 12h16M4 18h16", "rails")}{C(9, 6, 2, "k1", "ia-slide1")}{C(15, 12, 2, "k2", "ia-slide2")}{C(7, 18, 2, "k3", "ia-slide3")}</>) },

  /* ---------------- header / overlays ---------------- */
  "lotus-zen": { label: "Zen", group: "actions" as const, el: (<>{P("M12 20c-2.6-1.6-4-4-4-7 0-2.4 1.4-4.6 4-6.5 2.6 1.9 4 4.1 4 6.5 0 3-1.4 5.4-4 7z", "mid", "ia-breathe")}{P("M12 20c-4 0-7.5-1.6-9-4.5 2.5-1.6 5-2 7.5-.8M12 20c4 0 7.5-1.6 9-4.5-2.5-1.6-5-2-7.5-.8", "petals", "ia-wobble")}</>) },
  "contrast-half": { label: "Light / Dark", group: "actions" as const, el: (<>{C(12, 12, 9, "o")}<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" key="half" className="ia-pulse" /></>) },
  "command-key": { label: "Command", group: "actions" as const, el: (<>{P("M9 9V6a3 3 0 1 0-3 3h3zM15 9h3a3 3 0 1 0-3-3v3zM9 15H6a3 3 0 1 0 3 3v-3zM15 15v3a3 3 0 1 0 3-3h-3zM9 9h6v6H9z", "cmd")}</>) },
  "rocket-launch": { label: "Launch", group: "actions" as const, el: (<>{P("M12 2c3.5 2.2 5 5.8 5 9.5l-2.2 2.2h-5.6L7 11.5C7 7.8 8.5 4.2 12 2z", "body")}{C(12, 9, 1.6, "win", "ia-twinkle")}{P("M9.2 13.7L7 18l3-1 2 3 2-3 3 1-2.2-4.3", "fins", "ia-flicker")}</>) },
  "target-radar": { label: "Target", group: "actions" as const, el: (<>{C(12, 12, 9, "o")}{C(12, 12, 4.5, "m")}{L(12, 12, 19, 7, "sweep", "ia-dash")}{C(12, 12, 1, "c", "dot")}</>) },

  /* ---------------- objects (media picker + badges) ---------------- */
  "laptop-code": { label: "Laptop Code", group: "objects" as const, el: (<>{R(3, 4, 18, 12, 2, "scr")}{P("M2 20h20", "base")}{P("M9 8l-2.5 2L9 12M15 8l2.5 2L15 12M12.5 7.5l-1 5", "code", "ia-dash")}</>) },
  "phone-pulse": { label: "Phone", group: "objects" as const, el: (<>{R(7, 2.5, 10, 19, 2.5, "b")}{P("M10.5 5h3", "spk")}{C(12, 18.2, 1, "h", "ia-pulse")}</>) },
  "book-flutter": { label: "Study Book", group: "objects" as const, el: (<>{P("M2 5.5A2.5 2.5 0 0 1 4.5 3H11v16H4.5A2.5 2.5 0 0 0 2 21.5v-16z", "l")}{P("M22 5.5A2.5 2.5 0 0 0 19.5 3H13v16h6.5a2.5 2.5 0 0 1 2.5 2.5v-16z", "r", "ia-wobble")}</>) },
  "luggage-trip": { label: "Travel", group: "objects" as const, el: (<>{R(5, 7, 14, 13, 2.5, "b")}{P("M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M9.5 11v5M14.5 11v5", "d", "ia-bob")}</>) },
  "doc-lines": { label: "Document", group: "objects" as const, el: (<>{P("M6 3h8l4 4v14H6z", "b")}{P("M14 3v4h4", "fold")}{P("M9 12h6M9 15.5h6M9 19h3.5", "l", "ia-dash")}</>) },
  "shirt-fold": { label: "Clothes", group: "objects" as const, el: (<>{P("M8.5 3.5L12 6l3.5-2.5L20 6l-1.5 4-2-1v11h-9V9l-2 1L4 6z", "s", "ia-bob")}</>) },
  "drop-care": { label: "Toiletries", group: "objects" as const, el: (<>{P("M9 2.5h6M10 2.5v4L6.8 12a5.5 5.5 0 1 0 10.4 0L14 6.5v-4", "b")}{P("M8 15.5c.5-1 1.3-1.7 2.3-2", "shine", "ia-pulse")}</>) },
  "tools-wrench": { label: "Build", group: "objects" as const, el: (<>{P("M14.5 6.5a4 4 0 0 1 5-3.9l-3 3 .9 2.9 3 .9 3-3a4 4 0 0 1-5.4 4.8L8 20.6a2 2 0 0 1-2.8-2.8z", "w", "ia-wobble")}</>) },
  "headphones-beat": { label: "Music", group: "objects" as const, el: (<>{P("M4 17v-4a8 8 0 0 1 16 0v4", "band")}{R(3, 14, 4.5, 7, 2, "e1", "ia-pulse")}{R(16.5, 14, 4.5, 7, 2, "e2", "ia-pulse2")}</>) },
  "dumbbell-lift": { label: "Fitness", group: "objects" as const, el: (<>{P("M2.5 12h2M19.5 12h2M6.5 12h11", "bar")}{R(4.5, 8, 2.5, 8, 1, "p1", "ia-bob")}{R(17, 8, 2.5, 8, 1, "p2", "ia-bob")}</>) },
  "palette-dab": { label: "Art", group: "objects" as const, el: (<>{P("M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.6-2-.5-1.3.4-2.5 2-2.5H18a3.5 3.5 0 0 0 3-3.5C21 7 17 3 12 3z", "p", "ia-wobble")}{C(7.5, 10.5, 1.2, "d1", "ia-twinkle")}{C(11, 7.5, 1.2, "d2")}{C(15.5, 8.5, 1.2, "d3", "ia-twinkle2")}</>) },
  "gamepad-play": { label: "Games", group: "objects" as const, el: (<>{P("M7 8h10a5 5 0 0 1 5 5.5c-.2 2-1.5 3.5-3.2 3.5-1.2 0-2-.6-2.8-1.5h-8c-.8.9-1.6 1.5-2.8 1.5C3.5 17 2.2 15.5 2 13.5A5 5 0 0 1 7 8z", "b", "ia-bob")}{P("M8 11v4M6 13h4", "dpad", "ia-blink")}{C(16, 12, 1, "b1", "ia-blink2")}{C(18.2, 14, 1, "b2", "ia-blink")}</>) },
  "apple-bite": { label: "Health", group: "objects" as const, el: (<>{P("M12 7c-1-.8-2.2-1.2-3.5-1C6 6.4 4.5 8.6 4.7 11.5c.2 3.4 2.4 7.5 4.8 7.5 1 0 1.6-.6 2.5-.6s1.5.6 2.5.6c2.4 0 4.6-4.1 4.8-7.5.2-2.9-1.3-5.1-3.8-5.5-1.3-.2-2.5.2-3.5 1z", "b", "ia-bob")}{P("M12 7c0-2 1.2-3.5 3-4", "stem", "ia-wobble")}</>) },
  "home-hearth": { label: "Home", group: "objects" as const, el: (<>{P("M4 11l8-7.5L20 11M6 9.5V20h12V9.5", "h", "ia-breathe")}{P("M10 20v-5.5h4V20", "door")}</>) },
  "cart-shop": { label: "Shopping", group: "objects" as const, el: (<>{P("M3 4h2.5l2.2 11.5h10.8L21 8H6.2", "c", "ia-drift")}{C(9.5, 20, 1.6, "w1", "ia-slide1")}{C(17, 20, 1.6, "w2", "ia-slide2")}</>) },
  "key-door": { label: "Access", group: "objects" as const, el: (<>{C(8, 8, 4.5, "bow")}{C(8, 8, 1.5, "hole")}{P("M11 11l8.5 8.5M16 16l2.5-2.5M19 19l2-2", "teeth", "ia-swing")}</>) },
  "pill-capsule": { label: "Health Kit", group: "objects" as const, el: (<>{R(3, 9, 18, 7, 3.5, "b", "ia-wobble")}{L(12, 9, 12, 16, "mid")}</>) },
  "wave-ocean": { label: "Waves", group: "objects" as const, el: (<>{P("M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2", "w1", "ia-wave")}{P("M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2", "w2", "ia-wave2")}{P("M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2", "w3", "ia-wave")}</>) },
  "brain-cube": { label: "Brain Power", group: "objects" as const, el: (<>{P("M9.5 3A3.5 3.5 0 0 0 6 6.5c-1.8.6-3 2.2-3 4.1 0 1.2.5 2.3 1.3 3.1-.2.5-.3 1-.3 1.6A4.2 4.2 0 0 0 8.2 19c.6 1.2 1.9 2 3.3 2V3.4A3.4 3.4 0 0 0 9.5 3z", "l")}{P("M14.5 3A3.5 3.5 0 0 1 18 6.5c1.8.6 3 2.2 3 4.1 0 1.2-.5 2.3-1.3 3.1.2.5.3 1 .3 1.6A4.2 4.2 0 0 1 15.8 19c-.6 1.2-1.9 2-3.3 2", "r", "ia-pulse")}</>) },
  "seed-grow": { label: "Growth", group: "objects" as const, el: (<>{L(12, 21, 12, 13, "stem")}{P("M12 13c0-4 2.5-7 7-7 0 4-2.5 7-7 7z", "r", "ia-breathe")}{P("M12 13c0-3-2-5.5-5.5-5.5 0 3 2 5.5 5.5 5.5z", "l")}{L(7, 21, 17, 21, "ground")}</>) },
  "music-wave": { label: "Music Wave", group: "objects" as const, el: (<>{P("M9 18V6l10-2v11", "beam")}{C(6.5, 18, 2.5, "n1", "ia-bob")}{C(16.5, 15, 2.5, "n2", "ia-bob")}{P("M2.5 12h2M19.5 8h2", "eq", "ia-pulse")}</>) },
  "briefcase-check": { label: "Work", group: "objects" as const, el: (<>{R(3, 7, 18, 13, 2, "b")}{P("M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "h")}{P("M9 13.5l2 2 4-4", "ck", "ia-check")}</>) },
  "coffee-steam": { label: "Coffee", group: "objects" as const, el: (<>{P("M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z", "cup")}{P("M16 10h2.5a2.5 2.5 0 0 1 0 5H16", "handle")}{P("M8 2.5c1 1-1 2 0 3M12 2.5c1 1-1 2 0 3", "steam", "ia-rise")}</>) },
  "bike-wheel": { label: "Motion", group: "objects" as const, el: (<>{C(12, 12, 9, "rim")}<g className="ia-spin" key="spokes">{P("M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4", "s")}</g>{C(12, 12, 2.4, "hub", "dot")}</>) },
  "plane-orbit": { label: "Flight", group: "objects" as const, el: (<>{C(12, 12, 3, "core", "dot")}{P("M12 3a9 9 0 0 1 9 9", "orbit", "ia-dash")}{P("M3.5 13.5L10 11l2.5-6.5L14 11l6.5 2.5L14 16l-1.5 6.5L10 16z", "plane", "ia-spin-slow")}</>) },
  "camera-flash": { label: "Capture", group: "objects" as const, el: (<>{P("M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z", "b")}{C(12, 13, 3.5, "lens", "ia-twinkle")}</>) },
  "bulb-glow": { label: "Idea", group: "objects" as const, el: (<>{P("M9 18h6M10 21h4", "base")}{P("M12 3a6 6 0 0 1 3.6 10.8c-.7.6-1.1 1.3-1.1 2.2h-5c0-.9-.4-1.6-1.1-2.2A6 6 0 0 1 12 3z", "b", "ia-breathe")}</>) },
  "globe-orbit": { label: "Global", group: "objects" as const, el: (<>{C(12, 12, 8.5, "g")}{P("M3.5 12h17M12 3.5c2.7 2.3 4 5.2 4 8.5s-1.3 6.2-4 8.5c-2.7-2.3-4-5.2-4-8.5s1.3-6.2 4-8.5z", "meridians")}{C(19, 6.5, 1.6, "moon", "ia-twinkle")}</>) },
  "chat-bell": { label: "Chat", group: "objects" as const, el: (<>{P("M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12z", "b")}{P("M9 12h.01M13 12h.01M17 12h.01", "dots", "ia-blink")}</>) },
  "shield-lock": { label: "Secure", group: "objects" as const, el: (<>{P("M12 2l8 3.5V11c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5.5L12 2z", "s", "ia-breathe")}{P("M12 8v4", "k")}{C(12, 13.5, 1.4, "k2", "dot")}</>) },

  /* ---------------- audio studio ---------------- */
  "drum-beat": { label: "Lo-Fi Beat", group: "audio" as const, el: (<>{P("M4 9c0-1.7 3.6-3 8-3s8 1.3 8 3v8c0 1.7-3.6 3-8 3s-8-1.3-8-3z", "d")}{P("M4 9c0 1.7 3.6 3 8 3s8-1.3 8-3", "top")}{P("M7 12.5v6.2M17 12.5v6.2", "legs")}{P("M20 3l-3.5 3.5", "stick", "ia-shake")}</>) },
  "piano-keys": { label: "Piano", group: "audio" as const, el: (<>{R(3, 5, 18, 14, 1.5, "b")}{L(9, 5, 9, 13, "k1", "ia-press")}{L(15, 5, 15, 13, "k2", "ia-press2")}{L(12, 5, 12, 13, "k3", "ia-press3")}</>) },
  "cloud-rain": { label: "Rain", group: "audio" as const, el: (<>{P("M7 15a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18 7.5 4 4 0 0 1 17.5 15H7z", "c", "ia-drift")}{P("M8.5 18l-1 3M12.5 18l-1 3M16.5 18l-1 3", "drops", "ia-rise")}</>) },
  "mic-live": { label: "Live Input", group: "audio" as const, el: (<>{R(9, 3, 6, 11, 3, "m", "ia-breathe")}{P("M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6", "s")}</>) },
  "wave-sound": { label: "Sound", group: "audio" as const, el: (<>{P("M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3", "bars", "ia-eq")}</>) },

  /* ---------------- rpg ---------------- */
  "link-combo": { label: "Combo", group: "rpg" as const, el: (<>{P("M9.5 14.5l5-5", "mid")}{P("M13 7l1.5-1.5a3.2 3.2 0 0 1 4.5 4.5L17.5 11.5M11 17l-1.5 1.5a3.2 3.2 0 0 1-4.5-4.5L6.5 12.5", "l", "ia-pulse")}</>) },
  "clover-lucky": { label: "Lucky", group: "rpg" as const, el: (<>{P("M12 12c-1.5-3-6-3.5-6-6a3 3 0 0 1 6-.8A3 3 0 0 1 18 6c0 2.5-4.5 3-6 6zM12 12c1.5 3 6 3.5 6 6a3 3 0 0 1-6 .8A3 3 0 0 1 6 18c0-2.5 4.5-3 6-6z", "c", "ia-wobble")}</>) },
  "bolt-boost": { label: "XP Boost", group: "rpg" as const, el: (<>{P("M13 2L4.5 13.5H11L9.5 22 19 10h-6.5L13 2z", "b", "ia-pulse")}{P("M4 4l.7 1.4M20 19l.7 1.4", "sp", "ia-twinkle")}</>) },
  "shield-guard": { label: "Streak Shield", group: "rpg" as const, el: (<>{P("M12 2l8 3.5V11c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5.5L12 2z", "s", "ia-breathe")}{P("M9 11.5l2 2 4-4", "ck", "ia-check")}</>) },
  "time-lord": { label: "Time Lord", group: "rpg" as const, el: (<>{C(12, 13, 8, "o")}{L(12, 13, 12, 8.5, "h1")}{L(12, 13, 15.5, 14, "h2", "ia-hand")}{P("M9 2.5h6", "top", "ia-bob")}</>) },
  "key-point": { label: "Skill Point", group: "rpg" as const, el: (<>{C(8, 8, 4.5, "bow", "ia-twinkle")}{C(8, 8, 1.5, "hole")}{P("M11 11l8.5 8.5M16 16l2.5-2.5M19 19l2-2", "teeth")}</>) },
} satisfies Record<string, GcIconDef>;

export type GcIconName = keyof typeof GC_ICONS;

/* ---------- React renderer ---------- */

export function isGcIconName(name: string): name is GcIconName {
  return Object.prototype.hasOwnProperty.call(GC_ICONS, name);
}

export function GcIcon({
  name, size = 20, className = "", strokeWidth, label,
}: { name: string; size?: number; className?: string; strokeWidth?: number; label?: string }) {
  const def = isGcIconName(name) ? GC_ICONS[name] : GC_ICONS["clipboard-check"];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`gc-icon ${className}`}
      strokeWidth={strokeWidth}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {def.el}
    </svg>
  );
}

/** Ordered groups for the media picker */
export const GC_ICON_GROUPS: { id: GcIconGroup; label: string; icons: GcIconName[] }[] = (
  () => {
    const order: GcIconGroup[] = ["views", "status", "actions", "objects", "audio", "rpg"];
    return order.map((g) => ({
      id: g,
      label: g === "views" ? "Views & Data" : g === "status" ? "Progress & Wins" : g === "actions" ? "Controls"
        : g === "objects" ? "Life & Work" : g === "audio" ? "Sound Studio" : "RPG Perks",
      icons: (Object.keys(GC_ICONS) as GcIconName[]).filter((k) => GC_ICONS[k].group === g),
    }));
  }
)();
