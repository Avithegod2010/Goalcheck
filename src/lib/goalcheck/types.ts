/* =========================================================
   GoalCheck Pro — Core domain types
   ========================================================= */

export type Priority = "normal" | "high" | "urgent";

export type TaskStatus = "todo" | "doing" | "done";

export type Recurrence = "none" | "daily" | "weekly";

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  notes: string;
  status: TaskStatus;
  subtasks: Subtask[];
  pomosEstimate: number;
  pomoCount: number;
  /** id of a task that must be completed before this one can be checked */
  dependsOn: string;
  /** "" | YYYY-MM-DD — when this task is due (Advance feature) */
  dueDate: string;
  /** none | daily | weekly — auto-respawn on completion (Advance feature) */
  recurrence: Recurrence;
  /** v4 — id of the original task when this is a recurring respawn */
  respawnedFrom: string;
  createdAt: number;
}

export interface Category {
  id: string;
  title: string;
  /** emoji | data:image | https url | mono:<key> */
  media: string;
  recurrence: Recurrence;
  /** local date key of last daily reset (YYYY-MM-DD) */
  lastResetDate: string;
  /** ISO week key of last weekly reset (YYYY-Wnn) */
  lastWeekKey: string;
  items: Task[];
}

export interface GoalBoard {
  id: string;
  title: string;
  subtitle: string;
  media: string;
  categories: Category[];
  createdAt: number;
}

export type PomoMode = "focus" | "short" | "long";

export interface PomodoroState {
  mode: PomoMode;
  /** custom duration in minutes for focus mode (user settable via /pomo N) */
  focusMinutes: number;
  running: boolean;
  /** epoch ms when the running timer will hit zero (timestamp-based = drift free) */
  endsAt: number;
  /** ms left when last paused */
  remainingMs: number;
  attachedTaskId: string;
}

export interface RpgState {
  enabled: boolean;
  xp: number;
  level: number;
  combo: number;
  skillPoints: number;
  /** skillId -> true */
  skills: Record<string, boolean>;
  /** "" | neon | solar | quantum */
  aura: string;
  /** dateKey -> action count (heatmap + streaks) */
  history: Record<string, number>;
}

export type ParticleEngineId =
  | "fire" | "stardust" | "matrix" | "bubbles" | "snow" | "rain"
  | "fireworks" | "galaxy" | "vortex" | "constellation" | "embers"
  | "petals" | "off";

export type CursorPhysics = "none" | "attract" | "repel" | "orbit";

export type WorkspaceView = "checklist" | "kanban" | "matrix" | "graph" | "analytics" | "week";

export type FilterId = "all" | "active" | "completed" | "priority" | "week";

/** v3 — chime voice pack id */
export type ChimePack = "glass" | "marimba" | "bell" | "chip";

export interface AnalyticsState {
  focusSeconds: number;
  /** hour(0-23) -> completed sessions */
  hourCounts: Record<string, number>;
  /** v4 — goalId -> focus seconds (per-goal attribution) */
  perGoal: Record<string, number>;
}

/* =========================================================
   v4 — Habits & Achievements (Advance)
   ========================================================= */

export type HabitCadence = "daily" | "weekly";

export interface Habit {
  id: string;
  title: string;
  cadence: HabitCadence;
  /** daily: localDateKey -> true ; weekly: isoWeekKey -> true */
  marks: Record<string, boolean>;
  createdAt: number;
  /** v4.2 — streak-freeze tokens earned every 7-day streak (max 2 held) */
  freezes: number;
}

export interface GoalCheckState {
  theme: string;
  particles: ParticleEngineId;
  activeGoalId: string;
  view: WorkspaceView;
  filter: FilterId;
  layoutMode: "grid" | "single";
  goals: GoalBoard[];
  pomo: PomodoroState;
  rpg: RpgState;
  analytics: AnalyticsState;
  settings: Settings;
  brandMedia: string;
  /** v4 — Advance: habit tracker entries */
  habits: Habit[];
  /** v4 — achievementId -> unlocked epoch ms */
  achievements: Record<string, number>;
  /** v4 — custom shared theme (JSON import) applied over the CSS engine */
  customTheme: Record<string, string>;
}

export interface Settings {
  rpgEnabled: boolean;
  heatmapEnabled: boolean;
  autoParent: boolean;
  /** disables particles/ripple/confetti & heavy blur (low-end devices) */
  reduceEffects: boolean;
  /** "manual" uses chosen theme; "system" follows prefers-color-scheme */
  colorMode: "manual" | "system";
  cursorPhysics: CursorPhysics;
  simSpeed: number;
  simDensity: number;
  audioGain: number;
  audioStream: string;
  /** v3 — chime voice pack for completions / pomodoro */
  chimePack: ChimePack;
  /** v3 — chime loudness 0..1 */
  chimeVolume: number;
  /** v4 — first-run onboarding tour shown */
  onboardingDone: boolean;
  /** v4 — epoch ms of last JSON backup (export / sync-file write) */
  lastBackupAt: number;
  /** v4 — epoch ms the backup nudge card was dismissed */
  backupNudgeDismissedAt: number;
  /** v4 — auto-write workspace JSON to a linked local file (File System Access API) */
  syncFileEnabled: boolean;
  /** v4.2 — encrypt the sync-file with a passphrase (vault mode) */
  syncFileEncrypted: boolean;
  /** v4.2 — auto-consume earned freeze tokens to protect habit streaks */
  streakFreezes: boolean;
  /** v4.2 — UI font scale multiplier (0.9 – 1.3), applied to html font-size */
  fontScale: number;
  /** v4.2 — epoch ms of the last Data Doctor scan (drives the monthly nudge) */
  lastDoctorScanAt: number;
}

/* ---------- persistence envelope ---------- */

export const STORAGE_VERSION = 4;
export const STORAGE_KEY = "goalcheck_pro_state";

export interface PersistEnvelope {
  version: number;
  state: GoalCheckState;
}
