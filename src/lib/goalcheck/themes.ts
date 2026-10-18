/* =========================================================
   GoalCheck Pro — Theme registry (11 palettes, 3 light)
   Edition-aware: the base edition exposes only its 2 themes.
   ========================================================= */

import { IS_PRO, BASE_THEMES } from "./editions";

export interface ThemeMeta {
  id: string;
  label: string;
  swatch: string;
  light: boolean;
}

export const THEMES: ThemeMeta[] = [
  { id: "nebula", label: "Midnight Nebula", swatch: "linear-gradient(135deg, #6366f1, #06b6d4)", light: false },
  { id: "cyberpunk", label: "Cyberpunk 2077", swatch: "linear-gradient(135deg, #ec4899, #facc15)", light: false },
  { id: "inferno", label: "Inferno Fire", swatch: "linear-gradient(135deg, #ea580c, #dc2626)", light: false },
  { id: "aurora", label: "Aurora Borealis", swatch: "linear-gradient(135deg, #10b981, #06b6d4)", light: false },
  { id: "sunset", label: "Sunset Horizon", swatch: "linear-gradient(135deg, #f43f5e, #fb923c)", light: false },
  { id: "obsidian", label: "Obsidian Mono", swatch: "linear-gradient(135deg, #ffffff, #52525b)", light: false },
  { id: "matrix", label: "Matrix Terminal", swatch: "linear-gradient(135deg, #22c55e, #84cc16)", light: false },
  { id: "synthwave", label: "Synthwave Retro", swatch: "linear-gradient(135deg, #ff007f, #00f0ff)", light: false },
  { id: "nordic", label: "Nordic Light", swatch: "linear-gradient(135deg, #3b82f6, #f8fafc)", light: true },
  { id: "sakura", label: "Sakura Blossom", swatch: "linear-gradient(135deg, #ec4899, #fed7e2)", light: true },
  { id: "zen", label: "Zen Garden", swatch: "linear-gradient(135deg, #65a30d, #0d9488)", light: true },
];

export const DEFAULT_DARK_THEME = "nebula";
export const DEFAULT_LIGHT_THEME = "nordic";

export function themeExists(id: string): boolean {
  return THEMES.some((t) => t.id === id);
}

/** Themes visible in the picker for the current edition. */
export function availableThemes(): ThemeMeta[] {
  if (IS_PRO) return THEMES;
  const base = new Set<string>(BASE_THEMES);
  return THEMES.filter((t) => base.has(t.id));
}

/** Clamp a persisted theme to this edition (keeps light/dark intent). */
export function clampThemeForEdition(id: string): string {
  if (IS_PRO || themeExists(id) && (BASE_THEMES as readonly string[]).includes(id)) return id;
  return isLightTheme(id) ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;
}

export function isLightTheme(id: string): boolean {
  return THEMES.find((t) => t.id === id)?.light ?? false;
}

/* ---------- 13 particle engines ---------- */

export interface EngineMeta {
  id: string;
  label: string;
}

export const ENGINES: EngineMeta[] = [
  { id: "fire", label: "Fire & Embers" },
  { id: "stardust", label: "Cosmic Stardust" },
  { id: "matrix", label: "Matrix Rain" },
  { id: "bubbles", label: "Floating Bubbles" },
  { id: "snow", label: "Snowfall" },
  { id: "rain", label: "Raindrops" },
  { id: "fireworks", label: "Fireworks" },
  { id: "galaxy", label: "Galaxy Spiral" },
  { id: "vortex", label: "Vortex Swirl" },
  { id: "constellation", label: "Constellation" },
  { id: "embers", label: "Shooting Stars" },
  { id: "petals", label: "Sakura Petals" },
  { id: "off", label: "Disabled (Zero GPU)" },
];

/** Engine picker entries for this edition (base = disabled only). */
export function availableEngines(): EngineMeta[] {
  if (IS_PRO) return ENGINES;
  return ENGINES.filter((e) => e.id === "off");
}

/* ---------- v4 — shareable theme tokens (JSON marketplace) ---------- */

/** CSS custom properties a shared theme JSON may override. */
export const GC_THEME_VARS = [
  "--gc-bg", "--gc-surface", "--gc-surface-2", "--gc-surface-hover",
  "--gc-text", "--gc-text2", "--gc-muted",
  "--gc-accent", "--gc-grad", "--gc-glow", "--gc-soft",
  "--gc-border", "--gc-border-strong", "--gc-input", "--gc-shadow",
  "--gc-danger", "--gc-danger-soft", "--gc-success", "--gc-success-soft",
  "--gc-warning", "--gc-warning-soft",
] as const;

/* ---------- 10 coordinated atmosphere presets ---------- */

export interface AtmospherePreset {
  id: string;
  label: string;
  theme: string;
  engine: string;
  physics: string;
}

export const ATMOSPHERE_PRESETS: AtmospherePreset[] = [
  { id: "nebula-drift", label: "Nebula Drift", theme: "nebula", engine: "galaxy", physics: "orbit" },
  { id: "cyber-pulse", label: "Cyber Pulse", theme: "cyberpunk", engine: "matrix", physics: "repel" },
  { id: "inferno-rush", label: "Inferno Rush", theme: "inferno", engine: "fire", physics: "attract" },
  { id: "aurora-whisper", label: "Aurora Whisper", theme: "aurora", engine: "embers", physics: "orbit" },
  { id: "sunset-fiesta", label: "Sunset Fiesta", theme: "sunset", engine: "fireworks", physics: "attract" },
  { id: "obsidian-void", label: "Obsidian Void", theme: "obsidian", engine: "constellation", physics: "attract" },
  { id: "matrix-rain", label: "Matrix Rain", theme: "matrix", engine: "matrix", physics: "repel" },
  { id: "synth-ride", label: "Synth Ride", theme: "synthwave", engine: "vortex", physics: "orbit" },
  { id: "nordic-calm", label: "Nordic Calm", theme: "nordic", engine: "snow", physics: "repel" },
  { id: "zen-bloom", label: "Zen Bloom", theme: "zen", engine: "petals", physics: "orbit" },
];
