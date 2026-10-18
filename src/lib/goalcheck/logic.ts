/* =========================================================
   GoalCheck Pro — Date helpers + RPG math + parsers + export
   ========================================================= */

import type { Category, GoalBoard, Habit, HabitCadence, Priority, RpgState, Task } from "./types";
import { TEMPLATES } from "./presets";

/* ---------- ids & dates ---------- */

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function localDateKey(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
}

export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${weekNo}`;
}

/* ---------- factories ---------- */

export function makeTask(text: string, opts: Partial<Task> = {}): Task {
  return {
    id: makeId("task"),
    text,
    completed: false,
    priority: "normal",
    notes: "",
    status: "todo",
    subtasks: [],
    pomosEstimate: 1,
    pomoCount: 0,
    dependsOn: "",
    dueDate: "",
    recurrence: "none" as Task["recurrence"],
    respawnedFrom: "",
    createdAt: Date.now(),
    ...opts,
  };
}

export function makeCategory(title: string, media: string, recurrence: string): Category {
  return {
    id: makeId("cat"),
    title: title.replace(/\s*[-:]$/, "").trim() + " -",
    media: media || "mono:clipboard-check",
    recurrence: (recurrence === "daily" || recurrence === "weekly") ? recurrence : "none",
    lastResetDate: localDateKey(new Date()),
    lastWeekKey: isoWeekKey(new Date()),
    items: [],
  };
}

export function goalFromTemplate(tplKey: string): GoalBoard {
  const tpl = TEMPLATES[tplKey];
  const g: GoalBoard = {
    id: makeId("goal"),
    title: tpl.title,
    subtitle: tpl.subtitle,
    media: tpl.media,
    categories: [],
    createdAt: Date.now(),
  };
  g.categories = tpl.categories.map((c) => ({
    id: makeId("cat"),
    title: c.title,
    media: c.media,
    recurrence: "none" as const,
    lastResetDate: localDateKey(new Date()),
    lastWeekKey: isoWeekKey(new Date()),
    items: c.items.map((it) =>
      makeTask(it.text, {
        completed: !!it.completed,
        priority: (it.priority as Priority) || "normal",
        notes: it.notes || "",
        status: it.completed ? "done" : "todo",
      })
    ),
  }));
  return g;
}

export function blankBoard(title: string, subtitle: string): GoalBoard {
  return {
    id: makeId("goal"),
    title,
    subtitle: subtitle || "Goal checklist workflow",
    media: "mono:target-radar",
    categories: [
      { ...makeCategory("To do in laptop", "mono:laptop-code", "none"), items: [makeTask("Xyz"), makeTask("Pyq")] },
      { ...makeCategory("Todo in phone", "mono:phone-pulse", "none"), items: [makeTask("Call & sync notes")] },
    ],
    createdAt: Date.now(),
  };
}

/* ---------- stats ---------- */

export interface GoalStats { total: number; completed: number; remaining: number; percent: number; catCount: number; }

export function calculateStats(goal: GoalBoard | null | undefined): GoalStats {
  let total = 0, completed = 0;
  if (goal) {
    for (const cat of goal.categories ?? []) {
      for (const it of cat.items ?? []) {
        total++;
        if (it.completed) completed++;
      }
    }
  }
  return {
    total,
    completed,
    remaining: total - completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    catCount: goal?.categories?.length ?? 0,
  };
}

/* ---------- quick paste parser ---------- */

export interface ParsedCats { title: string; media: string; items: Task[]; }

export function parseQuickPaste(text: string): ParsedCats[] {
  const lines = (text || "").split(/\r?\n/);
  const result: ParsedCats[] = [];
  let current: ParsedCats | null = null;

  const ensureCat = (title: string, media: string) => {
    const cat: ParsedCats = { title: title + " -", media, items: [] };
    result.push(cat);
    return cat;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const isHeader = /^(.+?)\s*[-:]$/.exec(line);
    const isItem = /^(\d+[\.\)]|[-*•]|\[\s?[xX]?\s?\])\s*(.*)$/.exec(line);

    if (isHeader && !/^\d+[\.\)]/.test(line)) {
      const title = isHeader[1].trim();
      const lower = title.toLowerCase();
      let media = "mono:clipboard-check";
      if (lower.includes("phone") || lower.includes("mobile")) media = "mono:phone-pulse";
      if (lower.includes("pack") || lower.includes("vacation") || lower.includes("travel")) media = "mono:luggage-trip";
      if (lower.includes("study") || lower.includes("exam") || lower.includes("learn")) media = "mono:book-flutter";
      if (lower.includes("work") || lower.includes("office")) media = "mono:briefcase-check";
      if (lower.includes("home") || lower.includes("house")) media = "mono:home-hearth";
      if (lower.includes("health") || lower.includes("gym") || lower.includes("fit")) media = "mono:dumbbell-lift";
      current = ensureCat(title, media);
    } else if (isItem) {
      const body = isItem[2].trim();
      if (!body) continue;
      const done = /^\[[xX]\]/.test(isItem[1].trim());
      if (!current) current = ensureCat("Checklist Tasks", "mono:clipboard-check");
      current.items.push(makeTask(body, { completed: done, status: done ? "done" : "todo" }));
    } else {
      if (!current) current = ensureCat(line.replace(/[-:]$/, "").trim(), "mono:clipboard-check");
      else current.items.push(makeTask(line));
    }
  }
  return result;
}

/* ---------- export builders ---------- */

export function buildPlainExport(goal: GoalBoard): string {
  const s = calculateStats(goal);
  let out = `${goal.title} (${s.completed}/${s.total} done - ${s.percent}%)\n=========================================\n\n`;
  for (const cat of goal.categories) {
    out += cat.title + "\n";
    cat.items.forEach((it, idx) => {
      out += `${idx + 1}. ${it.completed ? "[✓] " : ""}${it.text}${it.notes ? ` (Note: ${it.notes})` : ""}\n`;
    });
    out += "\n";
  }
  return out.trim();
}

export function buildMarkdownExport(goal: GoalBoard): string {
  const s = calculateStats(goal);
  let out = `# ${goal.title} (${s.percent}% Completed)\n\n`;
  for (const cat of goal.categories) {
    out += `### ${cat.title}\n`;
    for (const it of cat.items) out += `- [${it.completed ? "x" : " "}] ${it.text}\n`;
    out += "\n";
  }
  return out.trim();
}

