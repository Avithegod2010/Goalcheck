/* =========================================================
   GoalCheck editions — ONE codebase, TWO products.

   GoalCheck (base)
     The core planner, true to the original idea:
     goals → categories → tasks, progress rings, priorities,
     notes, subtasks, dependency locks, recurring categories,
     rapid add, search + filters, grid/single layout, Pomodoro
     focus timer + floating pill, mono animated icon set,
     2 themes (Nebula dark / Nordic light), system auto
     light/dark, completion confetti, toasts, JSON export /
     import, reduce-effects. Local-only, FOSS.

   GoalCheck Advance (this build)
     Everything in base, plus the power tools & atmosphere:
     Kanban / Eisenhower Matrix / Mind Map / Analytics views,
     365-day heatmap, RPG gamification (XP, levels, combo,
     skills, auras), 11 themes, 13 particle engines, cursor
     physics, atmosphere presets, theme ripple, audio studio
     (7 generative streams), 4 chime packs, goal templates,
     command palette (Ctrl+K), Zen mode, image URL / upload
     media.

   Build a specific edition:
     NEXT_PUBLIC_GC_EDITION=pro  bun run build   (default)
     NEXT_PUBLIC_GC_EDITION=base bun run build

   Both editions share the SAME storage key + schema version,
   so upgrading base → pro keeps every byte of user data.
   ========================================================= */

export type Edition = "base" | "pro";

export const EDITION: Edition =
  process.env.NEXT_PUBLIC_GC_EDITION === "base" ? "base" : "pro";

export const IS_PRO = EDITION === "pro";

export const APP_NAME = IS_PRO ? "GoalCheck Advance" : "GoalCheck";

export const APP_TAGLINE = IS_PRO
  ? "Multi-goal checklists • Focus timer • Analytics"
  : "Multi-goal checklists • Focus timer";

/** Themes the base edition ships with (one dark + one light). */
export const BASE_THEMES = ["nebula", "nordic"] as const;

/** Pro-only feature registry. Base = everything NOT listed here. */
export type FeatureId =
  | "views.advanced"       // Kanban / Matrix / Mind Map / Analytics
  | "heatmap"              // 365-day activity heatmap + streaks
  | "rpg"                  // XP, levels, combo, skills, auras
  | "particles"            // 13 background particle engines
  | "atmosphere-presets"   // coordinated theme+engine+physics presets
  | "cursor-physics"       // attract / repel / orbit
  | "ripple"               // theme-switch ripple wipe
  | "audio-studio"         // 7 generative ambient streams
  | "chime-packs"          // glass / marimba / bell / chip
  | "templates"            // preset goal templates
  | "command-palette"      // Ctrl+K
  | "zen"                  // Zen focus HUD
  | "media-rich"           // image URL + device upload
  | "habits"               // habit tracker + streaks
  | "achievements"         // badge collection
  | "due-dates"            // task due dates + This Week filter
  | "recurring-tasks"      // per-task daily/weekly respawn
  | "theme-share"          // import/export theme JSON
  | "data-doctor"          // integrity scan + repair
  | "sync-file";           // auto-save to a linked local file

const PRO_FEATURES: readonly FeatureId[] = [
  "views.advanced", "heatmap", "rpg", "particles", "atmosphere-presets",
  "cursor-physics", "ripple", "audio-studio", "chime-packs", "templates",
  "command-palette", "zen", "media-rich", "habits", "achievements",
  "due-dates", "recurring-tasks", "theme-share", "data-doctor", "sync-file",
];

export function hasFeature(f: FeatureId): boolean {
  if (IS_PRO) return true;
  return !PRO_FEATURES.includes(f);
}

export function themeAvailable(id: string): boolean {
  return IS_PRO || (BASE_THEMES as readonly string[]).includes(id);
}

/** Storage key is SHARED across editions by design (base→pro upgrade keeps data). */
export const SHARED_STORAGE_NOTE =
  "GoalCheck and GoalCheck Advance read the same storage schema — upgrading between editions never loses data.";