/* ---------- RPG ---------- */

export function xpForLevel(l: number): number { return 100 + (l - 1) * 50; }

export function totalXpForLevel(l: number): number {
  let sum = 0;
  for (let i = 1; i < l; i++) sum += xpForLevel(i);
  return sum;
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (xp >= totalXpForLevel(lvl + 1) && lvl < 200) lvl++;
  return lvl;
}

export function rankForLevel(l: number): string {
  if (l >= 25) return "Mythic";
  if (l >= 20) return "Legend";
  if (l >= 15) return "Grandmaster";
  if (l >= 11) return "Master";
  if (l >= 8) return "Expert";
  if (l >= 5) return "Adept";
  if (l >= 3) return "Apprentice";
  return "Initiate";
}

export interface SkillDef { id: string; icon: string; name: string; desc: string; }

export const RPG_SKILLS: SkillDef[] = [
  { id: "xp-boost", icon: "mono:bolt-boost", name: "XP Amplifier", desc: "+20% XP from every source" },
  { id: "focus-master", icon: "mono:target-radar", name: "Focus Master", desc: "+50% XP from Pomodoro sessions" },
  { id: "combo-keeper", icon: "mono:link-combo", name: "Combo Keeper", desc: "Unchecking halves combo instead of reset" },
  { id: "streak-shield", icon: "mono:shield-guard", name: "Streak Shield", desc: "Pomodoro days count toward heatmap streak" },
  { id: "lucky", icon: "mono:clover-lucky", name: "Lucky Streaks", desc: "10% chance of +25 bonus XP" },
  { id: "time-lord", icon: "mono:time-lord", name: "Time Lord", desc: "Focus hours logged 1.5x faster" },
];

export const RPG_AURAS = [
  { id: "", label: "None" },
  { id: "neon", label: "Neon" },
  { id: "solar", label: "Solar" },
  { id: "quantum", label: "Quantum" },
];

export function comboMultiplier(combo: number): number {
  const step = Math.min(4, Math.floor((combo || 0) / 5));
  return 1 + step * 0.25;
}

export function computeStreaks(hist: Record<string, number>, today: Date): { current: number; best: number } {
  let best = 0, run = 0;
  const d = new Date(today);
  d.setDate(d.getDate() - 400);
  while (d <= today) {
    if ((hist[localDateKey(d)] || 0) > 0) {
      run++;
      if (run > best) best = run;
    } else run = 0;
    d.setDate(d.getDate() + 1);
  }
  let current = 0;
  const cursor = new Date(today);
  if (!((hist[localDateKey(cursor)] || 0) > 0)) cursor.setDate(cursor.getDate() - 1);
  while ((hist[localDateKey(cursor)] || 0) > 0) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, best: Math.max(best, current) };
}

export function hourLabel(h: number): string {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${h < 12 ? "AM" : "PM"}`;
}

/* =========================================================
   v4 — Advance helpers: due dates, habits, achievements
   ========================================================= */

/** offset a Date by n days (local-safe) */
function shiftDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export type DueStatus = "" | "overdue" | "today" | "week" | "later";

/** Classify a YYYY-MM-DD due date against today ("" = no due date). */
export function dueStatus(dueDate: string, now: Date = new Date()): DueStatus {
  if (!dueDate) return "";
  const today = localDateKey(now);
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  // end of the current ISO week (Sunday); string compare works on YYYY-MM-DD
  const endOfWeek = shiftDays(now, 6 - ((now.getDay() + 6) % 7));
  if (dueDate <= localDateKey(endOfWeek)) return "week";
  return "later";
}

/** True when the task is due within the current ISO week (or overdue today/earlier). */
export function inCurrentWeek(dueDate: string, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  const today = localDateKey(now);
  if (dueDate <= today) return true;
  const endOfWeek = shiftDays(now, 6 - ((now.getDay() + 6) % 7));
  return dueDate <= localDateKey(endOfWeek);
}

/* ---------- habits ---------- */

/** Key used to mark a habit for the current period. */
export function habitPeriodKey(cadence: HabitCadence, now: Date = new Date()): string {
  return cadence === "weekly" ? isoWeekKey(now) : localDateKey(now);
}

/** Consecutive daily (or weekly) streak ending at the current (or last) period. */
export function habitStreak(marks: Record<string, boolean>, cadence: HabitCadence, now: Date = new Date()): number {
  let streak = 0;
  if (cadence === "daily") {
    let cursor = new Date(now);
    // allow the streak to start at today OR yesterday
    if (!marks[localDateKey(cursor)]) cursor = shiftDays(cursor, -1);
    while (marks[localDateKey(cursor)]) {
      streak += 1;
      cursor = shiftDays(cursor, -1);
    }
    return streak;
  }
  // weekly: walk back ISO weeks
  const currentKey = isoWeekKey(now);
  if (!marks[currentKey]) {
    const lastWeek = shiftDays(now, -7);
    if (!marks[isoWeekKey(lastWeek)]) return 0;
  }
  let cursor = marks[currentKey] ? new Date(now) : shiftDays(now, -7);
  while (marks[isoWeekKey(cursor)]) {
    streak += 1;
    cursor = shiftDays(cursor, -7);
  }
  return streak;
}

/** Last N period keys (oldest -> newest) for the mini history dots. */
export function habitRecentKeys(cadence: HabitCadence, n: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  if (cadence === "daily") {
    for (let i = n - 1; i >= 0; i--) keys.push(localDateKey(shiftDays(now, -i)));
  } else {
    for (let i = n - 1; i >= 0; i--) keys.push(isoWeekKey(shiftDays(now, -i * 7)));
  }
  return keys;
}

/* ---------- achievements (Advance) ---------- */

export interface AchievementDef {
  id: string;
  label: string;
  desc: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-task", label: "First Blood", desc: "Complete your first task", icon: "check-circle" },
  { id: "tasks-25", label: "Momentum", desc: "Complete 25 tasks", icon: "bolt-boost" },
  { id: "tasks-100", label: "Centurion", desc: "Complete 100 tasks", icon: "trophy-star" },
  { id: "board-100", label: "Goal Crusher", desc: "Finish every task on a board (5+ tasks)", icon: "target-radar" },
  { id: "streak-7", label: "Week Warrior", desc: "7-day activity streak", icon: "flame-ember" },
  { id: "streak-30", label: "Iron Habit", desc: "30-day activity streak", icon: "shield-guard" },
  { id: "pomos-10", label: "Focus Initiate", desc: "Finish 10 pomodoro sessions", icon: "tomato-timer" },
  { id: "pomos-100", label: "Deep Work Adept", desc: "Finish 100 pomodoro sessions", icon: "brain-cube" },
  { id: "night-owl", label: "Night Owl", desc: "Complete a task between 00:00–04:59", icon: "clock-hand" },
  { id: "early-bird", label: "Early Bird", desc: "Complete a task between 05:00–07:59", icon: "coffee-steam" },
  { id: "level-5", label: "Rising Star", desc: "Reach level 5", icon: "star-shine" },
  { id: "level-10", label: "Legend", desc: "Reach level 10", icon: "gem-spark" },
  { id: "habit-streak-7", label: "Routine Built", desc: "Hold a 7-period habit streak", icon: "repeat-cycle" },
];

export interface AchievementScanInput {
  goals: GoalBoard[];
  rpg: RpgState;
  analytics: { hourCounts?: Record<string, number>; focusSeconds?: number };
  habits: Habit[];
  pomoTotalSessions: number;
}

/** Return the ids of achievements whose condition is satisfied right now. */
export function evaluateAchievements(input: AchievementScanInput): string[] {
  const done: string[] = [];
  const { goals, rpg, habits, pomoTotalSessions } = input;
  const hourCounts = input.analytics?.hourCounts ?? {};

  let completedTotal = 0;
  let boardComplete = false;
  for (const g of goals) {
    let t = 0, c = 0;
    for (const cat of g.categories ?? []) {
      for (const it of cat.items ?? []) {
        t += 1;
        if (it.completed) {
          c += 1;
          completedTotal += 1;
          const h = new Date().getHours();
          if (h < 5) done.push("night-owl");
          else if (h < 8) done.push("early-bird");
        }
      }
    }
    if (t >= 5 && c === t) boardComplete = true;
  }

  if (completedTotal >= 1) done.push("first-task");
  if (completedTotal >= 25) done.push("tasks-25");
  if (completedTotal >= 100) done.push("tasks-100");
  if (boardComplete) done.push("board-100");

  const { current } = computeStreaks(rpg.history ?? {}, new Date());
  if (current >= 7) done.push("streak-7");
  if (current >= 30) done.push("streak-30");
  if (pomoTotalSessions >= 10) done.push("pomos-10");
  if (pomoTotalSessions >= 100) done.push("pomos-100");
  if ((rpg.level ?? 1) >= 5) done.push("level-5");
  if ((rpg.level ?? 1) >= 10) done.push("level-10");

  for (const hb of habits) {
    if (habitStreak(hb.marks ?? {}, hb.cadence) >= 7) done.push("habit-streak-7");
  }

  return Array.from(new Set(done));
}
